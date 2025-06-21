import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.database.database import SessionLocal
from app.database.models import MiningSchedule, GroupCustomer, UserActivity, MessageLog, CustomerGroup
from app.service.facebook_api import send_message, send_image_binary, send_video_binary
from app.config import page_tokens
import logging
import json
from typing import List, Dict, Any, Optional
import traceback

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MessageScheduler:
    """
    ระบบตรวจสอบและส่งข้อความอัตโนมัติตามเงื่อนไขที่ตั้งไว้
    """
    
    def __init__(self):
        self.running = False
        self.check_interval = 60  # ตรวจสอบทุก 60 วินาที
        self.message_delay = 1  # หน่วงเวลาระหว่างข้อความ (วินาที)
        self.batch_delay = 2  # หน่วงเวลาระหว่างผู้รับ (วินาที)
        self.max_retries = 3  # จำนวนครั้งที่ลองใหม่เมื่อส่งล้มเหลว
        self._lock = asyncio.Lock()  # ป้องกันการทำงานซ้อน
        
    async def start(self):
        """เริ่มต้นระบบตรวจสอบและส่งข้อความ"""
        self.running = True
        logger.info("Message Scheduler started")
        
        while self.running:
            try:
                async with self._lock:
                    await self.check_and_send_messages()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                logger.info("Message Scheduler cancelled")
                break
            except Exception as e:
                logger.error(f"Error in scheduler main loop: {str(e)}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """หยุดระบบ"""
        self.running = False
        logger.info("Message Scheduler stopped")
    
    async def check_and_send_messages(self):
        """ตรวจสอบและส่งข้อความตามเงื่อนไข"""
        db = SessionLocal()
        try:
            # ดึงตารางที่ active
            schedules = db.query(MiningSchedule).filter(
                MiningSchedule.is_active == True
            ).all()
            
            logger.info(f"Checking {len(schedules)} active schedules")
            
            for schedule in schedules:
                try:
                    await self.process_schedule(schedule, db)
                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.id}: {str(e)}")
                    logger.error(traceback.format_exc())
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error in check_and_send_messages: {str(e)}")
            logger.error(traceback.format_exc())
            db.rollback()
        finally:
            db.close()
    
    async def process_schedule(self, schedule: MiningSchedule, db: Session):
        """ประมวลผลแต่ละตารางเวลา"""
        try:
            now = datetime.utcnow()
            
            # ตรวจสอบว่าถึงเวลาส่งหรือยัง
            should_send = False
            recipients = []
            
            if schedule.type == 'immediate':
                # ส่งทันที (ส่งแค่ครั้งเดียว)
                if not schedule.last_run_at:
                    should_send = True
                    recipients = self.get_group_recipients(schedule.group_id, db)
                    logger.info(f"Schedule {schedule.id}: Immediate send to {len(recipients)} recipients")
            
            elif schedule.type == 'scheduled':
                # ส่งตามเวลาที่กำหนด
                if schedule.next_run_at and now >= schedule.next_run_at:
                    should_send = True
                    recipients = self.get_group_recipients(schedule.group_id, db)
                    logger.info(f"Schedule {schedule.id}: Scheduled send to {len(recipients)} recipients")
                    
                    # คำนวณรอบถัดไป
                    schedule.next_run_at = self.calculate_next_run(schedule, now)
            
            elif schedule.type == 'user-inactive':
                # ส่งเมื่อ user หายไปตามระยะเวลาที่กำหนด
                recipients = await self.get_inactive_recipients(schedule, db)
                if recipients:
                    should_send = True
                    logger.info(f"Schedule {schedule.id}: Found {len(recipients)} inactive users")
            
            # ส่งข้อความถ้าถึงเงื่อนไข
            if should_send and recipients:
                logger.info(f"Starting to send messages for schedule {schedule.id}")
                await self.send_messages_to_recipients(
                    schedule, recipients, db
                )
                schedule.last_run_at = now
                
                # ถ้าเป็น immediate หรือ once ให้ปิด schedule
                if schedule.type == 'immediate' or (
                    schedule.type == 'scheduled' and 
                    schedule.repeat_type == 'once' and 
                    schedule.last_run_at
                ):
                    schedule.is_active = False
                    logger.info(f"Schedule {schedule.id} completed and deactivated")
                
                db.commit()
                
        except Exception as e:
            logger.error(f"Error processing schedule {schedule.id}: {str(e)}")
            logger.error(traceback.format_exc())
            raise
    
    def get_group_recipients(self, group_id: int, db: Session) -> List[str]:
        """ดึงรายชื่อผู้รับในกลุ่ม"""
        try:
            customers = db.query(GroupCustomer).filter(
                GroupCustomer.group_id == group_id
            ).all()
            
            recipients = [c.customer_psid for c in customers]
            logger.info(f"Found {len(recipients)} recipients in group {group_id}")
            return recipients
            
        except Exception as e:
            logger.error(f"Error getting group recipients: {str(e)}")
            return []
    
    async def get_inactive_recipients(self, schedule: MiningSchedule, db: Session) -> List[str]:
        """ดึงรายชื่อผู้รับที่ไม่ active ตามเงื่อนไข"""
        try:
            now = datetime.utcnow()
            
            # คำนวณ threshold
            if schedule.inactivity_unit == 'hours':
                threshold = now - timedelta(hours=schedule.inactivity_period)
            elif schedule.inactivity_unit == 'days':
                threshold = now - timedelta(days=schedule.inactivity_period)
            elif schedule.inactivity_unit == 'weeks':
                threshold = now - timedelta(weeks=schedule.inactivity_period)
            elif schedule.inactivity_unit == 'months':
                threshold = now - timedelta(days=schedule.inactivity_period * 30)
            else:
                logger.error(f"Invalid inactivity unit: {schedule.inactivity_unit}")
                return []
            
            logger.info(f"Checking for users inactive since {threshold}")
            
            # ดึงลูกค้าในกลุ่ม
            group_customers = db.query(GroupCustomer).filter(
                GroupCustomer.group_id == schedule.group_id
            ).all()
            
            inactive_recipients = []
            
            for customer in group_customers:
                # ตรวจสอบ activity
                activity = db.query(UserActivity).filter(
                    and_(
                        UserActivity.page_id == schedule.page_id,
                        UserActivity.user_psid == customer.customer_psid
                    )
                ).first()
                
                # ถ้าไม่มี activity หรือ activity เก่ากว่า threshold
                if not activity or activity.last_activity < threshold:
                    # ตรวจสอบว่าเคยส่งให้ user นี้ในรอบนี้หรือยัง
                    if not await self.already_sent_in_period(
                        schedule.id, 
                        customer.customer_psid, 
                        threshold, 
                        db
                    ):
                        inactive_recipients.append(customer.customer_psid)
                        logger.info(f"User {customer.customer_psid} is inactive")
            
            logger.info(f"Found {len(inactive_recipients)} inactive recipients")
            return inactive_recipients
            
        except Exception as e:
            logger.error(f"Error getting inactive recipients: {str(e)}")
            logger.error(traceback.format_exc())
            return []
    
    async def already_sent_in_period(
        self, 
        schedule_id: int, 
        psid: str, 
        since: datetime, 
        db: Session
    ) -> bool:
        """ตรวจสอบว่าเคยส่งให้ user นี้ในช่วงเวลานี้หรือยัง"""
        try:
            sent_log = db.query(MessageLog).filter(
                and_(
                    MessageLog.schedule_id == schedule_id,
                    MessageLog.recipient_psid == psid,
                    MessageLog.sent_at >= since,
                    MessageLog.status == 'sent'
                )
            ).first()
            
            return sent_log is not None
            
        except Exception as e:
            logger.error(f"Error checking sent status: {str(e)}")
            return False
    
    def calculate_next_run(self, schedule: MiningSchedule, current_time: datetime) -> Optional[datetime]:
        """คำนวณเวลาส่งครั้งถัดไป"""
        try:
            if schedule.repeat_type == 'once':
                return None
            
            next_run = current_time
            
            if schedule.repeat_type == 'daily':
                next_run += timedelta(days=1)
            elif schedule.repeat_type == 'weekly':
                # ถ้ามีการกำหนดวันในสัปดาห์
                if schedule.repeat_days:
                    # หาวันถัดไปที่ตรงกับที่กำหนด
                    current_weekday = current_time.weekday()
                    days_ahead = None
                    
                    for day in sorted(schedule.repeat_days):
                        if day > current_weekday:
                            days_ahead = day - current_weekday
                            break
                    
                    # ถ้าไม่มีวันที่มากกว่าในสัปดาห์นี้ ไปสัปดาห์หน้า
                    if days_ahead is None:
                        days_ahead = 7 - current_weekday + min(schedule.repeat_days)
                    
                    next_run += timedelta(days=days_ahead)
                else:
                    # ถ้าไม่ได้กำหนดวัน ส่งทุก 7 วัน
                    next_run += timedelta(weeks=1)
            elif schedule.repeat_type == 'monthly':
                # เพิ่ม 30 วัน (ประมาณ)
                next_run += timedelta(days=30)
                
                # ปรับให้ตรงกับวันที่เดิม (ถ้าเป็นไปได้)
                if schedule.scheduled_date:
                    try:
                        original_day = schedule.scheduled_date.day
                        next_run = next_run.replace(day=original_day)
                    except ValueError:
                        # ถ้าวันที่ไม่มีในเดือนนั้น (เช่น 31 ก.พ.) ใช้วันสุดท้ายของเดือน
                        pass
            
            # ตรวจสอบ end_date
            if schedule.end_date and next_run > schedule.end_date:
                logger.info(f"Schedule {schedule.id} reached end date")
                return None
            
            # ถ้าเป็น scheduled type ให้รักษาเวลาเดิม
            if schedule.type == 'scheduled' and schedule.scheduled_time:
                time_parts = schedule.scheduled_time.split(':')
                next_run = next_run.replace(
                    hour=int(time_parts[0]),
                    minute=int(time_parts[1]),
                    second=0,
                    microsecond=0
                )
            
            logger.info(f"Next run for schedule {schedule.id}: {next_run}")
            return next_run
            
        except Exception as e:
            logger.error(f"Error calculating next run: {str(e)}")
            return None
    
    async def send_messages_to_recipients(
        self, 
        schedule: MiningSchedule, 
        recipients: List[str], 
        db: Session
    ):
        """ส่งข้อความไปยังผู้รับ"""
        access_token = page_tokens.get(schedule.page_id)
        if not access_token:
            logger.error(f"No access token for page {schedule.page_id}")
            return
        
        success_count = 0
        failed_count = 0
        
        for recipient_psid in recipients:
            try:
                logger.info(f"Sending messages to {recipient_psid}")
                
                # ส่งข้อความตามลำดับ
                for message in schedule.messages:
                    try:
                        message_type = message.get('message_type', 'text')
                        content = message.get('content', '')
                        
                        # ลองส่งตามจำนวนครั้งที่กำหนด
                        result = None
                        last_error = None
                        
                        for attempt in range(self.max_retries):
                            try:
                                if message_type == 'text':
                                    result = send_message(recipient_psid, content, access_token)
                                elif message_type == 'image':
                                    # ตัด prefix ถ้ามี
                                    image_path = content.replace('[IMAGE] ', '')
                                    result = send_image_binary(recipient_psid, image_path, access_token)
                                elif message_type == 'video':
                                    # ตัด prefix ถ้ามี
                                    video_path = content.replace('[VIDEO] ', '')
                                    result = send_video_binary(recipient_psid, video_path, access_token)
                                else:
                                    logger.warning(f"Unknown message type: {message_type}")
                                    continue
                                
                                # ถ้าส่งสำเร็จ ออกจาก loop retry
                                if result and 'error' not in result:
                                    break
                                else:
                                    last_error = result.get('error', {}).get('message', 'Unknown error')
                                    logger.warning(f"Attempt {attempt + 1} failed: {last_error}")
                                    
                                    # รอก่อน retry
                                    if attempt < self.max_retries - 1:
                                        await asyncio.sleep(2)
                                        
                            except Exception as e:
                                last_error = str(e)
                                logger.error(f"Error on attempt {attempt + 1}: {last_error}")
                                if attempt < self.max_retries - 1:
                                    await asyncio.sleep(2)
                        
                        # บันทึก log
                        log = MessageLog(
                            schedule_id=schedule.id,
                            page_id=schedule.page_id,
                            recipient_psid=recipient_psid,
                            message_type=message_type,
                            message_content=content[:500],  # จำกัดความยาว
                            status='sent' if result and 'error' not in result else 'failed',
                            error_message=last_error if result and 'error' in result else None,
                            sent_at=datetime.utcnow()
                        )
                        db.add(log)
                        
                        if result and 'error' not in result:
                            logger.info(f"Successfully sent {message_type} to {recipient_psid}")
                        else:
                            logger.error(f"Failed to send {message_type} to {recipient_psid}: {last_error}")
                        
                        # หน่วงเวลาระหว่างข้อความ
                        await asyncio.sleep(self.message_delay)
                        
                    except Exception as e:
                        logger.error(f"Error sending message to {recipient_psid}: {str(e)}")
                        logger.error(traceback.format_exc())
                        
                        # บันทึก error log
                        log = MessageLog(
                            schedule_id=schedule.id,
                            page_id=schedule.page_id,
                            recipient_psid=recipient_psid,
                            message_type='error',
                            message_content='',
                            status='failed',
                            error_message=str(e)[:500],
                            sent_at=datetime.utcnow()
                        )
                        db.add(log)
                
                success_count += 1
                
                # หน่วงเวลาระหว่างผู้รับ
                await asyncio.sleep(self.batch_delay)
                
            except Exception as e:
                failed_count += 1
                logger.error(f"Error processing recipient {recipient_psid}: {str(e)}")
                logger.error(traceback.format_exc())
        
        # Commit logs
        try:
            db.commit()
            logger.info(f"Schedule {schedule.id}: Sent to {success_count} recipients, {failed_count} failed")
        except Exception as e:
            logger.error(f"Error committing logs: {str(e)}")
            db.rollback()

    async def test_send_to_single_recipient(
        self,
        schedule: MiningSchedule,
        recipient_psid: str,
        db: Session
    ):
        """ทดสอบส่งข้อความไปยังผู้รับคนเดียว (สำหรับ debug)"""
        try:
            logger.info(f"Test sending to {recipient_psid} for schedule {schedule.id}")
            await self.send_messages_to_recipients(
                schedule,
                [recipient_psid],
                db
            )
            return {"status": "success", "recipient": recipient_psid}
        except Exception as e:
            logger.error(f"Test send failed: {str(e)}")
            return {"status": "failed", "error": str(e)}

    def get_scheduler_stats(self, db: Session) -> Dict[str, Any]:
        """ดึงสถิติการทำงานของ scheduler"""
        try:
            # นับ schedules ที่ active
            active_schedules = db.query(MiningSchedule).filter(
                MiningSchedule.is_active == True
            ).count()
            
            # นับ schedules ตามประเภท
            immediate_count = db.query(MiningSchedule).filter(
                and_(
                    MiningSchedule.is_active == True,
                    MiningSchedule.type == 'immediate'
                )
            ).count()
            
            scheduled_count = db.query(MiningSchedule).filter(
                and_(
                    MiningSchedule.is_active == True,
                    MiningSchedule.type == 'scheduled'
                )
            ).count()
            
            inactive_count = db.query(MiningSchedule).filter(
                and_(
                    MiningSchedule.is_active == True,
                    MiningSchedule.type == 'user-inactive'
                )
            ).count()
            
            # ดึง schedules ที่จะทำงานใน 1 ชั่วโมงข้างหน้า
            next_hour = datetime.utcnow() + timedelta(hours=1)
            upcoming_schedules = db.query(MiningSchedule).filter(
                and_(
                    MiningSchedule.is_active == True,
                    MiningSchedule.next_run_at != None,
                    MiningSchedule.next_run_at <= next_hour
                )
            ).all()
            
            # สถิติการส่งข้อความวันนี้
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            today_sent = db.query(MessageLog).filter(
                and_(
                    MessageLog.sent_at >= today_start,
                    MessageLog.status == 'sent'
                )
            ).count()
            
            today_failed = db.query(MessageLog).filter(
                and_(
                    MessageLog.sent_at >= today_start,
                    MessageLog.status == 'failed'
                )
            ).count()
            
            return {
                "scheduler_status": "running" if self.running else "stopped",
                "check_interval": self.check_interval,
                "active_schedules": {
                    "total": active_schedules,
                    "immediate": immediate_count,
                    "scheduled": scheduled_count,
                    "user_inactive": inactive_count
                },
                "upcoming_in_next_hour": [
                    {
                        "id": s.id,
                        "type": s.type,
                        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None
                    }
                    for s in upcoming_schedules
                ],
                "today_stats": {
                    "sent": today_sent,
                    "failed": today_failed,
                    "success_rate": round((today_sent / (today_sent + today_failed) * 100) if (today_sent + today_failed) > 0 else 0, 2)
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting scheduler stats: {str(e)}")
            return {
                "scheduler_status": "error",
                "error": str(e)
            }

# Global scheduler instance
scheduler = MessageScheduler()

# Function to start scheduler in background
async def start_scheduler():
    """เริ่มต้น scheduler ในพื้นหลัง"""
    logger.info("Starting message scheduler...")
    asyncio.create_task(scheduler.start())

# Function to stop scheduler
def stop_scheduler():
    """หยุด scheduler"""
    scheduler.stop()

# Export
__all__ = ['MessageScheduler', 'scheduler', 'start_scheduler', 'stop_scheduler']