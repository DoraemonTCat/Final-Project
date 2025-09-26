# backend/app/service/auto_sync_service.py
import asyncio
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Set, Optional
from app.database import crud, models
from app.database.database import SessionLocal
from app.service.facebook_api import fb_get
import pytz

logger = logging.getLogger(__name__)

# กำหนด timezone
bangkok_tz = pytz.timezone('Asia/Bangkok')
utc_tz = pytz.UTC

class AutoSyncService:
    def __init__(self):
        self.is_running = False
        self.sync_interval = 30  # sync ทุก 30 วินาที
        self.page_tokens = {}
        # เก็บ track เวลาล่าสุดที่ sync แต่ละ conversation
        self.last_sync_times: Dict[str, datetime] = {}
        # เก็บ message ID ล่าสุดที่เห็นของแต่ละ user
        self.last_seen_messages: Dict[str, str] = {}  # {user_id: last_message_id}
        
    # API สำหรับอัพเดท page tokens  
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"📌 Updated page tokens for {len(tokens)} pages")
     
    # API สำหรับแปลง datetime ให้มี timezone 
    def make_datetime_aware(self, dt: Optional[datetime]) -> Optional[datetime]:
        """แปลง datetime ให้มี timezone"""
        if dt is None:
            return None
        
        # ถ้ามี timezone แล้ว ให้แปลงเป็น UTC
        if dt.tzinfo is not None:
            return dt.astimezone(utc_tz)
        
        # ถ้าไม่มี timezone ให้ assume ว่าเป็น Bangkok time แล้วแปลงเป็น UTC
        try:
            return bangkok_tz.localize(dt).astimezone(utc_tz)
        except:
            # ถ้า localize ไม่ได้ (อาจเป็นเวลาที่ซ้ำกัน) ให้ใช้ replace
            return dt.replace(tzinfo=bangkok_tz).astimezone(utc_tz)
    
    # API สำหรับแปลงเวลาเป็น datetime with timezone
    def parse_facebook_time(self, time_str: str) -> Optional[datetime]:
        """แปลง Facebook timestamp เป็น datetime with timezone"""
        if not time_str:
            return None
        
        try:
            # Facebook ส่งมาในรูปแบบ ISO 8601 with 'Z' หรือ '+0000'
            if time_str.endswith('Z'):
                time_str = time_str[:-1] + '+00:00'
            elif '+' in time_str and ':' not in time_str[-6:]:
                # แก้ format จาก +0700 เป็น +07:00
                time_str = time_str[:-2] + ':' + time_str[-2:]
            
            dt = datetime.fromisoformat(time_str)
            
            # ถ้ายังไม่มี timezone ให้ assume ว่าเป็น UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=utc_tz)
            
            return dt
            
        except Exception as e:
            logger.error(f"Error parsing time {time_str}: {e}")
            return None
   
    # API สำหรับค้นหารายชื่อใน database   
    async def start_auto_sync(self):
        """เริ่มระบบ auto sync"""
        self.is_running = True
        logger.info("🚀 เริ่มระบบ Auto Sync - ดึงข้อมูลจาก Facebook ทุก 30 วินาที")
        
        while self.is_running:
            try:
                await self.sync_all_pages()
                await asyncio.sleep(self.sync_interval)
            except Exception as e:
                logger.error(f"❌ Error in auto sync: {e}")
                await asyncio.sleep(30)
    
    # API สำหรับดึงข้อมูลลูกค้าแบบ real-time ผ่าน Server-Sent Events (SSE)            
    async def sync_all_pages(self):
        """Sync ข้อมูลทุกเพจ"""
        for page_id, access_token in self.page_tokens.items():
            try:
                await self.sync_page_conversations(page_id, access_token)
            except Exception as e:
                logger.error(f"❌ Error syncing page {page_id}: {e}")
    
   # API สำหรับ sync ข้อมูล conversations ของเพจเดียว
    async def sync_page_conversations(self, page_id: str, access_token: str):
        """Sync conversations ของเพจเดียว - ทั้ง user ใหม่และอัพเดทสถานะการขุด"""
        logger.info(f"🔄 กำลัง sync conversations สำหรับ page: {page_id}")
        
        db = SessionLocal()
        try:
            # ดึง page จาก database
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                logger.warning(f"⚠️ ไม่พบ page {page_id} ใน database")
                return
            
            # ดึง conversations พร้อมข้อความล่าสุด
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(10){created_time,from,message,id}",
                "limit": 50  # ดึง 50 conversations ล่าสุด
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "error" in result:
                logger.error(f"❌ Error getting conversations: {result['error']}")
                return
                
            conversations = result.get("data", [])
            logger.info(f"📊 พบ {len(conversations)} conversations")
            
            updated_count = 0
            new_count = 0
            status_updated_count = 0
            
            for convo in conversations:
                convo_id = convo.get("id")
                updated_time = convo.get("updated_time")
                participants = convo.get("participants", {}).get("data", [])
                messages = convo.get("messages", {}).get("data", [])
                
                # ตรวจสอบแต่ละ participant
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
                        # ตรวจสอบว่ามี customer ในระบบหรือไม่
                        existing_customer = crud.get_customer_by_psid(db, page.ID, participant_id)
                        
                        # หาข้อความล่าสุดของ user
                        latest_user_message = None
                        latest_user_message_time = None
                        
                        for msg in messages:
                            if msg.get("from", {}).get("id") == participant_id:
                                latest_user_message = msg
                                break
                        
                        if latest_user_message:
                            msg_id = latest_user_message.get("id")
                            msg_time = latest_user_message.get("created_time")
                            
                            # แปลงเวลาให้มี timezone
                            latest_user_message_time = self.parse_facebook_time(msg_time)
                            if not latest_user_message_time:
                                latest_user_message_time = datetime.now(utc_tz)
                            
                            # เก็บ message ID ล่าสุด
                            is_new_message = False
                            last_seen_id = self.last_seen_messages.get(participant_id)
                            
                            if msg_id and msg_id != last_seen_id:
                                is_new_message = True
                                self.last_seen_messages[participant_id] = msg_id
                                logger.info(f"💬 พบข้อความใหม่จาก {participant_id}")
                        
                        # =========== กรณี 1: User ใหม่ ===========
                        if not existing_customer:
                            # ดึงชื่อ user
                            user_name = participant.get("name")
                            if not user_name:
                                user_info = fb_get(participant_id, {"fields": "name,profile_pic"}, access_token)
                                user_name = user_info.get("name", f"User...{participant_id[-8:]}")
                                profile_pic = user_info.get("profile_pic", "")
                            else:
                                profile_pic = ""
                            
                            logger.info(f"🆕 พบ User ใหม่: {user_name} ({participant_id})")
                            
                            # ดึงข้อความแรกถ้าจำเป็น
                            first_interaction = await self.get_first_message_time(
                                convo_id, participant_id, access_token
                            )
                            
                            if not first_interaction:
                                first_interaction = latest_user_message_time or datetime.now(utc_tz)
                            
                            customer_data = {
                                'name': user_name,
                                'profile_pic': profile_pic,
                                'first_interaction_at': first_interaction,
                                'last_interaction_at': latest_user_message_time or datetime.now(utc_tz),
                                'source_type': 'new'
                            }
                            
                            new_customer = crud.create_or_update_customer(db, page.ID, participant_id, customer_data)
                            new_count += 1
                            
                            # ลบสถานะการขุดเก่า (ถ้ามี) และสร้างสถานะการขุดเริ่มต้น
                            if new_customer:
                                db.query(models.FBCustomerMiningStatus).filter(
                                    models.FBCustomerMiningStatus.customer_id == new_customer.id
                                ).delete()
                                
                                initial_mining_status = models.FBCustomerMiningStatus(
                                    customer_id=new_customer.id,
                                    status="ยังไม่ขุด",
                                    note=f"New user added at {datetime.now()}"
                                )
                                db.add(initial_mining_status)
                                db.commit()
                            
                            # ส่ง SSE notification สำหรับ user ใหม่
                            try:
                                from app.routes.facebook.sse import customer_type_update_queue
                                
                                update_data = {
                                    'page_id': page_id,
                                    'psid': participant_id,
                                    'name': user_name,
                                    'action': 'new',
                                    'timestamp': datetime.now().isoformat(),
                                    'profile_pic': profile_pic,
                                    'mining_status': 'ยังไม่ขุด'
                                }
                                
                                await customer_type_update_queue.put(update_data)
                                logger.info(f"📡 Sent SSE new user notification for: {user_name}")
                                
                            except Exception as e:
                                logger.error(f"Error sending SSE for new user: {e}")
                        
                        # =========== กรณี 2: User เดิมมีข้อความใหม่ ===========
                        elif is_new_message and latest_user_message_time:
                            # อัพเดท last_interaction_at
                            existing_last_interaction = self.make_datetime_aware(existing_customer.last_interaction_at)
                            
                            if existing_last_interaction is None or latest_user_message_time > existing_last_interaction:
                                logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {existing_customer.name}")
                                
                                existing_customer.last_interaction_at = latest_user_message_time.replace(tzinfo=None)
                                existing_customer.updated_at = datetime.utcnow()
                                db.commit()
                                db.refresh(existing_customer)
                                updated_count += 1
                                
                                # ⭐ ตรวจสอบและอัพเดทสถานะการขุด
                                current_mining_status = db.query(models.FBCustomerMiningStatus).filter(
                                    models.FBCustomerMiningStatus.customer_id == existing_customer.id
                                ).order_by(models.FBCustomerMiningStatus.created_at.desc()).first()
                                
                                # ถ้าสถานะปัจจุบันคือ "ขุดแล้ว" ให้เปลี่ยนเป็น "มีการตอบกลับ"
                                if current_mining_status and current_mining_status.status == "ขุดแล้ว":
                                    # ลบสถานะเก่าทั้งหมด
                                    db.query(models.FBCustomerMiningStatus).filter(
                                        models.FBCustomerMiningStatus.customer_id == existing_customer.id
                                    ).delete()
                                    
                                    # เพิ่มสถานะใหม่
                                    new_status = models.FBCustomerMiningStatus(
                                        customer_id=existing_customer.id,
                                        status="มีการตอบกลับ",
                                        note=f"User replied via auto-sync at {datetime.now()}"
                                    )
                                    db.add(new_status)
                                    db.commit()
                                    status_updated_count += 1
                                    logger.info(f"💬 ✅ Updated mining status to 'มีการตอบกลับ' for: {existing_customer.name} (deleted old records)")
                                    
                                    # ส่ง SSE update สำหรับสถานะการขุด
                                    try:
                                        from app.routes.facebook.sse import customer_type_update_queue
                                        
                                        update_data = {
                                            'page_id': page_id,
                                            'psid': participant_id,
                                            'name': existing_customer.name,
                                            'mining_status': 'มีการตอบกลับ',
                                            'action': 'mining_status_update',
                                            'timestamp': datetime.now().isoformat()
                                        }
                                        
                                        await customer_type_update_queue.put(update_data)
                                        logger.info(f"📡 Sent SSE mining status update for: {existing_customer.name}")
                                        
                                    except Exception as e:
                                        logger.error(f"Error sending SSE mining status update: {e}")
            
            # สรุปผลการ sync
            if new_count > 0 or updated_count > 0 or status_updated_count > 0:
                logger.info(f"✅ Sync เสร็จสิ้น:")
                if new_count > 0:
                    logger.info(f"   - User ใหม่: {new_count} คน")
                if updated_count > 0:
                    logger.info(f"   - อัพเดท interaction: {updated_count} คน")
                if status_updated_count > 0:
                    logger.info(f"   - อัพเดทสถานะการขุด: {status_updated_count} คน")
                
        except Exception as e:
            logger.error(f"❌ Error syncing page {page_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            db.rollback()
        finally:
            db.close()
    
     # API สำหรับดึงข้อความแรกของ user (เฉพาะเมื่อจำเป็น)
    async def get_first_message_time(self, conversation_id: str, user_id: str, access_token: str) -> Optional[datetime]:
        """ดึงเวลาข้อความแรกของ user"""
        try:
             # ดึงข้อความแรกๆ ของ conversation
            endpoint = f"{conversation_id}/messages"
            params = {
                "fields": "created_time,from",
                "limit": 100,
                "order": "chronological" # เรียงจากเก่าไปใหม่
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "data" in result:
                # หาข้อความแรกของ user
                for msg in result["data"]:
                    if msg.get("from", {}).get("id") == user_id:
                        time_str = msg.get("created_time")
                        if time_str:
                            return self.parse_facebook_time(time_str)
            
            return None
            
        except Exception as e:
            logger.error(f"⚠️ Error getting first message time: {e}")
            return None
    
    def stop(self):
        """หยุดระบบ auto sync"""
        self.is_running = False
        logger.info("🛑 หยุดระบบ Auto Sync")

# สร้าง instance
auto_sync_service = AutoSyncService()