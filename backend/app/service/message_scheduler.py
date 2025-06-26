import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Set
import logging
from app.service.facebook_api import send_message, send_image_binary, send_video_binary
from app.database import crud
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
import json

logger = logging.getLogger(__name__)

class MessageScheduler:
    def __init__(self):
        self.active_schedules: Dict[str, List[Dict[str, Any]]] = {}
        self.is_running = False
        self.page_tokens = {}
        # เพิ่ม tracking สำหรับป้องกันการส่งซ้ำ
        self.sent_tracking: Dict[str, Set[str]] = {}  # {schedule_id: set(user_ids)}
        self.last_check_time: Dict[int, datetime] = {}  # {schedule_id: last_check_datetime}
        
    def set_page_tokens(self, tokens: Dict[str, str]):
        """อัพเดท page tokens"""
        self.page_tokens = tokens
        logger.info(f"Updated page tokens for {len(tokens)} pages")
        
    def add_schedule(self, page_id: str, schedule: Dict[str, Any]):
        """เพิ่ม schedule เข้าระบบ"""
        if page_id not in self.active_schedules:
            self.active_schedules[page_id] = []
        
        # ตรวจสอบว่ามี schedule นี้อยู่แล้วหรือไม่
        existing = next((s for s in self.active_schedules[page_id] if s['id'] == schedule['id']), None)
        if existing:
            # อัพเดท schedule ที่มีอยู่
            existing.update(schedule)
        else:
            # เพิ่ม schedule ใหม่
            schedule['activated_at'] = datetime.now().isoformat()
            self.active_schedules[page_id].append(schedule)
            # เริ่ม tracking สำหรับ schedule ใหม่
            self.sent_tracking[str(schedule['id'])] = set()
            
        logger.info(f"Added schedule {schedule['id']} for page {page_id}")
        
    def remove_schedule(self, page_id: str, schedule_id: int):
        """ลบ schedule ออกจากระบบ"""
        if page_id in self.active_schedules:
            self.active_schedules[page_id] = [
                s for s in self.active_schedules[page_id] if s['id'] != schedule_id
            ]
            # ลบ tracking data
            self.sent_tracking.pop(str(schedule_id), None)
            self.last_check_time.pop(schedule_id, None)
            logger.info(f"Removed schedule {schedule_id} for page {page_id}")
            
    async def start_schedule_monitoring(self):
        """เริ่มระบบตรวจสอบ schedule"""
        self.is_running = True
        logger.info("Message scheduler started")
        
        while self.is_running:
            try:
                # ตรวจสอบ schedule ทุก 30 วินาที
                await self.check_all_schedules()
                await asyncio.sleep(30)  # ลดเป็น 30 วินาทีเพื่อให้ตอบสนองเร็วขึ้น
            except Exception as e:
                logger.error(f"Error in schedule monitoring: {e}")
                await asyncio.sleep(30)
                
    async def check_all_schedules(self):
        """ตรวจสอบ schedule ทั้งหมด"""
        current_time = datetime.now()
        logger.info(f"Checking schedules at {current_time}")
        
        for page_id, schedules in self.active_schedules.items():
            for schedule in schedules:
                try:
                    await self.check_schedule(page_id, schedule, current_time)
                except Exception as e:
                    logger.error(f"Error checking schedule {schedule['id']}: {e}")
                    
    async def check_schedule(self, page_id: str, schedule: Dict[str, Any], current_time: datetime):
        """ตรวจสอบแต่ละ schedule"""
        schedule_type = schedule.get('type')
        schedule_id = str(schedule['id'])
        
        if schedule_type == 'immediate':
            # ส่งทันทีถ้ายังไม่เคยส่ง
            if not schedule.get('sent'):
                await self.process_schedule(page_id, schedule)
                schedule['sent'] = True
                
        elif schedule_type == 'scheduled':
            await self.check_scheduled_time(page_id, schedule, current_time)
            
        elif schedule_type == 'user-inactive':
            # ป้องกันการตรวจสอบถี่เกินไป - ตรวจสอบทุก 30 วินาที
            last_check = self.last_check_time.get(schedule['id'])
            if last_check and (current_time - last_check).seconds < 30:
                return

            self.last_check_time[schedule['id']] = current_time
            await self.check_user_inactivity(page_id, schedule)
            
    async def check_scheduled_time(self, page_id: str, schedule: Dict[str, Any], current_time: datetime):
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
                    
            logger.info(f"Processing scheduled message for page {page_id} at {current_time}")
            
            # ส่งข้อความ
            await self.process_schedule(page_id, schedule)
            
            # อัพเดทเวลาที่ส่งล่าสุด
            schedule['last_sent'] = current_time.isoformat()
            
            # ตรวจสอบการทำซ้ำ
            await self.handle_repeat(page_id, schedule, current_time)
            
    async def check_user_inactivity(self, page_id: str, schedule: Dict[str, Any]):
        """ตรวจสอบ user ที่หายไปตามระยะเวลาที่กำหนด (เช็คจากเวลาที่ user ส่งข้อความล่าสุด)"""
        try:
            inactivity_period = int(schedule.get('inactivityPeriod', 1))
            inactivity_unit = schedule.get('inactivityUnit', 'days')
            schedule_id = str(schedule['id'])

            # baseline เวลาที่ activate schedule
            activated_at = schedule.get('activated_at')
            if activated_at:
                activated_at = datetime.fromisoformat(activated_at)
            else:
                activated_at = datetime.now()

            # คำนวณ threshold - ใช้เวลาปัจจุบันลบด้วยระยะเวลาที่กำหนด
            if inactivity_unit == 'minutes':
                threshold_time = datetime.now() - timedelta(minutes=inactivity_period)
            elif inactivity_unit == 'hours':
                threshold_time = datetime.now() - timedelta(hours=inactivity_period)
            elif inactivity_unit == 'days':
                threshold_time = datetime.now() - timedelta(days=inactivity_period)
            elif inactivity_unit == 'weeks':
                threshold_time = datetime.now() - timedelta(weeks=inactivity_period)
            else:  # months
                threshold_time = datetime.now() - timedelta(days=inactivity_period * 30)

            logger.info(f"Checking inactivity for schedule {schedule_id}: threshold={threshold_time}, unit={inactivity_unit}, period={inactivity_period}")

            # ดึง access token
            access_token = self.page_tokens.get(page_id)
            if not access_token:
                logger.warning(f"No access token for page {page_id}")
                return

            from app.service.facebook_api import fb_get

            # ดึง conversations พร้อม last message time (ใช้ API เดียวกับหน้า App.js)
            endpoint = f"{page_id}/conversations"
            params = {
                "fields": "participants,updated_time,id",
                "limit": 100
            }
            
            conversations = fb_get(endpoint, params, access_token)
            if "error" in conversations:
                logger.error(f"Error getting conversations: {conversations['error']}")
                return

            inactive_users = []
            sent_users = self.sent_tracking.get(schedule_id, set())

            # ประมวลผลแต่ละ conversation
            for conv in conversations.get('data', []):
                conv_id = conv.get('id')
                participants = conv.get('participants', {}).get('data', [])
                
                # หา user participants (ไม่ใช่ page)
                user_participants = [p for p in participants if p.get('id') and p.get('id') != page_id]
                if not user_participants:
                    continue
                    
                user_id = user_participants[0]['id']
                
                # ตรวจสอบว่าเคยส่งให้ user นี้แล้วหรือยัง
                if user_id in sent_users:
                    continue

                # ดึงข้อความล่าสุดใน conversation
                msg_endpoint = f"{conv_id}/messages"
                msg_params = {
                    "fields": "from,created_time",
                    "limit": 10  # ดึง 10 ข้อความล่าสุด
                }
                
                messages = fb_get(msg_endpoint, msg_params, access_token)
                if "error" in messages or "data" not in messages:
                    continue

                # หาข้อความล่าสุดที่ user ส่งมา
                last_user_msg_time = None
                for msg in messages['data']:
                    if msg.get('from', {}).get('id') == user_id:
                        last_user_msg_time = datetime.fromisoformat(msg['created_time'].replace('T', ' ').split('+')[0])
                        break

                # ตรวจสอบเงื่อนไข: user ส่งข้อความล่าสุดก่อน threshold และหลัง activate
                if last_user_msg_time and last_user_msg_time < threshold_time and last_user_msg_time > activated_at:
                    inactive_users.append(user_id)
                    logger.info(f"User {user_id} is inactive - last message: {last_user_msg_time}, threshold: {threshold_time}")

            # ส่งข้อความให้ users ที่หายไป
            if inactive_users:
                logger.info(f"Found {len(inactive_users)} inactive users for schedule {schedule['id']}")
                await self.send_messages_to_users(page_id, inactive_users, schedule['messages'], access_token)
                
                # เพิ่ม users ที่ส่งแล้วเข้า tracking
                self.sent_tracking[schedule_id].update(inactive_users)
                schedule['last_sent'] = datetime.now().isoformat()

        except Exception as e:
            logger.error(f"Error checking user inactivity: {e}")
            
    async def process_schedule(self, page_id: str, schedule: Dict[str, Any]):
        """ประมวลผลและส่งข้อความตาม schedule"""
        try:
            groups = schedule.get('groups', [])
            messages = schedule.get('messages', [])
            schedule_id = str(schedule['id'])
            
            logger.info(f"Processing schedule {schedule_id}: groups={groups}, messages={len(messages)}")
            
            if not groups or not messages:
                logger.warning(f"No groups or messages in schedule {schedule['id']}")
                return
                
            # ดึง access token
            access_token = self.page_tokens.get(page_id)
            if not access_token:
                logger.warning(f"No access token for page {page_id}")
                return
                
            # ดึงข้อมูล conversations
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
                        
            if all_psids:
                logger.info(f"Sending messages to {len(all_psids)} users")
                # ส่งข้อความ
                await self.send_messages_to_users(page_id, all_psids, messages, access_token)
                
                # เพิ่ม users ที่ส่งแล้วเข้า tracking
                self.sent_tracking[schedule_id].update(all_psids)
            else:
                logger.warning("No users found to send messages")
                
        except Exception as e:
            logger.error(f"Error processing schedule: {e}")
            
    async def send_messages_to_users(self, page_id: str, psids: List[str], messages: List[Dict], access_token: str):
        """ส่งข้อความไปยัง users"""
        success_count = 0
        fail_count = 0
        
        logger.info(f"Starting to send messages to {len(psids)} users")
        
        for psid in psids:
            try:
                # ส่งข้อความตามลำดับ
                for message in sorted(messages, key=lambda x: x.get('order', 0)):
                    message_type = message.get('type', 'text')
                    content = message.get('content', '')
                    
                    logger.info(f"Sending {message_type} message to {psid}")
                    
                    if message_type == 'text':
                        result = send_message(psid, content, access_token)
                    elif message_type == 'image':
                        # สร้าง path สำหรับรูปภาพ
                        from app.config import image_dir
                        # ลบ prefix [IMAGE] ถ้ามี
                        clean_content = content.replace('[IMAGE] ', '')
                        image_path = f"{image_dir}/{clean_content}"
                        result = send_image_binary(psid, image_path, access_token)
                    elif message_type == 'video':
                        # สร้าง path สำหรับวิดีโอ
                        from app.config import vid_dir
                        # ลบ prefix [VIDEO] ถ้ามี
                        clean_content = content.replace('[VIDEO] ', '')
                        video_path = f"{vid_dir}/{clean_content}"
                        result = send_video_binary(psid, video_path, access_token)
                    else:
                        continue
                        
                    if 'error' in result:
                        logger.error(f"Error sending message to {psid}: {result}")
                        fail_count += 1
                        break
                    else:
                        logger.info(f"Successfully sent message to {psid}")
                        # หน่วงเวลาระหว่างข้อความ
                        await asyncio.sleep(0.5)
                        
                success_count += 1
                
                # หน่วงเวลาระหว่าง users
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error sending messages to {psid}: {e}")
                fail_count += 1
                
        logger.info(f"Sent messages complete: {success_count} success, {fail_count} failed")
        
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
        logger.info("Message scheduler stopped")

# สร้าง instance ของ scheduler
message_scheduler = MessageScheduler()