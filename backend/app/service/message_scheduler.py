import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Set
import logging
from app.service.facebook_api import send_message, send_image_binary_from_db, send_video_binary
from app.database import crud
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
import json
from app.routes.facebook.sse import send_customer_type_update
from app.database import models
from app.utils.redis_helper import get_page_token

logger = logging.getLogger(__name__)

class MessageScheduler:
    def __init__(self):
        self.active_schedules: Dict[str, List[Dict[str, Any]]] = {}
        self.is_running = False
        self.page_tokens = {}
        # แยก tracking สำหรับแต่ละประเภท
        self.sent_tracking: Dict[str, Set[str]] = {}
        self.last_check_time: Dict[int, datetime] = {}
        self.user_inactivity_data: Dict[str, Dict[str, Any]] = {}
        
        # แยก schedules ตามประเภท
        self.user_group_schedules: Dict[str, List[Dict[str, Any]]] = {}
        self.knowledge_group_schedules: Dict[str, List[Dict[str, Any]]] = {}
        
        # แยก tasks สำหรับแต่ละประเภท
        self.user_group_task = None
        self.knowledge_group_task = None
    
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"Updated page tokens for {len(tokens)} pages")
    
    def update_user_inactivity_data(self, page_id: str, user_data: List[Dict[str, Any]]):
        """อัพเดทข้อมูลระยะเวลาที่หายไปของ users จาก frontend"""
        if page_id not in self.user_inactivity_data:
            self.user_inactivity_data[page_id] = {}
        
        for data in user_data:
            user_id = data.get('user_id')
            last_message_time = data.get('last_message_time')
            inactivity_minutes = data.get('inactivity_minutes', 0)
            
            if user_id:
                self.user_inactivity_data[page_id][user_id] = {
                    'last_message_time': last_message_time,
                    'inactivity_minutes': inactivity_minutes,
                    'updated_at': datetime.now()
                }
        
        logger.info(f"Updated inactivity data for {len(user_data)} users on page {page_id}")
    
    def add_schedule(self, page_id: str, schedule: Dict[str, Any]):
        """เพิ่ม schedule เข้าระบบโดยแยกตามประเภท"""
        if page_id not in self.active_schedules:
            self.active_schedules[page_id] = []
            self.user_group_schedules[page_id] = []
            self.knowledge_group_schedules[page_id] = []
        
        # ตรวจสอบประเภทของ schedule
        groups = schedule.get('groups', [])
        is_knowledge_group = any(str(g).startswith('knowledge_') for g in groups)
        
        # ตรวจสอบว่ามี schedule นี้อยู่แล้วหรือไม่
        existing = next((s for s in self.active_schedules[page_id] if s['id'] == schedule['id']), None)
        if existing:
            # อัพเดท schedule ที่มีอยู่
            existing.update(schedule)
            # อัพเดทใน list ที่แยกตามประเภทด้วย
            if is_knowledge_group:
                for s in self.knowledge_group_schedules[page_id]:
                    if s['id'] == schedule['id']:
                        s.update(schedule)
                        break
            else:
                for s in self.user_group_schedules[page_id]:
                    if s['id'] == schedule['id']:
                        s.update(schedule)
                        break
        else:
            # เพิ่ม schedule ใหม่
            schedule['activated_at'] = datetime.now().isoformat()
            self.active_schedules[page_id].append(schedule)
            
            # เพิ่มเข้า list ที่แยกตามประเภท
            if is_knowledge_group:
                self.knowledge_group_schedules[page_id].append(schedule)
                logger.info(f"Added KNOWLEDGE schedule {schedule['id']} for page {page_id}")
            else:
                self.user_group_schedules[page_id].append(schedule)
                logger.info(f"Added USER schedule {schedule['id']} for page {page_id}")
            
            # เริ่ม tracking สำหรับ schedule ใหม่
            self.sent_tracking[str(schedule['id'])] = set()
    
    def remove_schedule(self, page_id: str, schedule_id: int):
        """ลบ schedule ออกจากระบบ"""
        if page_id in self.active_schedules:
            # ลบจาก active schedules
            self.active_schedules[page_id] = [
                s for s in self.active_schedules[page_id] if s['id'] != schedule_id
            ]
            
            # ลบจาก user group schedules
            self.user_group_schedules[page_id] = [
                s for s in self.user_group_schedules.get(page_id, []) if s['id'] != schedule_id
            ]
            
            # ลบจาก knowledge group schedules
            self.knowledge_group_schedules[page_id] = [
                s for s in self.knowledge_group_schedules.get(page_id, []) if s['id'] != schedule_id
            ]
            
            # ลบ tracking data
            self.sent_tracking.pop(str(schedule_id), None)
            self.last_check_time.pop(schedule_id, None)
            logger.info(f"Removed schedule {schedule_id} for page {page_id}")
    
    async def start_schedule_monitoring(self):
        """เริ่มระบบตรวจสอบ schedule แบบแยก tasks"""
        self.is_running = True
        logger.info("Message scheduler started with separate tasks")
        
        # สร้าง tasks แยกสำหรับแต่ละประเภท
        self.user_group_task = asyncio.create_task(self.monitor_user_groups())
        self.knowledge_group_task = asyncio.create_task(self.monitor_knowledge_groups())
        
        # รอให้ทั้งสอง tasks ทำงาน
        try:
            await asyncio.gather(self.user_group_task, self.knowledge_group_task)
        except Exception as e:
            logger.error(f"Error in schedule monitoring: {e}")
    
    async def monitor_user_groups(self):
        """Monitor เฉพาะ User Group schedules"""
        logger.info("🟦 User Groups Monitor started")
        while self.is_running:
            try:
                current_time = datetime.now()
                logger.debug(f"🟦 Checking User Group schedules at {current_time}")
                
                for page_id, schedules in self.user_group_schedules.items():
                    for schedule in schedules:
                        try:
                            await self.check_schedule(page_id, schedule, current_time, "USER")
                        except Exception as e:
                            logger.error(f"Error checking user schedule {schedule['id']}: {e}")
                
                # User groups check ทุก 30 วินาที
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in user group monitoring: {e}")
                await asyncio.sleep(30)
    
    async def monitor_knowledge_groups(self):
        """Monitor เฉพาะ Knowledge Group schedules"""
        logger.info("🟩 Knowledge Groups Monitor started")
        while self.is_running:
            try:
                current_time = datetime.now()
                logger.debug(f"🟩 Checking Knowledge Group schedules at {current_time}")
                
                for page_id, schedules in self.knowledge_group_schedules.items():
                    for schedule in schedules:
                        try:
                            await self.check_schedule(page_id, schedule, current_time, "KNOWLEDGE")
                        except Exception as e:
                            logger.error(f"Error checking knowledge schedule {schedule['id']}: {e}")
                
                # Knowledge groups check ทุก 30 วินาที (หรือปรับตามต้องการ)
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in knowledge group monitoring: {e}")
                await asyncio.sleep(30)
    
    async def check_schedule(self, page_id: str, schedule: Dict[str, Any], current_time: datetime, group_type: str = ""):
        """ตรวจสอบแต่ละ schedule พร้อมแสดงประเภท"""
        schedule_type = schedule.get('type')
        schedule_id = str(schedule['id'])
        
        # Log เพื่อแสดงว่ากำลังตรวจสอบ schedule ประเภทไหน
        logger.debug(f"[{group_type}] Checking schedule {schedule_id} type: {schedule_type}")
        
        if schedule_type == 'immediate':
            # ส่งทันทีถ้ายังไม่เคยส่ง
            if not schedule.get('sent'):
                await self.process_schedule(page_id, schedule, group_type)
                schedule['sent'] = True
                
        elif schedule_type == 'scheduled':
            await self.check_scheduled_time(page_id, schedule, current_time, group_type)
            
        elif schedule_type == 'user-inactive':
            # ป้องกันการตรวจสอบถี่เกินไป - ตรวจสอบทุก 30 วินาที
            last_check = self.last_check_time.get(schedule['id'])
            if last_check and (current_time - last_check).seconds < 30:
                return

            self.last_check_time[schedule['id']] = current_time
            await self.check_user_inactivity_v2(page_id, schedule, group_type)
    
    async def check_scheduled_time(self, page_id: str, schedule: Dict[str, Any], current_time: datetime, group_type: str = ""):
        """ตรวจสอบการส่งตามเวลาที่กำหนด"""
        schedule_date = schedule.get('date')
        schedule_time = schedule.get('time')
        
        if not schedule_date or not schedule_time:
            return
            
        # แปลงเป็น datetime
        schedule_datetime = datetime.strptime(f"{schedule_date} {schedule_time}", "%Y-%m-%d %H:%M")
        
        # ตรวจสอบว่าเวลาปัจจุบันอยู่ในช่วงเวลาที่กำหนด
        time_diff = abs((current_time - schedule_datetime).total_seconds())
        
        if time_diff <= 30:  # ถ้าอยู่ในช่วง 30 วินาทีของเวลาที่กำหนด
            # ตรวจสอบว่าส่งไปแล้วหรือยัง
            last_sent = schedule.get('last_sent')
            if last_sent:
                try:
                    last_sent_time = datetime.fromisoformat(last_sent)
                    if (current_time - last_sent_time).total_seconds() < 3600:  # ส่งไปแล้วในชั่วโมงที่ผ่านมา
                        return
                except:
                    pass
                    
            logger.info(f"[{group_type}] Processing scheduled message for page {page_id} at {current_time}")
            
            # ส่งข้อความ
            await self.process_schedule(page_id, schedule, group_type)
            
            # อัพเดทเวลาที่ส่งล่าสุด
            schedule['last_sent'] = current_time.isoformat()
            
            # ตรวจสอบการทำซ้ำ
            await self.handle_repeat(page_id, schedule, current_time)
    
    async def check_user_inactivity_v2(self, page_id: str, schedule: Dict[str, Any], group_type: str = ""):
        """ตรวจสอบ user ที่หายไปโดยใช้ข้อมูลจาก frontend พร้อมแสดงประเภท"""
        try:
            inactivity_period = int(schedule.get('inactivityPeriod', 1))
            inactivity_unit = schedule.get('inactivityUnit', 'days')
            schedule_id = str(schedule['id'])
            groups = schedule.get('groups', [])

            # แปลงหน่วยเวลาเป็นนาที
            if inactivity_unit == 'minutes':
                target_minutes = inactivity_period
            elif inactivity_unit == 'hours':
                target_minutes = inactivity_period * 60
            elif inactivity_unit == 'days':
                target_minutes = inactivity_period * 24 * 60
            elif inactivity_unit == 'weeks':
                target_minutes = inactivity_period * 7 * 24 * 60
            else:  # months
                target_minutes = inactivity_period * 30 * 24 * 60

            logger.info(f"[{group_type}] Checking inactivity for schedule {schedule_id}: target={target_minutes} minutes")

            # ดึงข้อมูล inactivity ของ page นี้
            page_inactivity_data = self.user_inactivity_data.get(page_id, {})
            if not page_inactivity_data:
                logger.warning(f"[{group_type}] No inactivity data for page {page_id}")
                await self.update_inactivity_from_conversations(page_id)
                page_inactivity_data = self.user_inactivity_data.get(page_id, {})

            # ดึง access token
            access_token = get_page_token(page_id)
            if not access_token:
                logger.warning(f"No access token for page {page_id}")
                return

            # 🔥 เพิ่มการตรวจสอบ users ที่อยู่ในกลุ่ม knowledge
            db = SessionLocal()
            try:
                # หา page record
                page = crud.get_page_by_page_id(db, page_id)
                if not page:
                    logger.error(f"Page {page_id} not found")
                    return

                # ตรวจสอบว่าเป็น knowledge group หรือไม่
                knowledge_group_ids = []
                for group_id in groups:
                    if str(group_id).startswith('knowledge_'):
                        knowledge_id = int(str(group_id).replace('knowledge_', ''))
                        knowledge_group_ids.append(knowledge_id)

                inactive_users = []
                sent_users = self.sent_tracking.get(schedule_id, set())

                # ตรวจสอบแต่ละ user
                for user_id, user_data in page_inactivity_data.items():
                    # ตรวจสอบว่าเคยส่งให้ user นี้แล้วหรือยัง
                    if user_id in sent_users:
                        continue

                    # ดึงระยะเวลาที่หายไป (เป็นนาที)
                    user_inactivity_minutes = user_data.get('inactivity_minutes', 0)

                    # ตรวจสอบว่าอยู่ในช่วงที่ตรงกับเงื่อนไข
                    tolerance = target_minutes * 0.02  # 2% ของเป้าหมาย
                    min_tolerance = max(0.2, tolerance)
                    
                    lower_bound = target_minutes - min_tolerance
                    upper_bound = target_minutes + min_tolerance
                    
                    if lower_bound <= user_inactivity_minutes <= upper_bound:
                        # 🔥 ถ้าเป็น knowledge group ต้องตรวจสอบว่า user อยู่ในกลุ่มหรือไม่
                        if knowledge_group_ids:
                            customer = crud.get_customer_by_psid(db, page.ID, user_id)
                            if not customer:
                                logger.debug(f"[{group_type}] User {user_id} not found in database")
                                continue
                            
                            # ตรวจสอบว่า customer อยู่ใน knowledge group ที่ต้องการหรือไม่
                            if not customer.current_category_id or customer.current_category_id not in knowledge_group_ids:
                                logger.info(f"[{group_type}] User {user_id} not in knowledge group {knowledge_group_ids}, skipping")
                                continue
                            
                            logger.info(f"[{group_type}] User {user_id} is in knowledge group {customer.current_category_id}")
                        
                        inactive_users.append(user_id)
                        logger.info(f"[{group_type}] User {user_id} matches: {user_inactivity_minutes} min (target: {target_minutes}±{min_tolerance})")

                # ส่งข้อความให้ users ที่ตรงเงื่อนไข
                if inactive_users:
                    logger.info(f"[{group_type}] Found {len(inactive_users)} inactive users for schedule {schedule['id']}")
                    await self.send_messages_to_users(page_id, inactive_users, schedule['messages'], access_token, schedule, group_type)

                    # เพิ่ม users ที่ส่งแล้วเข้า tracking
                    self.sent_tracking[schedule_id].update(inactive_users)
                    schedule['last_sent'] = datetime.now().isoformat()

            finally:
                db.close()

        except Exception as e:
            logger.error(f"[{group_type}] Error checking user inactivity: {e}")
    
    async def process_schedule(self, page_id: str, schedule: Dict[str, Any], group_type: str = ""):
        """ประมวลผลและส่งข้อความตาม schedule พร้อมแสดงประเภท"""
        try:
            groups = schedule.get('groups', [])
            messages = schedule.get('messages', [])
            schedule_id = str(schedule['id'])
            
            logger.info(f"[{group_type}] Processing schedule {schedule_id}: groups={groups}, messages={len(messages)}")
            
            if not groups or not messages:
                logger.warning(f"[{group_type}] No groups or messages in schedule {schedule['id']}")
                return
                
            # ดึง access token
            access_token = get_page_token(page_id)
            if not access_token:
                logger.warning(f"No access token for page {page_id}")
                return
            
            # 🔥 ตรวจสอบประเภทกลุ่ม
            knowledge_group_ids = []
            for group_id in groups:
                if str(group_id).startswith('knowledge_'):
                    knowledge_id = int(str(group_id).replace('knowledge_', ''))
                    knowledge_group_ids.append(knowledge_id)
            
            # ถ้าเป็น knowledge group ต้องดึงเฉพาะ users ที่อยู่ในกลุ่ม
            if knowledge_group_ids:
                db = SessionLocal()
                try:
                    page = crud.get_page_by_page_id(db, page_id)
                    if not page:
                        logger.error(f"Page {page_id} not found")
                        return
                    
                    # ดึง customers ที่อยู่ใน knowledge group
                    customers = db.query(models.FbCustomer).filter(
                        models.FbCustomer.page_id == page.ID,
                        models.FbCustomer.current_category_id.in_(knowledge_group_ids)
                    ).all()
                    
                    all_psids = [customer.customer_psid for customer in customers]
                    logger.info(f"[{group_type}] Found {len(all_psids)} users in knowledge groups {knowledge_group_ids}")
                    
                finally:
                    db.close()
            else:
                # กรณีเดิม - ดึงจาก conversations
                from app.service.facebook_api import fb_get
                
                endpoint = f"{page_id}/conversations"
                params = {
                    "fields": "participants,updated_time,id",
                    "limit": 100
                }
                
                conversations = fb_get(endpoint, params, access_token)
                if "error" in conversations:
                    logger.error(f"Error getting conversations: {conversations['error']}")
                    return
                    
                # รวบรวม PSIDs ทั้งหมด
                all_psids = []
                sent_users = self.sent_tracking.get(schedule_id, set())
                
                for conv in conversations.get('data', []):
                    participants = conv.get('participants', {}).get('data', [])
                    for participant in participants:
                        user_id = participant.get('id')
                        if user_id and user_id != page_id and user_id not in sent_users:
                            all_psids.append(user_id)
            
            # กรอง users ที่ส่งแล้ว
            sent_users = self.sent_tracking.get(schedule_id, set())
            filtered_psids = [psid for psid in all_psids if psid not in sent_users]
            
            if filtered_psids:
                logger.info(f"[{group_type}] Sending messages to {len(filtered_psids)} users")
                await self.send_messages_to_users(page_id, filtered_psids, messages, access_token, schedule, group_type)
                self.sent_tracking[schedule_id].update(filtered_psids)
            else:
                logger.warning(f"[{group_type}] No users found to send messages")
            
        except Exception as e:
            logger.error(f"[{group_type}] Error processing schedule: {e}")
    
    async def send_messages_to_users(self, page_id: str, psids: List[str], messages: List[Dict], 
                                access_token: str, schedule: Dict[str, Any] = None, group_type: str = ""):
        """ส่งข้อความไปยัง users พร้อมอัพเดท customer type (knowledge/custom)"""
        success_count = 0
        fail_count = 0

        logger.info(f"[{group_type}] Starting to send messages to {len(psids)} users")

        db = SessionLocal()

        try:
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                logger.error(f"Page {page_id} not found in database")
                return

            for psid in psids:
                try:
                    # ส่งข้อความ
                    for message in sorted(messages, key=lambda x: x.get('order', 0)):
                        message_type = message.get('type', 'text')
                        content = message.get('content', '')
                        logger.info(f"[{group_type}] Sending {message_type} message to {psid}")

                        if message_type == 'text':
                            result = send_message(psid, content, access_token)
                        elif message_type == 'image':
                            from app.config import image_dir
                            clean_content = content.replace('[IMAGE] ', '')
                            image_path = f"{image_dir}/{clean_content}"
                            result = send_image_binary_from_db(psid, image_path, access_token)
                        elif message_type == 'video':
                            from app.config import vid_dir
                            clean_content = content.replace('[VIDEO] ', '')
                            video_path = f"{vid_dir}/{clean_content}"
                            result = send_video_binary(psid, video_path, access_token)
                        else:
                            continue

                        if 'error' in result:
                            logger.error(f"[{group_type}] Error sending message to {psid}: {result}")
                            fail_count += 1
                            break
                        else:
                            logger.info(f"[{group_type}] Successfully sent message to {psid}")
                            await asyncio.sleep(0.5)

                    # อัพเดท customer type ถ้าส่งสำเร็จ
                    if schedule and 'groups' in schedule and len(schedule['groups']) > 0:
                        group_id = schedule['groups'][0]

                        # ✅ Knowledge group
                        if str(group_id).startswith('knowledge_'):
                            try:
                                knowledge_id = int(str(group_id).replace('knowledge_', ''))
                                customer = crud.get_customer_by_psid(db, page.ID, psid)
                                if customer:
                                    # อัพเดท current_category_id ของ FbCustomer
                                    customer.current_category_id = knowledge_id
                                    customer.updated_at = datetime.now()
                                    db.commit()
                                    db.refresh(customer)
                                    logger.info(f"[{group_type}] ✅ Updated customer {psid} to knowledge group {knowledge_id}")

                                    # ส่ง SSE update
                                    knowledge_type = db.query(models.CustomerTypeKnowledge).filter(
                                        models.CustomerTypeKnowledge.id == knowledge_id
                                    ).first()
                                    if knowledge_type:
                                        from app.routes.facebook.sse import send_customer_type_update
                                        await send_customer_type_update(
                                            page_id=page_id,
                                            psid=psid,
                                            customer_type_knowledge_id=knowledge_id,  
                                            customer_type_knowledge_name=knowledge_type.type_name
                                        )
                                        logger.info(f"[{group_type}] 📡 Sent SSE update for knowledge type: {knowledge_type.type_name}")

                            except Exception as e:
                                logger.error(f"[{group_type}] ❌ Error updating customer knowledge type: {e}")
                                db.rollback()

                        # ✅ Custom group
                        elif not str(group_id).startswith('default_'):
                            try:
                                customer = crud.get_customer_by_psid(db, page.ID, psid)
                                if customer:
                                    group_id_int = int(group_id) if isinstance(group_id, str) else group_id
                                    custom_group = db.query(models.CustomerTypeCustom).filter(
                                        models.CustomerTypeCustom.id == group_id_int
                                    ).first()
                                    if custom_group:
                                        # ➡️ Insert new record into FBCustomerCustomClassification
                                        new_classification = models.FBCustomerCustomClassification(
                                            customer_id=customer.id,
                                            old_category_id=None,  # หรือใส่ group เดิมถ้ามี logic
                                            new_category_id=group_id_int,
                                            page_id=page.ID,
                                            classified_by="system"
                                        )
                                        db.add(new_classification)
                                        customer.updated_at = datetime.now()
                                        db.commit()
                                        db.refresh(customer)

                                        logger.info(f"[{group_type}] ✅ Inserted classification for customer {psid} into custom group {group_id_int}")

                                        # ส่ง SSE update
                                        from app.routes.facebook.sse import send_customer_type_update
                                        await send_customer_type_update(
                                            page_id=page_id,
                                            psid=psid,
                                            customer_type_name=custom_group.type_name,
                                            customer_type_custom_id=group_id_int
                                        )
                                        logger.info(f"[{group_type}] 📡 Sent SSE update for custom type: {custom_group.type_name}")

                            except Exception as e:
                                logger.error(f"[{group_type}] ❌ Error inserting customer custom classification: {e}")
                                db.rollback()

                    success_count += 1
                    await asyncio.sleep(1)

                except Exception as e:
                    logger.error(f"[{group_type}] Error sending messages to {psid}: {e}")
                    fail_count += 1

        finally:
            db.close()

        logger.info(f"[{group_type}] Sent messages complete: {success_count} success, {fail_count} failed")

    
    async def update_inactivity_from_conversations(self, page_id: str):
        """อัพเดทข้อมูล inactivity จาก conversations โดยตรง"""
        try:
            access_token = get_page_token(page_id)
            if not access_token:
                return

            from app.service.facebook_api import fb_get

            # ดึง conversations
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id",
                "limit": 100
            }

            conversations = fb_get(endpoint, params, access_token)
            if "error" in conversations or not conversations.get('data'):
                return

            # สร้างข้อมูล inactivity
            if page_id not in self.user_inactivity_data:
                self.user_inactivity_data[page_id] = {}

            for conv in conversations['data']:
                participants = conv.get('participants', {}).get('data', [])
                for participant in participants:
                    user_id = participant.get('id')
                    if user_id and user_id != page_id:
                        # คำนวณระยะเวลาที่หายไป
                        updated_time = conv.get('updated_time')
                        if updated_time:
                            try:
                                past = datetime.fromisoformat(updated_time.replace('Z', '+00:00'))
                            except Exception:
                                continue
                            now = datetime.now(past.tzinfo)
                            diff_minutes = int((now - past).total_seconds() / 60)

                            self.user_inactivity_data[page_id][user_id] = {
                                'last_message_time': updated_time,
                                'inactivity_minutes': diff_minutes,
                                'updated_at': datetime.now()
                            }

        except Exception as e:
            logger.error(f"Error updating inactivity from conversations: {e}")
    
    async def handle_repeat(self, page_id: str, schedule: Dict[str, Any], current_time: datetime):
        """จัดการการทำซ้ำของ schedule"""
        repeat_info = schedule.get('repeat', {})
        repeat_type = repeat_info.get('type', 'once')
        schedule_id = str(schedule['id'])
        
        if repeat_type == 'once':
            # ถ้าส่งครั้งเดียว ให้ลบออกจากระบบ
            self.remove_schedule(page_id, schedule['id'])
            return
            
        # คำนวณวันถัดไป
        current_date = datetime.strptime(schedule['date'], "%Y-%m-%d")
        
        if repeat_type == 'daily':
            next_date = current_date + timedelta(days=1)
        elif repeat_type == 'weekly':
            next_date = current_date + timedelta(weeks=1)
        elif repeat_type == 'monthly':
            # เพิ่ม 1 เดือน
            if current_date.month == 12:
                next_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                next_date = current_date.replace(month=current_date.month + 1)
        else:
            return
            
        # ตรวจสอบวันสิ้นสุด
        end_date = repeat_info.get('endDate')
        if end_date:
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            if next_date > end_datetime:
                # ถ้าเกินวันสิ้นสุด ให้ลบออกจากระบบ
                self.remove_schedule(page_id, schedule['id'])
                return
                
        # อัพเดทวันที่ใน schedule
        schedule['date'] = next_date.strftime("%Y-%m-%d")
        
        # Reset tracking สำหรับรอบใหม่
        self.sent_tracking[schedule_id] = set()
    
    def get_active_schedules_for_page(self, page_id: str):
        """ดึง active schedules สำหรับ page"""
        return self.active_schedules.get(page_id, [])
    
    def stop(self):
        """หยุดระบบ scheduler"""
        self.is_running = False
        
        # Cancel tasks
        if self.user_group_task:
            self.user_group_task.cancel()
        if self.knowledge_group_task:
            self.knowledge_group_task.cancel()
            
        logger.info("Message scheduler stopped")

# สร้าง instance ของ scheduler
message_scheduler = MessageScheduler()