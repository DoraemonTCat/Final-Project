import asyncio
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Set, Optional
from app.database import crud
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
        self.sync_interval = 600  # sync ทุก 30 วินาที
        self.page_tokens = {}
        # เก็บ track เวลาล่าสุดที่ sync แต่ละ conversation
        self.last_sync_times: Dict[str, datetime] = {}
        # เก็บ message ID ล่าสุดที่เห็นของแต่ละ user
        self.last_seen_messages: Dict[str, str] = {}  # {user_id: last_message_id}
        
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"📌 Updated page tokens for {len(tokens)} pages")
        
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
    
    async def sync_all_pages(self):
        """Sync ข้อมูลทุกเพจ"""
        for page_id, access_token in self.page_tokens.items():
            try:
                await self.sync_page_conversations(page_id, access_token)
            except Exception as e:
                logger.error(f"❌ Error syncing page {page_id}: {e}")
                
    async def sync_page_conversations(self, page_id: str, access_token: str):
        """Sync conversations ของเพจเดียว (แบบ optimized)"""
        logger.info(f"🔄 กำลัง sync conversations สำหรับ page: {page_id}")
        
        db = SessionLocal()
        try:
            # ดึง page จาก database
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                logger.warning(f"⚠️ ไม่พบ page {page_id} ใน database")
                return
            
            # ดึง conversations พร้อมข้อความล่าสุดเพียง 1-2 ข้อความ
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(5){created_time,from,message,id}",
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
                            
                            # ตรวจสอบว่าเป็นข้อความใหม่หรือไม่
                            is_new_message = False
                            last_seen_id = self.last_seen_messages.get(participant_id)
                            
                            if msg_id != last_seen_id:
                                is_new_message = True
                                self.last_seen_messages[participant_id] = msg_id
                                logger.info(f"💬 พบข้อความใหม่จาก {participant_id}")
                            
                            # แปลงเวลาให้มี timezone
                            latest_user_message_time = self.parse_facebook_time(msg_time)
                            if not latest_user_message_time:
                                latest_user_message_time = datetime.now(utc_tz)
                        
                        # ดึงชื่อ user
                        user_name = participant.get("name")
                        if not user_name:
                            # ดึงชื่อจาก API เฉพาะเมื่อจำเป็น
                            user_info = fb_get(participant_id, {"fields": "name"}, access_token)
                            user_name = user_info.get("name", f"User...{participant_id[-8:]}")
                        
                        if not existing_customer:
                            # User ใหม่ - สร้างข้อมูล
                            logger.info(f"🆕 พบ User ใหม่: {user_name} ({participant_id})")
                            
                            # สำหรับ user ใหม่ อาจต้องดึงข้อความแรกเพิ่มเติม
                            first_interaction = await self.get_first_message_time(
                                convo_id, participant_id, access_token
                            )
                            
                            # ตรวจสอบให้แน่ใจว่าทุก datetime มี timezone
                            if not first_interaction:
                                first_interaction = latest_user_message_time or datetime.now(utc_tz)
                            
                            customer_data = {
                                'name': user_name,
                                'first_interaction_at': first_interaction,
                                'last_interaction_at': latest_user_message_time or datetime.now(utc_tz),
                                'source_type': 'new'
                            }
                            
                            crud.create_or_update_customer(db, page.ID, participant_id, customer_data)
                            new_count += 1
                            
                        elif is_new_message and latest_user_message_time:
                            # มีข้อความใหม่ - อัพเดทเฉพาะ last_interaction_at
                            # แปลง existing_customer.last_interaction_at ให้มี timezone
                            existing_last_interaction = self.make_datetime_aware(existing_customer.last_interaction_at)
                            
                            if existing_last_interaction is None or latest_user_message_time > existing_last_interaction:
                                logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {existing_customer.name}")
                                logger.info(f"   เวลาเดิม: {existing_last_interaction}")
                                logger.info(f"   เวลาใหม่: {latest_user_message_time}")
                                
                                # บันทึกเวลาแบบ naive datetime (ไม่มี timezone) ลง database
                                # แต่ให้เป็น UTC time
                                existing_customer.last_interaction_at = latest_user_message_time.replace(tzinfo=None)
                                existing_customer.updated_at = datetime.utcnow()
                                db.commit()
                                db.refresh(existing_customer)
                                updated_count += 1
            
            if new_count > 0 or updated_count > 0:
                logger.info(f"✅ Sync เสร็จสิ้น: user ใหม่ {new_count} คน, อัพเดท {updated_count} คน")
                
        except Exception as e:
            logger.error(f"❌ Error syncing page {page_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            db.close()
    
    async def get_first_message_time(self, conversation_id: str, user_id: str, access_token: str) -> Optional[datetime]:
        """ดึงเวลาข้อความแรกของ user (เฉพาะเมื่อจำเป็น)"""
        try:
            # ดึงข้อความแรกๆ ของ conversation
            endpoint = f"{conversation_id}/messages"
            params = {
                "fields": "created_time,from",
                "limit": 100,
                "order": "chronological"  # เรียงจากเก่าไปใหม่
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