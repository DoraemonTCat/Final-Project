import asyncio
from datetime import datetime, timedelta
import logging
from app.database import crud
from app.database.database import SessionLocal
from app.routes.facebook import page_tokens
from app.service.facebook_api import fb_get

logger = logging.getLogger(__name__)

class CustomerSyncService:
    def __init__(self):
        self.is_running = False
        self.sync_interval = 300  # sync ทุก 5 นาที
        
    async def start_sync_monitoring(self):
        """เริ่มระบบ sync อัตโนมัติ"""
        self.is_running = True
        logger.info("🚀 เริ่มระบบ Customer Sync อัตโนมัติ")
        
        while self.is_running:
            try:
                await self.sync_all_pages()
                await asyncio.sleep(self.sync_interval)
            except Exception as e:
                logger.error(f"❌ Error in sync monitoring: {e}")
                await asyncio.sleep(60)  # รอ 1 นาทีถ้าเกิด error
    
    async def sync_all_pages(self):
        """Sync ข้อมูลลูกค้าของทุกเพจ"""
        db = SessionLocal()
        try:
            # ดึงรายชื่อเพจทั้งหมด
            pages = db.query(crud.models.FacebookPage).all()
            
            for page in pages:
                if page.page_id in page_tokens:
                    await self.sync_page_customers(page.page_id, page.ID)
                    await asyncio.sleep(5)  # หน่วงเวลาระหว่างเพจ
                    
        except Exception as e:
            logger.error(f"❌ Error syncing pages: {e}")
        finally:
            db.close()
    
    async def sync_page_customers(self, page_id: str, page_db_id: int):
        """Sync ข้อมูลลูกค้าของเพจเดียว"""
        logger.info(f"🔄 กำลัง sync ข้อมูลลูกค้าสำหรับ page: {page_id}")
        
        access_token = page_tokens.get(page_id)
        if not access_token:
            return
        
        db = SessionLocal()
        try:
            # ดึง conversations จาก Facebook
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id",
                "limit": 100
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "error" in result:
                logger.error(f"❌ Error getting conversations: {result['error']}")
                return
            
            sync_count = 0
            conversations = result.get("data", [])
            
            for convo in conversations:
                convo_id = convo.get("id")
                updated_time = convo.get("updated_time")
                participants = convo.get("participants", {}).get("data", [])
                
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
                        # ตรวจสอบว่ามีการอัพเดทใหม่หรือไม่
                        existing_customer = crud.get_customer_by_psid(db, page_db_id, participant_id)
                        
                        # ถ้าไม่มีข้อมูลหรือมีการอัพเดทใหม่
                        should_update = False
                        if not existing_customer:
                            should_update = True
                        elif updated_time and existing_customer.last_interaction_at:
                            try:
                                fb_time = datetime.fromisoformat(updated_time.replace('Z', '+00:00'))
                                if fb_time > existing_customer.last_interaction_at:
                                    should_update = True
                            except:
                                pass
                        
                        if should_update:
                            # ดึงข้อมูล user
                            user_name = participant.get("name")
                            
                            if not user_name:
                                try:
                                    user_info = fb_get(participant_id, {"fields": "name,first_name,last_name"}, access_token)
                                    user_name = user_info.get("name", f"User...{participant_id[-8:]}")
                                except:
                                    user_name = f"User...{participant_id[-8:]}"
                            
                            # บันทึกข้อมูล
                            customer_data = {
                                'name': user_name,
                                'last_interaction_at': datetime.fromisoformat(updated_time.replace('Z', '+00:00')) if updated_time else datetime.now()
                            }
                            
                            if not existing_customer:
                                customer_data['first_interaction_at'] = customer_data['last_interaction_at']
                            
                            crud.create_or_update_customer(db, page_db_id, participant_id, customer_data)
                            sync_count += 1
            
            if sync_count > 0:
                logger.info(f"✅ Sync สำเร็จ: อัพเดท {sync_count} คนสำหรับ page {page_id}")
                
        except Exception as e:
            logger.error(f"❌ Error syncing page {page_id}: {e}")
        finally:
            db.close()
    
    def stop(self):
        """หยุดระบบ sync"""
        self.is_running = False
        logger.info("🛑 หยุดระบบ Customer Sync")

# สร้าง instance
customer_sync_service = CustomerSyncService()