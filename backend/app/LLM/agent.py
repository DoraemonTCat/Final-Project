import re
import requests
from io import BytesIO
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import google.generativeai as genai
from PIL import Image
from app.database import models

def classify_and_assign_tier_hybrid(db: Session, page_id: int):
    # 1️⃣ load knowledge config ที่ enabled
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
        ck.id: ck for ck in db.query(models.CustomerTypeKnowledge)
        .filter(models.CustomerTypeKnowledge.id.in_(enabled_knowledge_ids))
        .all()
    }

    # 2️⃣ load tier config
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

        # 3️⃣ Keyword-based matching ก่อน (ถ้าเป็น text)
        category_id = None
        if message_type == "text":
            category_id = match_by_keyword(message_text, knowledge_map)

        # 4️⃣ Fallback → Gemini
        if not category_id:
            if message_type == "text":
                category_id = classify_with_gemini(message_text, knowledge_map)
            elif message_type == "attachment":
                category_id = classify_with_gemini_image(message_text, knowledge_map)

        # update knowledge id
        cust.customer_type_knowledge_id = category_id

        # 5️⃣ หา tier จากวัน
        if cust.last_interaction_at:
            days_since_last = (now - cust.last_interaction_at).days
            selected_tier = None
            for tier in sorted(tier_configs, key=lambda x: x.days_since_last_contact):
                if days_since_last >= tier.days_since_last_contact:
                    selected_tier = tier.tier_name

            if selected_tier:
                cust.current_tier = selected_tier

    db.commit()


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


def classify_with_gemini(message_text: str, knowledge_map: dict):
    """ใช้ Gemini API (text)"""
    prompt_parts = ["คุณคือผู้เชี่ยวชาญในการจัดหมวดหมู่ลูกค้าจากข้อความแชท กรุณาวิเคราะห์ข้อความและเลือกหมวดหมู่ที่เหมาะสมที่สุด",
                    "\n--- หมวดหมู่ทั้งหมด ---"]
    for k in knowledge_map.values():
        prompt_parts.append(f"ID {k.id}: {k.type_name} (คำอธิบาย: {k.rule_description})")

    prompt_parts.append("\n--- ข้อความของลูกค้า ---")
    prompt_parts.append(message_text)
    prompt_parts.append("\n--- คำสั่ง ---")
    prompt_parts.append("ตอบกลับด้วยตัวเลข ID ของหมวดหมู่ที่ตรงที่สุดเพียงอย่างเดียว ไม่ต้องมีข้อความอื่นใดๆ")

    prompt = "\n".join(prompt_parts)

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            generation_config={"temperature": 0, "max_output_tokens": 10}
        )
        response = model.generate_content(prompt)
        answer = response.text.strip()

        if answer.isdigit() and int(answer) in knowledge_map:
            print(f"Gemini classified text into Category ID: {answer}")
            return int(answer)

    except Exception as e:
        print(f"Gemini API error: {e}")

    return None


def classify_with_gemini_image(image_url: str, knowledge_map: dict):
    """ใช้ Gemini Vision วิเคราะห์ภาพก่อนแล้ว map กับ category"""
    try:
        # โหลดรูปจาก url
        img_bytes = requests.get(image_url, timeout=10).content
        image = Image.open(BytesIO(img_bytes))

        # ส่งเข้า Gemini Vision
        model = genai.GenerativeModel("gemini-1.5-flash")  # vision support
        response = model.generate_content(
            [
                image,
                "\nโปรดอธิบายรูปนี้สั้นๆ ว่าคืออะไร เช่น slip, receipt, สินค้า, หรืออย่างอื่น"
            ]
        )
        caption = response.text.strip()
        print(f"Gemini Vision caption: {caption}")

        # ส่ง caption เข้า classifier แบบ text
        return classify_with_gemini(caption, knowledge_map)

    except Exception as e:
        print(f"Gemini Vision error: {e}")
        return None