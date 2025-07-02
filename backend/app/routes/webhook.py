from fastapi import APIRouter, Request, Depends
from fastapi.responses import PlainTextResponse
from app.database import crud
from app.database.database import get_db
from sqlalchemy.orm import Session
from datetime import datetime
import os
from app.service.facebook_api import fb_get

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == os.getenv("VERIFY_TOKEN"):
        return PlainTextResponse(content=params.get("hub.challenge"), status_code=200)
    return PlainTextResponse(content="Verification failed", status_code=403)

@router.post("/webhook")
async def webhook_post(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    
    for entry in body.get("entry", []):
        page_id = entry.get("id")  # Page ID
        
        # ดึง page จาก database
        page = crud.get_page_by_page_id(db, page_id) if page_id else None
        
        for msg_event in entry.get("messaging", []):
            sender_id = msg_event["sender"]["id"]
            
            # ตรวจสอบว่าไม่ใช่ข้อความจาก page เอง
            if page and sender_id != page_id:
                try:
                    # ดึงข้อมูล user จาก Facebook API
                    from app.routes.facebook import page_tokens
                    access_token = page_tokens.get(page_id)
                    
                    if access_token:
                        # ดึงข้อมูล user
                        user_info = fb_get(sender_id, {"fields": "name,first_name,last_name,profile_pic"}, access_token)
                        
                        # เตรียมข้อมูลสำหรับบันทึก
                        user_name = user_info.get("name", "")
                        if not user_name:
                            user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                        if not user_name:
                            user_name = f"User...{sender_id[-8:]}"
                        
                        customer_data = {
                            'name': user_name,
                            'first_interaction_at': datetime.now(),
                            'last_interaction_at': datetime.now()
                        }
                        
                        # สร้างหรืออัพเดทข้อมูลลูกค้า
                        customer = crud.create_or_update_customer(db, page.ID, sender_id, customer_data)
                        
                        print(f"✅ บันทึก/อัพเดทข้อมูลลูกค้าอัตโนมัติ: {user_name} ({sender_id})")
                    else:
                        # ถ้าไม่มี access token ให้บันทึกเฉพาะ PSID
                        customer_data = {
                            'name': f"User...{sender_id[-8:]}",
                            'first_interaction_at': datetime.now(),
                            'last_interaction_at': datetime.now()
                        }
                        crud.create_or_update_customer(db, page.ID, sender_id, customer_data)
                        print(f"⚠️ บันทึกลูกค้าด้วย PSID เท่านั้น: {sender_id}")
                    
                except Exception as e:
                    print(f"❌ ไม่สามารถบันทึกข้อมูลลูกค้า: {e}")
    
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)