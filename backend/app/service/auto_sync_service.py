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
        self.sync_interval = 15
        self.page_tokens = {}
        self.conversation_cache: Dict[str, Dict] = {}
        self.last_sync_times: Dict[str, datetime] = {}
        self.last_seen_messages: Dict[str, str] = {}
        self.user_last_interaction_cache: Dict[str, datetime] = {}
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
            batch_update_task.cancel()
            try:
                await batch_update_task
            except asyncio.CancelledError:
                pass
    
    async def process_update_queue(self):
        """ประมวลผล update queue แบบ batch"""
        while self.is_running:
            try:
                await asyncio.sleep(5)
                
                async with self.queue_lock:
                    if not self.update_queue:
                        continue
                    
                    updates_by_page: Dict[int, List[Dict]] = {}
                    for update in self.update_queue:
                        page_id = update['page_id']
                        if page_id not in updates_by_page:
                            updates_by_page[page_id] = []
                        updates_by_page[page_id].append(update)
                    
                    self.update_queue.clear()
                
                for page_id, updates in updates_by_page.items():
                    await self.batch_update_customers(page_id, updates)
                    
            except Exception as e:
                logger.error(f"Error processing update queue: {e}")
    
    async def batch_update_customers(self, page_db_id: int, updates: List[Dict]):
        """อัพเดท customers แบบ batch"""
        db = SessionLocal()
        try:
            for update in updates:
                psid = update['psid']
                customer = crud.get_customer_by_psid(db, page_db_id, psid)
                
                if customer:
                    needs_update = False
                    
                    if 'last_interaction_at' in update:
                        new_time = update['last_interaction_at']
                        if customer.last_interaction_at != new_time:
                            customer.last_interaction_at = new_time.replace(tzinfo=None)
                            needs_update = True
                    
                    if needs_update:
                        customer.updated_at = datetime.utcnow()
            
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
        """Sync conversations ของเพจเดียว"""
        db = SessionLocal()
        try:
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                return
            
            installed_at = self._get_installed_at(page)
            
            # ตรวจสอบ cache
            cache_key = f"conv_{page_id}"
            last_check = self.last_sync_times.get(cache_key)
            
            if last_check and (datetime.now(utc_tz) - last_check).total_seconds() < 10:
                await self.quick_check_updates(page, page_id, access_token, installed_at, db)
                return
            
            self.last_sync_times[cache_key] = datetime.now(utc_tz)
            
            # ดึง conversations
            conversations = await self._fetch_conversations(page_id, access_token)
            if not conversations:
                return
            
            # Process แต่ละ conversation
            stats = {'new': 0, 'updated': 0, 'status_updated': 0}
            
            for convo in conversations:
                await self._process_conversation(
                    convo, page, page_id, access_token, installed_at, db, stats
                )
            
            self._log_sync_summary(stats)
                    
        except Exception as e:
            logger.error(f"❌ Error syncing page {page_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            db.rollback()
        finally:
            db.close()
    
    def _get_installed_at(self, page) -> datetime:
        """Get และแปลง installed_at timestamp"""
        installed_at = page.created_at or datetime.now(utc_tz)
        if installed_at.tzinfo is None:
            installed_at = bangkok_tz.localize(installed_at).astimezone(utc_tz)
        else:
            installed_at = installed_at.astimezone(utc_tz)
        return installed_at
    
    async def _fetch_conversations(self, page_id: str, access_token: str) -> Optional[List]:
        """ดึง conversations จาก Facebook API"""
        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(10){created_time,from,message,id}",
            "limit": 50
        }
        
        result = fb_get(endpoint, params, access_token)
        
        if "error" in result:
            logger.error(f"❌ Error getting conversations: {result['error']}")
            return None
        
        conversations = result.get("data", [])
        
        # เก็บ cache
        self.conversation_cache[page_id] = {
            'data': conversations,
            'timestamp': datetime.now(utc_tz)
        }
        
        return conversations
    
    async def _process_conversation(self, convo: Dict, page, page_id: str, 
                                   access_token: str, installed_at: datetime, 
                                   db, stats: Dict):
        """Process แต่ละ conversation"""
        convo_id = convo.get("id")
        participants = convo.get("participants", {}).get("data", [])
        messages = convo.get("messages", {}).get("data", [])
        
        for participant in participants:
            participant_id = participant.get("id")
            if participant_id and participant_id != page_id:
                await self._process_participant(
                    participant_id, participant, messages, convo_id,
                    page, page_id, access_token, installed_at, db, stats
                )
    
    async def _process_participant(self, participant_id: str, participant: Dict,
                                   messages: List, convo_id: str, page,
                                   page_id: str, access_token: str,
                                   installed_at: datetime, db, stats: Dict):
        """Process แต่ละ participant"""
        existing_customer = crud.get_customer_by_psid(db, page.ID, participant_id)
        
        # หาข้อความล่าสุดของ user
        latest_message_info = self._get_latest_user_message(messages, participant_id)
        
        if not latest_message_info:
            return
        
        # ตรวจสอบว่าเป็นข้อความใหม่หรือไม่
        is_new_message = self._check_is_new_message(
            participant_id, 
            latest_message_info['msg_id'],
            latest_message_info['msg_time']
        )
        
        if not is_new_message:
            return
        
        # แยก logic ตามประเภท customer
        if not existing_customer:
            await self._handle_new_customer(
                participant_id, participant, convo_id, page, page_id,
                access_token, installed_at, latest_message_info['msg_time'],
                db, stats
            )
        else:
            await self._handle_existing_customer(
                existing_customer, participant_id, page, page_id,
                latest_message_info['msg_time'], db, stats
            )
    
    def _get_latest_user_message(self, messages: List, participant_id: str) -> Optional[Dict]:
        """หาข้อความล่าสุดของ user"""
        for msg in messages:
            if msg.get("from", {}).get("id") == participant_id:
                msg_id = msg.get("id")
                msg_time_str = msg.get("created_time")
                msg_time = self.parse_facebook_time(msg_time_str)
                
                if not msg_time:
                    msg_time = datetime.now(utc_tz)
                
                return {
                    'msg_id': msg_id,
                    'msg_time': msg_time,
                    'message': msg
                }
        
        return None
    
    def _check_is_new_message(self, participant_id: str, msg_id: str, 
                             msg_time: datetime) -> bool:
        """ตรวจสอบว่าเป็นข้อความใหม่หรือไม่"""
        cached_time = self.user_last_interaction_cache.get(participant_id)
        is_new = False
        
        if msg_id:
            last_seen_id = self.last_seen_messages.get(participant_id)
            if msg_id != last_seen_id:
                is_new = True
                self.last_seen_messages[participant_id] = msg_id
                self.user_last_interaction_cache[participant_id] = msg_time
                logger.info(f"💬 พบข้อความใหม่จาก {participant_id}")
        
        # ตรวจสอบว่า time เปลี่ยนแปลงหรือไม่
        if cached_time and cached_time < msg_time:
            is_new = True
        
        return is_new
    
    async def _handle_new_customer(self, participant_id: str, participant: Dict,
                                   convo_id: str, page, page_id: str,
                                   access_token: str, installed_at: datetime,
                                   latest_msg_time: datetime, db, stats: Dict):
        """จัดการ User ใหม่"""
        # ดึงข้อมูล user
        user_name, profile_pic = await self._get_user_info(
            participant_id, participant, access_token
        )
        
        logger.info(f"🆕 พบ User ใหม่: {user_name} ({participant_id})")
        
        # หาเวลาข้อความแรก
        first_interaction = await self.get_first_message_time(
            convo_id, participant_id, access_token
        )
        
        if not first_interaction:
            first_interaction = latest_msg_time
        
        # กำหนด source_type
        source_type = 'new' if first_interaction >= installed_at else 'imported'
        
        # สร้าง customer data
        customer_data = {
            'name': user_name,
            'profile_pic': profile_pic,
            'first_interaction_at': first_interaction,
            'last_interaction_at': latest_msg_time,
            'source_type': source_type
        }
        
        # บันทึกลง database
        new_customer = crud.create_or_update_customer(
            db, page.ID, participant_id, customer_data
        )
        stats['new'] += 1
        
        # สร้าง mining status
        if new_customer:
            await self._create_initial_mining_status(db, new_customer)
        
        # ส่ง SSE notification
        await self._send_new_customer_sse(
            page_id, participant_id, user_name, profile_pic, source_type
        )
    
    async def _handle_existing_customer(self, customer, participant_id: str,
                                        page, page_id: str, latest_msg_time: datetime,
                                        db, stats: Dict):
        """จัดการ User เดิม"""
        existing_last_interaction = self.make_datetime_aware(customer.last_interaction_at)
        
        # ตรวจสอบว่าต้องอัพเดทหรือไม่
        if existing_last_interaction is None or latest_msg_time > existing_last_interaction:
            logger.info(f"📝 อัพเดท last_interaction_at สำหรับ: {customer.name}")
            
            # เพิ่มเข้า queue
            async with self.queue_lock:
                self.update_queue.append({
                    'page_id': page.ID,
                    'psid': participant_id,
                    'last_interaction_at': latest_msg_time
                })
            
            stats['updated'] += 1
            
            # อัพเดท mining status ถ้าจำเป็น
            updated = await self._update_mining_status_if_needed(
                db, customer, participant_id, page_id
            )
            
            if updated:
                stats['status_updated'] += 1
    
    async def _get_user_info(self, participant_id: str, participant: Dict,
                            access_token: str) -> tuple:
        """ดึงข้อมูล user name และ profile pic"""
        user_name = participant.get("name")
        profile_pic = ""
        
        if not user_name:
            user_info = fb_get(participant_id, {"fields": "name,profile_pic"}, access_token)
            user_name = user_info.get("name", f"User...{participant_id[-8:]}")
            profile_pic = user_info.get("profile_pic", "")
        
        return user_name, profile_pic
    
    async def _create_initial_mining_status(self, db, customer):
        """สร้าง mining status เริ่มต้นสำหรับ customer ใหม่"""
        db.query(models.FBCustomerMiningStatus).filter(
            models.FBCustomerMiningStatus.customer_id == customer.id
        ).delete()
        
        initial_mining_status = models.FBCustomerMiningStatus(
            customer_id=customer.id,
            status="ยังไม่ขุด",
            note=f"New user added at {datetime.now()}"
        )
        db.add(initial_mining_status)
        db.commit()
    
    async def _send_new_customer_sse(self, page_id: str, participant_id: str,
                                     user_name: str, profile_pic: str,
                                     source_type: str):
        """ส่ง SSE notification สำหรับ customer ใหม่"""
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
    
    async def _update_mining_status_if_needed(self, db, customer,
                                              participant_id: str,
                                              page_id: str) -> bool:
        """อัพเดท mining status ถ้า customer ตอบกลับ"""
        current_mining_status = db.query(models.FBCustomerMiningStatus).filter(
            models.FBCustomerMiningStatus.customer_id == customer.id
        ).order_by(models.FBCustomerMiningStatus.created_at.desc()).first()
        
        if current_mining_status and current_mining_status.status == "ขุดแล้ว":
            # ลบ status เก่า
            db.query(models.FBCustomerMiningStatus).filter(
                models.FBCustomerMiningStatus.customer_id == customer.id
            ).delete()
            
            # สร้าง status ใหม่
            new_status = models.FBCustomerMiningStatus(
                customer_id=customer.id,
                status="มีการตอบกลับ",
                note=f"User replied via auto-sync at {datetime.now()}"
            )
            db.add(new_status)
            db.commit()
            
            logger.info(f"💬 ✅ Updated mining status to 'มีการตอบกลับ' for: {customer.name}")
            
            # ส่ง SSE
            await self._send_mining_status_sse(page_id, participant_id, customer.name)
            
            return True
        
        return False
    
    async def _send_mining_status_sse(self, page_id: str, participant_id: str,
                                      customer_name: str):
        """ส่ง SSE notification สำหรับการอัพเดท mining status"""
        try:
            from app.routes.facebook.sse import customer_type_update_queue
            
            update_data = {
                'page_id': page_id,
                'psid': participant_id,
                'name': customer_name,
                'mining_status': 'มีการตอบกลับ',
                'action': 'mining_status_update',
                'timestamp': datetime.now().isoformat()
            }
            
            await customer_type_update_queue.put(update_data)
            logger.info(f"📡 Sent SSE mining status update for: {customer_name}")
            
        except Exception as e:
            logger.error(f"Error sending SSE mining status update: {e}")
    
    def _log_sync_summary(self, stats: Dict):
        """Log สรุปผลการ sync"""
        if stats['new'] > 0 or stats['updated'] > 0 or stats['status_updated'] > 0:
            if stats['new'] > 0:
                logger.info(f"   - User ใหม่: {stats['new']} คน")
            if stats['updated'] > 0:
                logger.info(f"   - อัพเดท interaction: {stats['updated']} คน")
            if stats['status_updated'] > 0:
                logger.info(f"   - อัพเดทสถานะการขุด: {stats['status_updated']} คน")
    
    async def quick_check_updates(self, page, page_id: str, access_token: str, 
                                  installed_at: datetime, db):
        """Quick check สำหรับ updates ล่าสุด"""
        try:
            one_minute_ago = datetime.now(utc_tz) - timedelta(minutes=1)
            
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id,messages.limit(5){created_time,from,id}",
                "limit": 20
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
                        
                        for msg in messages:
                            if msg.get("from", {}).get("id") == participant_id:
                                msg_id = msg.get("id")
                                
                                last_seen_id = self.last_seen_messages.get(participant_id)
                                if msg_id != last_seen_id:
                                    self.last_seen_messages[participant_id] = msg_id
                                    
                                    msg_time = self.parse_facebook_time(msg.get("created_time"))
                                    if msg_time:
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
    
    async def get_first_message_time(self, conversation_id: str, user_id: str, 
                                    access_token: str) -> Optional[datetime]:
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