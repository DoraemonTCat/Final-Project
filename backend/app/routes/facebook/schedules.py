# backend/app/routes/facebook/schedules.py
"""
Facebook Schedules Component
จัดการ:
- เปิด/ปิด schedules
- ทดสอบ user inactivity
- จัดการ schedule tracking
- อัพเดทข้อมูล user inactivity
"""

from fastapi import APIRouter, Request
from typing import Dict, List, Any
import logging

from app.service.message_scheduler import message_scheduler
from .auth import get_page_tokens

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/schedule/activate")
async def activate_schedule(request: Request):
    """เปิดใช้งาน schedule"""
    data = await request.json()
    page_id = data.get('page_id')
    schedule = data.get('schedule')
    
    if not page_id or not schedule:
        return {"status": "error", "message": "Missing required data"}
    
    # อัพเดท page tokens ให้ scheduler ก่อนเพิ่ม schedule
    page_tokens = get_page_tokens()
    message_scheduler.set_page_tokens(page_tokens)
    
    # Reset sent tracking สำหรับ schedule นี้
    schedule_id = str(schedule['id'])
    message_scheduler.sent_tracking[schedule_id] = set()
    
    # ตรวจสอบและแก้ไขข้อมูล schedule
    if 'pageId' not in schedule and page_id:
        schedule['pageId'] = page_id
    
    # เพิ่ม schedule เข้าระบบ
    message_scheduler.add_schedule(page_id, schedule)
    
    # ถ้าเป็นแบบส่งทันที ให้ process ทันที
    if schedule.get('type') == 'immediate':
        await message_scheduler.process_schedule(page_id, schedule)
        return {"status": "success", "message": "Immediate schedule processed"}
    
    # สำหรับ scheduled และ user-inactive จะรอให้ scheduler ทำงานตามเวลา
    return {"status": "success", "message": "Schedule activated"}


@router.get("/active-schedules/{page_id}")
async def get_active_schedules(page_id: str):
    """ดู schedules ที่กำลังทำงาน"""
    schedules = message_scheduler.get_active_schedules_for_page(page_id)
    return {
        "page_id": page_id,
        "active_schedules": schedules,
        "count": len(schedules)
    }


@router.post("/schedule/deactivate")
async def deactivate_schedule(request: Request):
    """ปิดใช้งาน schedule"""
    data = await request.json()
    page_id = data.get('page_id')
    schedule_id = data.get('schedule_id')
    
    if not page_id or schedule_id is None:
        return {"status": "error", "message": "Missing required data"}
    
    message_scheduler.remove_schedule(page_id, schedule_id)
    
    return {"status": "success", "message": "Schedule deactivated"}


@router.get("/schedule/test-inactivity/{page_id}")
async def test_user_inactivity(page_id: str, minutes: int = 1):
    """ทดสอบระบบตรวจสอบ user ที่หายไป
    
    Parameters:
    - page_id: ID ของเพจ
    - minutes: จำนวนนาทีที่ต้องการทดสอบ (default = 1)
    """
    # Mock schedule for testing
    test_schedule = {
        "id": 999,
        "type": "user-inactive",
        "inactivityPeriod": str(minutes),
        "inactivityUnit": "minutes",
        "groups": [1],
        "messages": [
            {
                "type": "text",
                "content": f"สวัสดีค่ะ คุณหายไปมา {minutes} นาทีแล้วนะคะ 😊",
                "order": 0
            },
            {
                "type": "text", 
                "content": "มีโปรโมชั่นพิเศษสำหรับคุณ! กลับมาคุยกับเราสิคะ 💝",
                "order": 1
            }
        ]
    }
    
    # Reset tracking สำหรับการทดสอบ
    message_scheduler.sent_tracking["999"] = set()
    
    # อัพเดท page tokens ก่อนทดสอบ
    page_tokens = get_page_tokens()
    message_scheduler.set_page_tokens(page_tokens)
    
    # รันการตรวจสอบ
    await message_scheduler.check_user_inactivity(page_id, test_schedule)
    
    # ดึงผลลัพธ์
    sent_users = list(message_scheduler.sent_tracking.get("999", set()))
    
    return {
        "status": "success", 
        "message": f"Checked users inactive for {minutes} minutes",
        "sent_to_users": sent_users,
        "count": len(sent_users)
    }


@router.post("/schedule/reset-tracking/{schedule_id}")
async def reset_schedule_tracking(schedule_id: str):
    """Reset tracking data ของ schedule"""
    message_scheduler.sent_tracking[schedule_id] = set()
    return {"status": "success", "message": f"Reset tracking for schedule {schedule_id}"}


@router.get("/schedule/system-status")
async def get_system_status():
    """ดูสถานะของระบบ scheduler"""
    return {
        "is_running": message_scheduler.is_running,
        "active_pages": list(message_scheduler.active_schedules.keys()),
        "total_schedules": sum(len(schedules) for schedules in message_scheduler.active_schedules.values()),
        "schedules_by_page": {
            page_id: len(schedules) 
            for page_id, schedules in message_scheduler.active_schedules.items()
        },
        "tracking_info": {
            schedule_id: len(users) 
            for schedule_id, users in message_scheduler.sent_tracking.items()
        }
    }


@router.post("/update-user-inactivity/{page_id}")
async def update_user_inactivity(page_id: str, request: Request):
    """อัพเดทข้อมูลระยะเวลาที่หายไปของ users จาก frontend"""
    try:
        data = await request.json()
        user_data = data.get('users', [])
        
        if not user_data:
            return {"status": "error", "message": "No user data provided"}
        
        # อัพเดทข้อมูลใน scheduler
        message_scheduler.update_user_inactivity_data(page_id, user_data)
        
        return {
            "status": "success", 
            "message": f"Updated inactivity data for {len(user_data)} users",
            "updated_count": len(user_data)
        }
        
    except Exception as e:
        logger.error(f"Error updating user inactivity data: {e}")
        return {"status": "error", "message": str(e)}