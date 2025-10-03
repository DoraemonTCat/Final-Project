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
        self.sync_interval = 15  # 🔥 ลดจาก 30 เป็น 15 วินาที
        self.page_tokens = {}
        
        # ✅ เพิ่ม cache สำหรับเก็บข้อมูล conversation ล่าสุด
        self.conversation_cache: Dict[str, Dict] = {}
        
        # เก็บ track เวลาล่าสุดที่ sync แต่ละ conversation
        self.last_sync_times: Dict[str, datetime] = {}
        
        # เก็บ message ID ล่าสุดที่เห็นของแต่ละ user
        self.last_seen_messages: Dict[str, str] = {}
        
        # 🔥 เพิ่ม: เก็บ timestamp ของ last_interaction_at แต่ละ user
        self.user_last_interaction_cache: Dict[str, datetime] = {}
        
        # 🔥 เพิ่ม: Queue สำหรับ batch update
        self.update_queue: List[Dict] = []
        self.queue_lock = asyncio.Lock()
        
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"📌 Updated page tokens for {len(tokens)} pages")
     
    def make_datetime_aware(self, dt: Optional[datetime]) -> Optional[datetime]:
        """แปลง datetime ให้มี timezone"""
        if dt is None:
            return None
        
        if dt.tzinfo is not None:
            return dt.astimezone(utc_tz)
        
        try:
            return bangkok_tz.localize(dt).astimezone(utc_tz)
        except:
            return dt.replace(tzinfo=bangkok_tz).astimezone(utc_tz)
    
    def parse_facebook_time(self, time_str: str) -> Optional[datetime]:
        """แปลง Facebook timestamp เป็น datetime with timezone"""
        if not time_str:
            return None
        
        try:
            if time_str.endswith('Z'):
                time_str = time_str[:-1] + '+00:00'
            elif '+' in time_str and ':' not in time_str[-6:]:
                time_str = time_str[:-2] + ':' + time_str[-2:]
            
            dt = datetime.fromisoformat(time_str)
            
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=utc_tz)
            
            return dt
            
        except Exception as e:
            logger.error(f"Error parsing time {time_str}: {e}")
            return None
   
    async def start_auto_sync(self):
        """เริ่มระบบ auto sync"""
        self.is_running = True
        logger.info(f"🚀 เริ่มระบบ Auto Sync - ดึงข้อมูลจาก Facebook ทุก {self.sync_interval} วินาที")
        
        # 🔥 เริ่ม background task สำหรับ batch update
        batch_update_task = asyncio.create_task(self.process_update_queue())
        
        try:
            while self.is_running:
                try:
                    await self.sync_all_pages()
                    await asyncio.sleep(self.sync_interval)
                except Exception as e:
                    logger.error(f"❌ Error in auto sync: {e}")
                    await asyncio.sleep(30)
        finally:
            # ยกเลิก batch update task เมื่อหยุด
            batch_update_task.cancel()
            try:
                await batch_update_task
            except asyncio.CancelledError:
                pass
    
    async def process_update_queue(self):
        """🔥 ใหม่: ประมวลผล update queue แบบ batch"""
        while self.is_running:
            try:
                await asyncio.sleep(5)  # รวม update ทุก 5 วินาที
                
                async with self.queue_lock:
                    if not self.update_queue:
                        continue
                    
                    # จัดกลุ่ม updates ตาม page_id
                    updates_by_page: Dict[int, List[Dict]] = {}
                    for update in self.update_queue:
                        page_id = update['page_id']
                        if page_id not in updates_by_page:
                            updates_by_page[page_id] = []
                        updates_by_page[page_id].append(update)
                    
                    # ล้าง queue
                    self.update_queue.clear()
                
                # ทำ batch update สำหรับแต่ละ page
                for page_id, updates in updates_by_page.items():
                    await self.batch_update_customers(page_id, updates)
                    
            except Exception as e:
                logger.error(f"Error processing update queue: {e}")
    
    async def batch_update_customers(self, page_db_id: int, updates: List[Dict]):
        """🔥 ใหม่: อัพเดท customers แบบ batch"""
        db = SessionLocal()
        try:
            for update in updates:
                psid = update['psid']
                customer = crud.get_customer_by_psid(db, page_db_id, psid)
                
                if customer:
                    # อัพเดทเฉพาะ field ที่เปลี่ยน
                    needs_update = False
                    
                    if 'last_interaction_at' in update:
                        new_time = update['last_interaction_at']
                        if customer.last_interaction_at != new_time:
                            customer.last_interaction_at = new_time.replace(tzinfo=None)
                            needs_update = True
                    
                    if needs_update:
                        customer.updated_at = datetime.utcnow()
            
            # Commit ทีเดียว
            db.commit()
            logger.info(f"✅ Batch updated {len(updates)} customers for page {page_db_id}")
            
        except Exception as e:
            logger.error(f"Error in batch update: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def sync_all_pages(self):
        """Sync ข้อมูลทุกเพจ"""
        tasks = []
        for page_id, access_token in self.page_tokens.items():
            task = asyncio.create_task(
                self.sync_page_conversations(page_id, access_token)
            )
            tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def sync_page_conversations(self, page_id: str, access_token: str):
        """Sync conversations ของเพจเดียว - ปรับปรุงให้เร็วขึ้น"""
        
        db = SessionLocal()
        try:
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                return
            
            installed_at = page.created_at or datetime.now(utc_tz)
            if installed_at.tzinfo is None:
                installed_at = bangkok_tz.localize(installed_at).astimezone(utc_tz)
            else:
                installed_at = installed_at.astimezone(utc_tz)
            
            # 🔥 ตรวจสอบ cache ก่อน
            cache_key = f"conv_{page_id}"
            last_check = self.last_sync_times.get(cache_key)
            
            # ถ้าเพิ่ง check ไปไม่เกิน 10 วินาที ให้ใช้ cache
            if last_check and (datetime.now(utc_tz) - last_check).total_seconds() < 10:
                # ใช้ quick check แทน
                await self.quick_check_updates(page, page_id, access_token, installed_at, db)
                return
            
            # เก็บเวลาที่ check
            self.last_sync_times[cache_key] = datetime.now(utc_tz)
            
            # ดึง conversations แบบเต็ม
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(10){created_time,from,message,id}",
                "limit": 50
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "error" in result:
                logger.error(f"❌ Error getting conversations: {result['error']}")
                return
                
            conversations = result.get("data", [])
            
            # 🔥 เก็บ cache
            self.conversation_cache[page_id] = {
                'data': conversations,
                'timestamp': datetime.now(utc_tz)
            }
            
            updated_count = 0
            new_count = 0
            status_updated_count = 0
            
            for convo in conversations:
                convo_id = convo.get("id")
                participants = convo.get("participants", {}).get("data", [])
                messages = convo.get("messages", {}).get("data", [])
                
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
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
                            
                            latest_user_message_time = self.parse_facebook_time(msg_time)
                            if not latest_user_message_time:
                                latest_user_message_time = datetime.now(utc_tz)
                            
                            # 🔥 ตรวจสอบจาก cache ก่อนว่าเป็นข้อความใหม่หรือไม่
                            cached_time = self.user_last_interaction_cache.get(participant_id)
                            is_new_message = False
                            
                            if msg_id:
                                last_seen_id = self.last_seen_messages.get(participant_id)
                                if msg_id != last_seen_id:
                                    is_new_message = True
                                    self.last_seen_messages[participant_id] = msg_id
                                    
                                    # 🔥 อัพเดท cache ทันที
                                    self.user_last_interaction_cache[participant_id] = latest_user_message_time
                                    
                                    logger.info(f"💬 พบข้อความใหม่จาก {participant_id}")
                            
                            # ถ้าเป็นข้อความใหม่ หรือ cached_time ไม่ตรงกับ latest_user_message_time
                            if is_new_message or (cached_time and cached_time < latest_user_message_time):
                                
                                # =========== User ใหม่ ===========
                                if not existing_customer:
                                    user_name = participant.get("name")
                                    if not user_name:
                                        user_info = fb_get(participant_id, {"fields": "name,profile_pic"}, access_token)
                                        user_name = user_info.get("name", f"User...{participant_id[-8:]}")
                                        profile_pic = user_info.get("profile_pic", "")
                                    else:
                                        profile_pic = ""
                                    
                                    logger.info(f"🆕 พบ User ใหม่: {user_name} ({participant_id})")
                                    
                                    first_interaction = await self.get_first_message_time(
                                        convo_id, participant_id, access_token
                                    )
                                    
                                    if not first_interaction:
                                        first_interaction = latest_user_message_time
                                    
                                    source_type = 'new' if first_interaction >= installed_at else 'imported'
                                    
                                    customer_data = {
                                        'name': user_name,
                                        'profile_pic': profile_pic,
                                        'first_interaction_at': first_interaction,
                                        'last_interaction_at': latest_user_message_time,
                                        'source_type': source_type
                                    }
                                    
                                    new_customer = crud.create_or_update_customer(db, page.ID, participant_id, customer_data)
                                    new_count += 1
                                    
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
                                    
                                    # ส่ง SSE
                                    try:
                                        from app.routes.facebook.sse import customer_type_update_queue
                                        
                                        update_data = {
                                            'page_id': page_id,
                                            'psid': participant_id,
                                            'name': user_name,
                                            'action': 'new',
                                            'timestamp': datetime.now().isoformat(),
                                            'profile_pic': profile_pic,
                                            'mining_status': 'ยังไม่ขุด',
                                            'source_type': source_type
                                        }
                                        
                                        await customer_type_update_queue.put(update_data)
                                        logger.info(f"📡 Sent SSE new user notification: {user_name} ({source_type})")
                                        
                                    except Exception as e:
                                        logger.error(f"Error sending SSE for new user: {e}")
                                
                                # =========== User เดิม ===========
                                else:
                                    existing_last_interaction = self.make_datetime_aware(existing_customer.last_interaction_at)
                                    
                                    if existing_last_interaction is None or latest_user_message_time > existing_last_interaction:
                                        logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {existing_customer.name}")
                                        
                                        # 🔥 เพิ่มเข้า queue แทนการ update ทันที
                                        async with self.queue_lock:
                                            self.update_queue.append({
                                                'page_id': page.ID,
                                                'psid': participant_id,
                                                'last_interaction_at': latest_user_message_time
                                            })
                                        
                                        updated_count += 1
                                        
                                        # ตรวจสอบและอัพเดทสถานะการขุด
                                        current_mining_status = db.query(models.FBCustomerMiningStatus).filter(
                                            models.FBCustomerMiningStatus.customer_id == existing_customer.id
                                        ).order_by(models.FBCustomerMiningStatus.created_at.desc()).first()
                                        
                                        if current_mining_status and current_mining_status.status == "ขุดแล้ว":
                                            db.query(models.FBCustomerMiningStatus).filter(
                                                models.FBCustomerMiningStatus.customer_id == existing_customer.id
                                            ).delete()
                                            
                                            new_status = models.FBCustomerMiningStatus(
                                                customer_id=existing_customer.id,
                                                status="มีการตอบกลับ",
                                                note=f"User replied via auto-sync at {datetime.now()}"
                                            )
                                            db.add(new_status)
                                            db.commit()
                                            status_updated_count += 1
                                            logger.info(f"💬 ✅ Updated mining status to 'มีการตอบกลับ' for: {existing_customer.name}")
                                            
                                            # ส่ง SSE
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
            
            # สรุปผล
            if new_count > 0 or updated_count > 0 or status_updated_count > 0:
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
    
    async def quick_check_updates(self, page, page_id: str, access_token: str, 
                                  installed_at: datetime, db):
        """🔥 ใหม่: Quick check สำหรับ updates ล่าสุด"""
        try:
            # ดึงเฉพาะ conversations ที่อัพเดทใน 1 นาทีที่ผ่านมา
            one_minute_ago = datetime.now(utc_tz) - timedelta(minutes=1)
            
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(5){created_time,from,id}",
                "limit": 20  # ลดจำนวนลง
            }
            
            result = fb_get(endpoint, params, access_token)
            if "error" in result:
                return
            
            conversations = result.get("data", [])
            
            for convo in conversations:
                updated_time = self.parse_facebook_time(convo.get("updated_time"))
                if not updated_time or updated_time < one_minute_ago:
                    continue
                
                participants = convo.get("participants", {}).get("data", [])
                messages = convo.get("messages", {}).get("data", [])
                
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
                        
                        # หาข้อความล่าสุด
                        for msg in messages:
                            if msg.get("from", {}).get("id") == participant_id:
                                msg_id = msg.get("id")
                                
                                # เช็คว่าเป็นข้อความใหม่หรือไม่
                                last_seen_id = self.last_seen_messages.get(participant_id)
                                if msg_id != last_seen_id:
                                    self.last_seen_messages[participant_id] = msg_id
                                    
                                    msg_time = self.parse_facebook_time(msg.get("created_time"))
                                    if msg_time:
                                        # เพิ่มเข้า queue
                                        async with self.queue_lock:
                                            self.update_queue.append({
                                                'page_id': page.ID,
                                                'psid': participant_id,
                                                'last_interaction_at': msg_time
                                            })
                                        
                                        logger.info(f"⚡ Quick update: {participant_id}")
                                
                                break
                                
        except Exception as e:
            logger.error(f"Error in quick check: {e}")
    
    async def get_first_message_time(self, conversation_id: str, user_id: str, access_token: str) -> Optional[datetime]:
        """ดึงเวลาข้อความแรกของ user"""
        try:
            endpoint = f"{conversation_id}/messages"
            params = {
                "fields": "created_time,from",
                "limit": 100,
                "order": "chronological"
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "data" in result:
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