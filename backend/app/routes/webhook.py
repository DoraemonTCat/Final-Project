from fastapi import APIRouter, Request, Depends
from fastapi.responses import PlainTextResponse
from app.database import crud
from app.database.database import get_db
from sqlalchemy.orm import Session
from datetime import datetime
import os
from app.service.facebook_api import fb_get
from app.service.websocket_service import notify_new_customer, notify_customer_update
import asyncio

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
                    
                    print(f"📨 New message from user: {sender_id}")
                    print(f"Page: {page_id}, Access token available: {bool(access_token)}")
                    
                    user_name = f"User...{sender_id[-8:]}"
                    profile_pic = ""
                    
                    if access_token:
                        # ดึงข้อมูล user
                        try:
                            user_info = fb_get(sender_id, {"fields": "name,first_name,last_name,profile_pic"}, access_token)
                            
                            # เตรียมข้อมูลสำหรับบันทึก
                            if "name" in user_info:
                                user_name = user_info.get("name", "")
                            elif "first_name" in user_info or "last_name" in user_info:
                                user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                            
                            profile_pic = user_info.get("profile_pic", "")
                            print(f"✅ Got user info: {user_name}")
                            
                        except Exception as e:
                            print(f"⚠️ Could not fetch user info: {e}")
                    
                    # เตรียมข้อมูลสำหรับบันทึก
                    customer_data = {
                        'name': user_name,
                        'first_interaction_at': datetime.now(),
                        'last_interaction_at': datetime.now()
                    }
                    
                    # ตรวจสอบว่ามี customer อยู่แล้วหรือไม่
                    existing_customer = crud.get_customer_by_psid(db, page.ID, sender_id)
                    
                    if existing_customer:
                        # อัพเดทข้อมูลลูกค้าที่มีอยู่
                        customer = crud.create_or_update_customer(db, page.ID, sender_id, customer_data)
                        print(f"📝 Updated existing customer: {user_name} ({sender_id})")
                        
                        # ส่ง WebSocket notification สำหรับการอัพเดท
                        await notify_customer_update(page_id, {
                            'psid': sender_id,
                            'name': user_name,
                            'profile_pic': profile_pic,
                            'first_interaction': customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                            'last_interaction': customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                            'is_new': False
                        })
                    else:
                        # สร้างลูกค้าใหม่
                        customer = crud.create_or_update_customer(db, page.ID, sender_id, customer_data)
                        print(f"✅ Created new customer: {user_name} ({sender_id})")
                        
                        # ส่ง WebSocket notification สำหรับลูกค้าใหม่
                        await notify_new_customer(page_id, {
                            'psid': sender_id,
                            'name': user_name,
                            'profile_pic': profile_pic,
                            'first_interaction': customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                            'last_interaction': customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                            'is_new': True
                        })
                    
                except Exception as e:
                    print(f"❌ Error processing webhook: {e}")
                    import traceback
                    traceback.print_exc()
    
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)