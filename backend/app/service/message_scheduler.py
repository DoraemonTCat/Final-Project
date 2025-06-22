from datetime import datetime, timedelta
from typing import List, Dict, Any
import asyncio
import json
from app.config import page_tokens
from app.service.facebook_api import send_message, send_image_binary, send_video_binary

class MessageScheduler:
    def __init__(self):
        self.running_schedules = {}
        self.sent_messages = {}  # Track sent messages to avoid duplicates
        
    async def start_schedule_monitoring(self):
        """เริ่มต้นระบบตรวจสอบ schedule ทั้งหมด"""
        while True:
            try:
                await self.check_all_schedules()
                await asyncio.sleep(60)  # ตรวจสอบทุก 1 นาที
            except Exception as e:
                print(f"Error in schedule monitoring: {e}")
                await asyncio.sleep(60)
    
    async def check_all_schedules(self):
        """ตรวจสอบ schedule ทั้งหมดจาก localStorage (simulate)"""
        # ในระบบจริงจะดึงจาก database
        # ตอนนี้จะ simulate ด้วย in-memory storage
        for page_id, schedules in self.get_all_schedules().items():
            for schedule in schedules:
                await self.process_schedule(page_id, schedule)
    
    def get_all_schedules(self) -> Dict[str, List[Dict]]:
        """ดึง schedules ทั้งหมด (simulate from localStorage)"""
        # ในระบบจริงจะดึงจาก database
        # ตอนนี้ return mock data
        return self.running_schedules
    
    async def process_schedule(self, page_id: str, schedule: Dict[str, Any]):
        """ประมวลผล schedule แต่ละตัว"""
        schedule_type = schedule.get('type')
        
        if schedule_type == 'immediate':
            await self.send_immediate(page_id, schedule)
        elif schedule_type == 'scheduled':
            await self.check_scheduled_time(page_id, schedule)
        elif schedule_type == 'user-inactive':
            await self.check_user_inactivity(page_id, schedule)
    
    async def check_user_inactivity(self, page_id: str, schedule: Dict[str, Any]):
        """ตรวจสอบ User ที่หายไปตามเงื่อนไข"""
        inactivity_period = int(schedule.get('inactivityPeriod', 1))
        inactivity_unit = schedule.get('inactivityUnit', 'days')
        
        # คำนวณเวลาที่ต้องหายไป
        if inactivity_unit == 'hours':
            threshold_time = datetime.now() - timedelta(hours=inactivity_period)
        elif inactivity_unit == 'days':
            threshold_time = datetime.now() - timedelta(days=inactivity_period)
        elif inactivity_unit == 'weeks':
            threshold_time = datetime.now() - timedelta(weeks=inactivity_period)
        elif inactivity_unit == 'months':
            threshold_time = datetime.now() - timedelta(days=inactivity_period * 30)
        
        # ดึงรายชื่อ conversations ที่ตรงกับกลุ่ม
        target_conversations = await self.get_group_conversations(page_id, schedule.get('groups', []))
        
        for conversation in target_conversations:
            last_message_time = conversation.get('last_user_message_time')
            if last_message_time:
                last_msg_datetime = datetime.fromisoformat(last_message_time.replace('Z', '+00:00'))
                
                # ตรวจสอบว่าหายไปนานพอหรือยัง
                if last_msg_datetime < threshold_time:
                    # ตรวจสอบว่าส่งไปแล้วหรือยัง
                    sent_key = f"{page_id}_{conversation['raw_psid']}_{schedule['id']}"
                    if sent_key not in self.sent_messages:
                        await self.send_messages_to_user(
                            page_id, 
                            conversation['raw_psid'], 
                            schedule.get('messages', [])
                        )
                        self.sent_messages[sent_key] = datetime.now()
    
    async def send_messages_to_user(self, page_id: str, psid: str, messages: List[Dict]):
        """ส่งข้อความไปยัง User ตามลำดับ"""
        access_token = page_tokens.get(page_id)
        if not access_token:
            print(f"No access token for page {page_id}")
            return
        
        for message in sorted(messages, key=lambda x: x.get('order', 0)):
            try:
                message_type = message.get('type', 'text')
                content = message.get('content', '')
                
                if message_type == 'text':
                    await self.send_text_message(psid, content, access_token)
                elif message_type == 'image':
                    await self.send_image_message(psid, content, access_token)
                elif message_type == 'video':
                    await self.send_video_message(psid, content, access_token)
                
                # หน่วงเวลาระหว่างข้อความ
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"Error sending message: {e}")
    
    async def send_text_message(self, psid: str, content: str, access_token: str):
        """ส่งข้อความ text"""
        result = send_message(psid, content, access_token)
        print(f"Sent text message to {psid}: {result}")
    
    async def send_image_message(self, psid: str, content: str, access_token: str):
        """ส่งรูปภาพ"""
        # แปลง content เป็น path ที่ถูกต้อง
        image_path = content.replace('[IMAGE] ', '')
        result = send_image_binary(psid, image_path, access_token)
        print(f"Sent image to {psid}: {result}")
    
    async def send_video_message(self, psid: str, content: str, access_token: str):
        """ส่งวิดีโอ"""
        # แปลง content เป็น path ที่ถูกต้อง
        video_path = content.replace('[VIDEO] ', '')
        result = send_video_binary(psid, video_path, access_token)
        print(f"Sent video to {psid}: {result}")
    
    async def get_group_conversations(self, page_id: str, group_ids: List[int]) -> List[Dict]:
        """ดึง conversations ที่อยู่ในกลุ่มที่กำหนด"""
        # ในระบบจริงจะดึงจาก database
        # ตอนนี้ return mock data
        return []
    
    def add_schedule(self, page_id: str, schedule: Dict):
        """เพิ่ม schedule ใหม่เข้าระบบ"""
        if page_id not in self.running_schedules:
            self.running_schedules[page_id] = []
        self.running_schedules[page_id].append(schedule)
    
    def remove_schedule(self, page_id: str, schedule_id: int):
        """ลบ schedule ออกจากระบบ"""
        if page_id in self.running_schedules:
            self.running_schedules[page_id] = [
                s for s in self.running_schedules[page_id] 
                if s.get('id') != schedule_id
            ]

# สร้าง instance global
message_scheduler = MessageScheduler()

class MessageScheduler:
    def __init__(self):
        self.running_schedules = {}
        self.sent_messages = {}
        # Mock conversations for testing
        self.mock_conversations = {
            "1234567890": [  # page_id
                {
                    "conversation_id": "t_123",
                    "raw_psid": "999999999",
                    "user_name": "Test User 1",
                    "last_user_message_time": (datetime.now() - timedelta(hours=2)).isoformat(),
                    "groups": [1]
                },
                {
                    "conversation_id": "t_124", 
                    "raw_psid": "888888888",
                    "user_name": "Test User 2",
                    "last_user_message_time": (datetime.now() - timedelta(days=2)).isoformat(),
                    "groups": [1]
                }
            ]
        }
    
    async def get_group_conversations(self, page_id: str, group_ids: List[int]) -> List[Dict]:
        """ดึง conversations ที่อยู่ในกลุ่มที่กำหนด"""
        # ใช้ mock data สำหรับทดสอบ
        if page_id in self.mock_conversations:
            return [
                conv for conv in self.mock_conversations[page_id]
                if any(g in conv.get('groups', []) for g in group_ids)
            ]
        return []
    
    # Override send methods for testing
    async def send_text_message(self, psid: str, content: str, access_token: str):
        """ส่งข้อความ text (mock)"""
        print(f"[MOCK] Sending text to {psid}: {content}")
        return {"status": "success", "mock": True}
    
    async def send_image_message(self, psid: str, content: str, access_token: str):
        """ส่งรูปภาพ (mock)"""
        print(f"[MOCK] Sending image to {psid}: {content}")
        return {"status": "success", "mock": True}
    
    async def send_video_message(self, psid: str, content: str, access_token: str):
        """ส่งวิดีโอ (mock)"""
        print(f"[MOCK] Sending video to {psid}: {content}")
        return {"status": "success", "mock": True}