import asyncio
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Set
from app.database import crud
from app.database.database import SessionLocal
from app.service.facebook_api import fb_get

logger = logging.getLogger(__name__)

class AutoSyncService:
    def __init__(self):
        self.is_running = False
        self.sync_interval = 10  # sync ทุก 10 วินาที
        self.page_tokens = {}
        # เก็บ track เวลาล่าสุดที่ sync แต่ละ conversation
        self.last_sync_times: Dict[str, datetime] = {}
        # เก็บ message IDs ที่เคยเห็นแล้ว
        self.seen_messages: Dict[str, Set[str]] = {}
        
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"📌 Updated page tokens for {len(tokens)} pages")
        
    async def start_auto_sync(self):
        """เริ่มระบบ auto sync"""
        self.is_running = True
        logger.info("🚀 เริ่มระบบ Auto Sync - ดึงข้อมูลจาก Facebook ทุก 10 วินาที")
        
        while self.is_running:
            try:
                await self.sync_all_pages()
                await asyncio.sleep(self.sync_interval)
            except Exception as e:
                logger.error(f"❌ Error in auto sync: {e}")
                await asyncio.sleep(30)  # รอ 30 วินาทีถ้าเกิด error
    
    async def sync_all_pages(self):
        """Sync ข้อมูลทุกเพจ"""
        for page_id, access_token in self.page_tokens.items():
            try:
                await self.sync_page_conversations(page_id, access_token)
            except Exception as e:
                logger.error(f"❌ Error syncing page {page_id}: {e}")
                
    async def sync_page_conversations(self, page_id: str, access_token: str):
        """Sync conversations ของเพจเดียว"""
        logger.info(f"🔄 กำลัง sync conversations สำหรับ page: {page_id}")
        
        db = SessionLocal()
        try:
            # ดึง page จาก database
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                logger.warning(f"⚠️ ไม่พบ page {page_id} ใน database")
                return
                
            # ดึง conversations จาก Facebook
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(20){created_time,from,message,id}",
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
                
                # Initialize seen messages for this conversation
                if convo_id not in self.seen_messages:
                    self.seen_messages[convo_id] = set()
                
                # ตรวจสอบแต่ละ participant
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
                        # ตรวจสอบว่ามี customer ในระบบหรือไม่
                        existing_customer = crud.get_customer_by_psid(db, page.ID, participant_id)
                        
                        # หาข้อความล่าสุดของ user (ไม่ใช่ page)
                        user_messages = [
                            msg for msg in messages 
                            if msg.get("from", {}).get("id") == participant_id
                        ]
                        
                        # ตรวจสอบว่ามีข้อความใหม่หรือไม่
                        has_new_message = False
                        latest_user_message_time = None
                        
                        if user_messages:
                            # เรียงตามเวลา
                            user_messages.sort(key=lambda x: x.get("created_time", ""), reverse=True)
                            latest_msg = user_messages[0]
                            msg_id = latest_msg.get("id")
                            
                            # ตรวจสอบว่าเคยเห็น message นี้หรือยัง
                            if msg_id and msg_id not in self.seen_messages[convo_id]:
                                has_new_message = True
                                self.seen_messages[convo_id].add(msg_id)
                                logger.info(f"💬 พบข้อความใหม่จาก {participant_id}: {latest_msg.get('message', '')[:50]}...")
                            
                            # อัพเดทเวลาล่าสุด
                            try:
                                latest_user_message_time = datetime.fromisoformat(
                                    latest_msg.get("created_time", "").replace('Z', '+00:00')
                                )
                            except:
                                latest_user_message_time = datetime.now()
                        
                        # ดึงชื่อ user
                        user_name = participant.get("name")
                        if not user_name:
                            user_info = fb_get(participant_id, {"fields": "name,first_name,last_name"}, access_token)
                            user_name = user_info.get("name", f"User...{participant_id[-8:]}")
                        
                        if not existing_customer:
                            # User ใหม่ - สร้างข้อมูล
                            logger.info(f"🆕 พบ User ใหม่: {user_name} ({participant_id})")
                            
                            # หาเวลาข้อความแรก
                            first_interaction = latest_user_message_time or datetime.now()
                            if user_messages:
                                # หาข้อความแรกสุด
                                first_msg = user_messages[-1]
                                try:
                                    first_interaction = datetime.fromisoformat(
                                        first_msg.get("created_time", "").replace('Z', '+00:00')
                                    )
                                except:
                                    pass
                            
                            customer_data = {
                                'name': user_name,
                                'first_interaction_at': first_interaction,
                                'last_interaction_at': latest_user_message_time or datetime.now(),
                                'source_type': 'new'
                            }
                            
                            crud.create_or_update_customer(db, page.ID, participant_id, customer_data)
                            new_count += 1
                            
                        elif has_new_message and latest_user_message_time:
                            # มีข้อความใหม่ - อัพเดท last_interaction_at
                            logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {existing_customer.name}")
                            logger.info(f"   เวลาเดิม: {existing_customer.last_interaction_at}")
                            logger.info(f"   เวลาใหม่: {latest_user_message_time}")
                            
                            # อัพเดทเวลาโดยตรง
                            existing_customer.last_interaction_at = latest_user_message_time
                            existing_customer.updated_at = datetime.now()
                            db.commit()
                            db.refresh(existing_customer)
                            updated_count += 1
                            
                            logger.info(f"✅ อัพเดทสำเร็จ - last_interaction_at ใหม่: {existing_customer.last_interaction_at}")
                        
                        # เก็บข้อความทั้งหมดที่เห็นแล้ว
                        for msg in messages:
                            msg_id = msg.get("id")
                            if msg_id:
                                self.seen_messages[convo_id].add(msg_id)
            
            if new_count > 0 or updated_count > 0:
                logger.info(f"✅ Sync เสร็จสิ้น: user ใหม่ {new_count} คน, อัพเดท {updated_count} คน")
                
        except Exception as e:
            logger.error(f"❌ Error syncing page {page_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            db.close()
            
    def stop(self):
        """หยุดระบบ auto sync"""
        self.is_running = False
        logger.info("🛑 หยุดระบบ Auto Sync")

# สร้าง instance
auto_sync_service = AutoSyncService()