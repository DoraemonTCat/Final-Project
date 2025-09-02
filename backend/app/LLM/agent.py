import re
import requests
from io import BytesIO
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import google.generativeai as genai
from PIL import Image
from app.database import models
import asyncio
import time
import random

# simple cache
_cache_text = {}
_cache_image = {}


def classify_and_assign_tier_hybrid(db: Session, page_id: int):
    # 1️⃣ โหลด knowledge config ที่ enabled
    enabled_knowledge_ids = [
        pk.customer_type_knowledge_id
        for pk in db.query(models.PageCustomerTypeKnowledge)
        .filter(
            models.PageCustomerTypeKnowledge.page_id == page_id,
            models.PageCustomerTypeKnowledge.is_enabled == True
        )
        .all()
    ]

    knowledge_map = {
        ck.id: ck
        for ck in db.query(models.CustomerTypeKnowledge)
        .filter(models.CustomerTypeKnowledge.id.in_(enabled_knowledge_ids))
        .all()
    }

    # 2️⃣ โหลด tier config
    tier_configs = (
        db.query(models.RetargetTiersConfig)
        .filter(models.RetargetTiersConfig.page_id == page_id)
        .order_by(models.RetargetTiersConfig.days_since_last_contact.asc())
        .all()
    )

    customers = (
        db.query(models.FbCustomer)
        .filter(models.FbCustomer.page_id == page_id)
        .all()
    )

    now = datetime.now(timezone.utc)
    pending_updates = []

    for cust in customers:
        # ดึงข้อความล่าสุด
        last_message = (
            db.query(models.CustomerMessage.message_text,
                     models.CustomerMessage.message_type)
            .filter(models.CustomerMessage.customer_id == cust.id)
            .order_by(models.CustomerMessage.created_at.desc())
            .first()
        )
        if not last_message:
            continue

        message_text, message_type = last_message
        if not message_text:
            continue

        # 3️⃣ Classification (text → keyword → Gemini, attachment → image classifier)
        category_id = None

        if message_type == "text":
            category_id = match_by_keyword(message_text, knowledge_map)
            if not category_id:
                short_text = message_text[:350]
                category_id = classify_with_gemini(short_text, knowledge_map)

        elif message_type == "attachment":
            # ตรวจว่าเป็นไฟล์รูปจริงหรือไม่ (รองรับ query string ต่อท้าย)
            if re.search(r'\.(png|jpe?g)(\?.*)?$', message_text, re.IGNORECASE):
                category_id = classify_with_gemini_image(message_text, knowledge_map)

        # 4️⃣ Update knowledge id ถ้ามีการเปลี่ยน
        if category_id and category_id != cust.customer_type_knowledge_id:
            cust.customer_type_knowledge_id = category_id

            knowledge_type = db.query(models.CustomerTypeKnowledge).filter(
                models.CustomerTypeKnowledge.id == category_id
            ).first()
            page_record = db.query(models.FacebookPage).filter(
                models.FacebookPage.ID == page_id
            ).first()

            if knowledge_type and page_record:
                update_data = {
                    'page_id': page_record.page_id,
                    'psid': cust.customer_psid,
                    'customer_type_knowledge_id': category_id,
                    'customer_type_knowledge_name': knowledge_type.type_name,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                pending_updates.append(update_data)

        # 5️⃣ หา tier จากวัน
        if cust.last_interaction_at:
            days_since_last = (now - cust.last_interaction_at).days
            selected_tier = None
            for tier in sorted(tier_configs, key=lambda x: x.days_since_last_contact):
                if days_since_last >= tier.days_since_last_contact:
                    selected_tier = tier.tier_name
            if selected_tier:
                cust.current_tier = selected_tier

    # ✅ Commit ก่อน
    db.commit()

    # ✅ ส่ง SSE หลัง commit สำเร็จ
    if pending_updates:
        try:
            from app.routes.facebook.sse import customer_type_update_queue

            async def send_all():
                for update in pending_updates:
                    await customer_type_update_queue.put(update)
                    print(f"📡 Queueing SSE update: {update['psid']} -> {update['customer_type_knowledge_name']}")

            # ใช้ existing loop ถ้ามี, ไม่สร้างใหม่ทุกครั้ง
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(send_all())
            except RuntimeError:
                asyncio.run(send_all())

        except Exception as e:
            print(f"❌ Error sending SSE updates: {e}")


def match_by_keyword(message_text: str, knowledge_map: dict):
    """ตรวจสอบด้วย keyword ก่อน ถ้า match ก็ return category id"""
    for k in knowledge_map.values():
        if not k.keywords:
            continue
        for kw in k.keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', message_text, re.IGNORECASE):
                print(f"Keyword matched: '{kw}' -> Category ID: {k.id}")
                return k.id
    return None


def classify_with_gemini(message_text: str, knowledge_map: dict, max_retries: int = 3):
    """ใช้ Gemini API (text) พร้อม retry/backoff + cache"""

    # 🔹 check cache ก่อน
    if message_text in _cache_text:
        return _cache_text[message_text]

    prompt_parts = [
        "คุณคือผู้เชี่ยวชาญในการจัดหมวดหมู่ลูกค้าจากข้อความแชท กรุณาวิเคราะห์ข้อความและเลือกหมวดหมู่ที่เหมาะสมที่สุด",
        "\n--- หมวดหมู่ทั้งหมด ---"
    ]
    for k in knowledge_map.values():
        prompt_parts.append(f"ID {k.id}: {k.type_name} (คำอธิบาย: {k.rule_description})")

    prompt_parts.append("\n--- ข้อความของลูกค้า ---")
    prompt_parts.append(message_text)
    prompt_parts.append("\n--- คำสั่ง ---")
    prompt_parts.append("ตอบกลับด้วยตัวเลข ID ของหมวดหมู่ที่ตรงที่สุดเพียงอย่างเดียว ไม่ต้องมีข้อความอื่นใดๆ")

    prompt = "\n".join(prompt_parts)

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-lite",
        generation_config={"temperature": 0, "max_output_tokens": 30}
    )

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            answer = response.text.strip()

            if answer.isdigit() and int(answer) in knowledge_map:
                category_id = int(answer)
                print(f"Gemini classified text into Category ID: {category_id}")
                _cache_text[message_text] = category_id
                return category_id
            else:
                print(f"⚠️ Gemini returned invalid answer: {answer}")
                return None

        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"⏳ Gemini text rate limited. Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"❌ Gemini text API error: {e}")
                return None

    return None


def classify_with_gemini_image(image_url: str, knowledge_map: dict, max_retries: int = 3):
    """ใช้ Gemini Vision วิเคราะห์ภาพ + retry/backoff + cache"""

    # 🔹 check cache ก่อน
    if image_url in _cache_image:
        return _cache_image[image_url]

    try:
        # โหลดรูปจาก url
        img_bytes = requests.get(image_url, timeout=10).content
        image = Image.open(BytesIO(img_bytes))

    except Exception as e:
        print(f"❌ Error loading image: {e}")
        return None

    model = genai.GenerativeModel("gemini-1.5-flash")

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                [
                    image,
                    "\nโปรดอธิบายรูปนี้สั้นๆ ว่าคืออะไร เช่น slip, receipt, สินค้า, หรืออย่างอื่น"
                ]
            )
            caption = response.text.strip()
            print(f"Gemini Vision caption: {caption}")

            # ส่ง caption เข้า classifier แบบ text
            category_id = classify_with_gemini(caption, knowledge_map)
            if category_id:
                _cache_image[image_url] = category_id
            return category_id

        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"⏳ Gemini image rate limited. Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"❌ Gemini image API error: {e}")
                return None

    return None