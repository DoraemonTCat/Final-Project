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
        # ✅ classification ล่าสุด
        last_classification = (
            db.query(models.FBCustomerClassification)
            .filter(models.FBCustomerClassification.customer_id == cust.id)
            .order_by(models.FBCustomerClassification.classified_at.desc())
            .first()
        )
        old_category_id = last_classification.new_category_id if last_classification else None

        last_message = None
        if last_classification:
            if last_classification.classified_at > cust.last_interaction_at:
                # ✅ เคยจัดกลุ่มใหม่กว่าการคุยล่าสุด → ไม่ต้องจัดซ้ำ
                print(f"⏭ Skip {cust.id}: already classified at {last_classification.classified_at}")
                continue
            else:
                # 🔄 จัดใหม่จากข้อความหลัง classified_at
                last_message = (
                    db.query(models.CustomerMessage.message_text,
                             models.CustomerMessage.message_type)
                    .filter(
                        models.CustomerMessage.customer_id == cust.id,
                        models.CustomerMessage.created_at > last_classification.classified_at
                    )
                    .order_by(models.CustomerMessage.created_at.desc())
                    .first()
                )
        else:
            # ถ้ายังไม่เคยมี classification → ใช้ข้อความล่าสุดทั้งหมด
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

        # 3️⃣ Classification
        category_id = None
        if message_type == "text":
            category_id = match_by_keyword(message_text, knowledge_map)
            if not category_id:
                category_id = classify_with_gemini(
                    message_text,
                    knowledge_map,
                    prev_category_id=old_category_id
                )
        elif message_type == "attachment":
            if re.search(r'\.(png|jpe?g)(\?.*)?$', message_text, re.IGNORECASE):
                category_id = classify_with_gemini_image(message_text, knowledge_map)

        # ⏳ Skip ลูกค้าที่เพิ่งคุย <1 ชม.
        if cust.last_interaction_at:
            diff_hours = (now - cust.last_interaction_at).total_seconds() / 3600
            if diff_hours < 1:
                print(f"⏳ Skip {cust.id}: last_interaction_at {diff_hours:.2f}h < 1h")
                continue

        # 4️⃣ Insert classification ถ้าเปลี่ยน
        if category_id and category_id != old_category_id:
            new_classification = models.FBCustomerClassification(
                customer_id=cust.id,
                old_category_id=old_category_id,
                new_category_id=category_id,
                classified_at=datetime.now(timezone.utc),
                classified_by="Gemini-2.5-flash-lite",
                page_id=page_id
            )
            db.add(new_classification)

            knowledge_type = knowledge_map.get(category_id)
            if knowledge_type:
                update_data = {
                    'page_id': page_id,
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

    # ✅ ส่ง SSE หลัง commit
    if pending_updates:
        try:
            from app.routes.facebook.sse import customer_type_update_queue

            async def send_all():
                for update in pending_updates:
                    await customer_type_update_queue.put(update)
                    print(f"📡 Queueing SSE update: {update['psid']} -> {update['customer_type_knowledge_name']}")

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


def safe_extract_text(response):
    """ดึงข้อความจาก Gemini response แบบปลอดภัย"""
    if not response.candidates:
        return None, "no_candidates"

    cand = response.candidates[0]
    if cand.finish_reason != 1:  # 1 = SUCCESS
        return None, f"finish_reason={cand.finish_reason}"

    if not cand.content.parts:
        return None, "no_parts"

    return cand.content.parts[0].text.strip(), None


def classify_with_gemini(
    message_text: str,
    knowledge_map: dict,
    prev_category_id=None,
    max_retries: int = 3,
    model_name: str = "gemini-2.5-flash-lite"
):
    if message_text in _cache_text:
        return _cache_text[message_text]

    prompt_parts = [
        "คุณคือผู้เชี่ยวชาญในการจัดหมวดหมู่ลูกค้าจากข้อความแชท",
        "กรุณาเลือกหมวดหมู่ที่ตรงที่สุดจากข้อความนี้",
        "\n--- หมวดหมู่ทั้งหมด ---"
    ]
    for k in knowledge_map.values():
        prompt_parts.append(f"ID {k.id}: {k.type_name} (คำอธิบาย: {k.rule_description}) (ตัวอย่าง: {k.examples})")

    if prev_category_id:
        prompt_parts.append(f"\nหมวดหมู่เดิมของลูกค้าคือ ID {prev_category_id} กรุณาพิจารณาประกอบ")

    prompt_parts.append("\n--- ข้อความของลูกค้า ---")
    prompt_parts.append(message_text)
    prompt_parts.append(
        """--- คำสั่ง ---
        1. ถ้ามีข้อความที่เหมือนหรือใกล้เคียงกับ "ตัวอย่าง" ของหมวดใด ให้เลือกหมวดนั้นทันที
        2. ถ้าไม่เจอตรงกับตัวอย่าง ให้ใช้คำอธิบายหมวดเพื่อเลือก
        3. ถ้าไม่ชัดเจนและข้อความไม่เพียงพอ ให้คงหมวดเดิมไว้ (ตอบ ID เดิม)
        4. ตอบกลับด้วยตัวเลข ID อย่างเดียว"""
    )

    prompt = "\n".join(prompt_parts)

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"temperature": 0, "max_output_tokens": 20}
            )
            response = model.generate_content(prompt)

            answer, err = safe_extract_text(response)
            if not answer:
                print(f"⚠️ Gemini {model_name} returned no usable text ({err})")
                if "finish_reason=2" in (err or "") and attempt < max_retries - 1:
                    time.sleep(1 + random.random())
                    continue
                return None

            match = re.search(r'\d+', answer)
            if match and int(match.group(0)) in knowledge_map:
                category_id = int(match.group(0))
                print(f"Gemini classified text into Category ID: {category_id} (via {model_name})")
                _cache_text[message_text] = category_id
                return category_id
            else:
                print(f"⚠️ Gemini {model_name} returned invalid answer: {answer}")
                return None

        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"⏳ Gemini {model_name} rate limited. Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"❌ Gemini {model_name} API error: {e}")
                return None

    return None


def classify_with_gemini_image(image_url: str, knowledge_map: dict, max_retries: int = 3):
    """ใช้ Gemini Vision วิเคราะห์ภาพ + retry/backoff + cache"""
    if image_url in _cache_image:
        return _cache_image[image_url]

    try:
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