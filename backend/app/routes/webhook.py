from fastapi import APIRouter, Request, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from app.database import crud
from app.database.database import get_db
from sqlalchemy.orm import Session
from datetime import datetime
import os
from app.service.facebook_api import fb_get
import logging
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

# Dictionary เก็บสถานะการแจ้งเตือน user ใหม่
new_user_notifications = {}

# API สำหรับยืนยัน webhook
@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == os.getenv("VERIFY_TOKEN"):
        return PlainTextResponse(content=params.get("hub.challenge"), status_code=200)
    return PlainTextResponse(content="Verification failed", status_code=403)

# ฟังก์ชันสำหรับ sync ข้อมูล user ใหม่แบบละเอียด
async def sync_new_user_data(page_id: str, sender_id: str, page_db_id: int, db: Session):
    """ฟังก์ชันสำหรับ sync ข้อมูล user ใหม่แบบละเอียด"""
    try:
        from backend.app.routes.facebook.conversations import page_tokens
        access_token = page_tokens.get(page_id)
        
        if not access_token:
            logger.error(f"❌ ไม่พบ access token สำหรับ page {page_id}")
            return None
            
        # 1. ดึงข้อมูล user profile แบบละเอียด
        user_fields = "id,name,first_name,last_name,profile_pic,gender,locale,timezone"
        user_info = fb_get(sender_id, {"fields": user_fields}, access_token)
        
        # 2. ดึงชื่อผู้ใช้จากหลายแหล่ง
        user_name = user_info.get("name", "")
        if not user_name:
            user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            
        # 3. หาข้อมูล conversation ของ user นี้
        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(1){created_time}",
            "user_id": sender_id,
            "limit": 1
        }
        
        conversations = fb_get(endpoint, params, access_token)
        
        # 4. หาเวลาที่เริ่มคุยครั้งแรก
        first_interaction = datetime.now()
        last_interaction = datetime.now()
        
        if conversations and "data" in conversations and conversations["data"]:
            conv = conversations["data"][0]
            
            # ดึงเวลาข้อความแรก
            if "messages" in conv and "data" in conv["messages"] and conv["messages"]["data"]:
                first_msg_time = conv["messages"]["data"][0].get("created_time")
                if first_msg_time:
                    try:
                        first_interaction = datetime.fromisoformat(first_msg_time.replace('Z', '+00:00'))
                    except:
                        pass
                        
            # เวลาล่าสุด
            if conv.get("updated_time"):
                try:
                    last_interaction = datetime.fromisoformat(conv["updated_time"].replace('Z', '+00:00'))
                except:
                    pass
        
        # 5. เตรียมข้อมูลสำหรับบันทึก
        customer_data = {
            'name': user_name or f"User...{sender_id[-8:]}",
            'first_interaction_at': first_interaction,
            'last_interaction_at': last_interaction,
            'profile_pic': user_info.get('profile_pic', ''),
            'metadata': {
                'gender': user_info.get('gender'),
                'locale': user_info.get('locale'),
                'timezone': user_info.get('timezone')
            }
        }
        
        # 6. บันทึกข้อมูลลง database
        customer = crud.create_or_update_customer(db, page_db_id, sender_id, customer_data)
        
        logger.info(f"✅ Auto sync สำเร็จสำหรับ user ใหม่: {user_name} ({sender_id})")
        
        # 7. เก็บข้อมูลการแจ้งเตือน
        if page_id not in new_user_notifications:
            new_user_notifications[page_id] = []
            
        new_user_notifications[page_id].append({
            'user_name': user_name,
            'psid': sender_id,
            'timestamp': datetime.now().isoformat(),
            'profile_pic': user_info.get('profile_pic', '')
        })
        
        # ลบการแจ้งเตือนเก่าที่เกิน 24 ชั่วโมง
        cutoff_time = datetime.now().timestamp() - (24 * 60 * 60)
        new_user_notifications[page_id] = [
            notif for notif in new_user_notifications[page_id]
            if datetime.fromisoformat(notif['timestamp']).timestamp() > cutoff_time
        ]
        
        return customer
        
    except Exception as e:
        logger.error(f"❌ Error syncing new user data: {e}")
        return None

# ฟังก์ชันสำหรับจัดการการเชื่อมต่อ SSE
@router.post("/webhook")
async def webhook_post(
    request: Request, 
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
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
                    # ตรวจสอบว่ามี user ในระบบแล้วหรือไม่
                    existing_customer = crud.get_customer_by_psid(db, page.ID, sender_id)
                    
                    if not existing_customer:
                        # เป็น user ใหม่! ทำการ sync อัตโนมัติทันที
                        logger.info(f"🆕 พบ User ใหม่: {sender_id} ในเพจ {page.page_name}")
                        
                        # Sync ข้อมูลในพื้นหลัง
                        background_tasks.add_task(
                            sync_new_user_data_enhanced,
                            page_id,
                            sender_id,
                            page.ID,
                            db
                        )
                        
                    else:
                        # User เก่า - อัพเดทเวลาล่าสุดที่ทักเข้ามา
                        crud.update_customer_interaction(db, page.ID, sender_id)
                        logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {existing_customer.name}")
                    
                except Exception as e:
                    logger.error(f"❌ Error processing webhook: {e}")
    
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)

# เพิ่ม endpoint สำหรับดึงการแจ้งเตือน user ใหม่
@router.get("/new-user-notifications/{page_id}")
async def get_new_user_notifications(page_id: str):
    """ดึงรายการ user ใหม่ที่เพิ่งเข้ามาใน 24 ชั่วโมงที่ผ่านมา"""
    notifications = new_user_notifications.get(page_id, [])
    
    return {
        "page_id": page_id,
        "new_users": notifications,
        "count": len(notifications)
    }

# ฟังก์ชันสำหรับ sync ข้อมูล user ใหม่แบบละเอียด พร้อมดึงข้อมูลเวลาที่ถูกต้อง
async def sync_new_user_data_enhanced(page_id: str, sender_id: str, page_db_id: int, db: Session):
    """ฟังก์ชันสำหรับ sync ข้อมูล user ใหม่แบบละเอียด พร้อมดึงข้อมูลเวลาที่ถูกต้อง"""
    try:
        from app.routes.facebook.auth import get_page_tokens
        from app.service.facebook_api import fb_get
        
        page_tokens = get_page_tokens()
        access_token = page_tokens.get(page_id)
        
        if not access_token:
            logger.error(f"❌ ไม่พบ access token สำหรับ page {page_id}")
            return None
            
        # 1. ดึงข้อมูล user profile
        user_fields = "id,name,first_name,last_name,profile_pic,gender,locale,timezone"
        user_info = fb_get(sender_id, {"fields": user_fields}, access_token)
        
        # 2. ดึงชื่อผู้ใช้
        user_name = user_info.get("name", "")
        if not user_name:
            user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            
        # 3. หาข้อมูล conversation และข้อความแรก
        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(100){created_time,from}",
            "user_id": sender_id,
            "limit": 1
        }
        
        conversations = fb_get(endpoint, params, access_token)
        
        # 4. หาเวลาที่ถูกต้อง
        first_interaction = None
        last_interaction = datetime.now()
        
        if conversations and "data" in conversations and conversations["data"]:
            conv = conversations["data"][0]
            
            # หาข้อความแรกที่ user ส่งมา
            if "messages" in conv and "data" in conv["messages"]:
                user_messages = [
                    msg for msg in conv["messages"]["data"] 
                    if msg.get("from", {}).get("id") == sender_id
                ]
                
                if user_messages:
                    user_messages.sort(key=lambda x: x.get("created_time", ""))
                    
                    first_msg_time = user_messages[0].get("created_time")
                    if first_msg_time:
                        try:
                            first_interaction = datetime.fromisoformat(first_msg_time.replace('Z', '+00:00'))
                        except:
                            first_interaction = datetime.now()
                    
                    last_msg_time = user_messages[-1].get("created_time")
                    if last_msg_time:
                        try:
                            last_interaction = datetime.fromisoformat(last_msg_time.replace('Z', '+00:00'))
                        except:
                            last_interaction = datetime.now()
            
            if not first_interaction and conv.get("updated_time"):
                try:
                    first_interaction = datetime.fromisoformat(conv["updated_time"].replace('Z', '+00:00'))
                except:
                    first_interaction = datetime.now()
        
        if not first_interaction:
            first_interaction = datetime.now()
        
        # 5. เตรียมข้อมูลสำหรับบันทึก
        customer_data = {
            'name': user_name or f"User...{sender_id[-8:]}",
            'first_interaction_at': first_interaction,
            'last_interaction_at': last_interaction,
            'source_type': 'new',
            'metadata': {
                'profile_pic': user_info.get('profile_pic', ''),
                'gender': user_info.get('gender'),
                'locale': user_info.get('locale'),
                'timezone': user_info.get('timezone')
            }
        }
        
        # 6. บันทึกข้อมูลลง database
        customer = crud.create_or_update_customer(db, page_db_id, sender_id, customer_data)
        
        logger.info(f"✅ Auto sync สำเร็จสำหรับ user: {user_name} ({sender_id})")
        
        # 🔥 ส่วนสำคัญ: ส่ง SSE Update ไปยัง Frontend
        from app.routes.facebook.sse import customer_type_update_queue
        
        try:
            # สร้าง update data
            update_data = {
                'page_id': page_id,
                'psid': sender_id,
                'name': user_name or f"User...{sender_id[-8:]}",
                'first_interaction': first_interaction.isoformat() if first_interaction else None,
                'last_interaction': last_interaction.isoformat() if last_interaction else None,
                'source_type': 'new',
                'action': 'new',  # ระบุว่าเป็น user ใหม่
                'timestamp': datetime.now().isoformat()
            }
            
            # ใส่เข้า queue เพื่อส่งไปยัง SSE
            await customer_type_update_queue.put(update_data)
            logger.info(f"📡 Sent SSE update for new user: {user_name}")
            
        except Exception as e:
            logger.error(f"❌ Error sending SSE update: {e}")
        
        # 7. เก็บข้อมูลการแจ้งเตือน (เดิม)
        if page_id not in new_user_notifications:
            new_user_notifications[page_id] = []
            
        new_user_notifications[page_id].append({
            'user_name': user_name,
            'psid': sender_id,
            'timestamp': datetime.now().isoformat(),
            'profile_pic': user_info.get('profile_pic', ''),
            'first_interaction': first_interaction.isoformat() if first_interaction else None
        })
        
        # ลบการแจ้งเตือนเก่า
        cutoff_time = datetime.now().timestamp() - (24 * 60 * 60)
        new_user_notifications[page_id] = [
            notif for notif in new_user_notifications[page_id]
            if datetime.fromisoformat(notif['timestamp']).timestamp() > cutoff_time
        ]
        
        return customer
        
    except Exception as e:
        logger.error(f"❌ Error syncing new user data: {e}")
        return None

# API สำหรับตรวจสอบข้อความเพื่อจัดกลุ่มลูกค้าอัตโนมัติ
def detect_customer_group(message_text, page_id):
    """ตรวจสอบข้อความเพื่อจัดกลุ่มลูกค้าอัตโนมัติ"""
    if not message_text:
        return None
    
    # ดึงข้อมูลกลุ่มทั้งหมดของเพจจาก localStorage (ผ่าน API)
    # ในการใช้งานจริง ควรเก็บข้อมูลนี้ใน database
    
    # สำหรับตอนนี้ให้ return None ก่อน
    # ในอนาคตจะต้องสร้าง API endpoint สำหรับเก็บและดึง keywords
    return None

# เพิ่มใน webhook_post function หลังจากตรวจสอบ user
async def webhook_post(
    request: Request, 
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    body = await request.json()
    
    for entry in body.get("entry", []):
        page_id = entry.get("id")
        page = crud.get_page_by_page_id(db, page_id) if page_id else None
        
        for msg_event in entry.get("messaging", []):
            sender_id = msg_event["sender"]["id"]
            
            if page and sender_id != page_id:
                try:
                    # ตรวจสอบข้อความสำหรับการจัดกลุ่ม
                    message = msg_event.get("message", {})
                    message_text = message.get("text", "")
                    
                    existing_customer = crud.get_customer_by_psid(db, page.ID, sender_id)
                    
                    if not existing_customer:
                        # User ใหม่
                        logger.info(f"🆕 พบ User ใหม่: {sender_id} ในเพจ {page.page_name}")
                        background_tasks.add_task(
                            sync_new_user_data_enhanced,
                            page_id,
                            sender_id,
                            page.ID,
                            db
                        )
                    else:
                        # User เก่า - อัพเดท interaction และตรวจสอบ keywords
                        crud.update_customer_interaction(db, page.ID, sender_id)
                        
                        # ตรวจสอบ keywords สำหรับจัดกลุ่ม
                        detected_group = detect_customer_group(message_text, page_id)
                        if detected_group:
                            # อัพเดทกลุ่มของลูกค้า
                            logger.info(f"🏷️ จัดกลุ่มลูกค้า {sender_id} ไปยังกลุ่ม {detected_group}")
                            # TODO: อัพเดทกลุ่มใน database
                    
                except Exception as e:
                    logger.error(f"❌ Error processing webhook: {e}")
    
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)