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
from fastapi import Depends
from app.database.database import get_db
from sqlalchemy.orm import Session
from app.database import models
from fastapi.responses import JSONResponse

from app.service.message_scheduler import message_scheduler
from .auth import get_page_tokens

router = APIRouter()
logger = logging.getLogger(__name__)

# API สำหรับเปิดใช้งาน schedule
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

# API สำหรับดู schedules ที่กำลังทำงาน
@router.get("/active-schedules/{page_id}")
async def get_active_schedules(page_id: str):
    """ดู schedules ที่กำลังทำงาน"""
    schedules = message_scheduler.get_active_schedules_for_page(page_id)
    return {
        "page_id": page_id,
        "active_schedules": schedules,
        "count": len(schedules)
    }

# API สำหรับปิดใช้งาน schedule
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

# API สำหรับทดสอบ user inactivity
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

# API สำหรับรีเซ็ต tracking ของ schedule
@router.post("/schedule/reset-tracking/{schedule_id}")
async def reset_schedule_tracking(schedule_id: str):
    """Reset tracking data ของ schedule"""
    message_scheduler.sent_tracking[schedule_id] = set()
    return {"status": "success", "message": f"Reset tracking for schedule {schedule_id}"}

# API สำหรับดูสถานะของระบบ scheduler
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

# API สำหรับอัพเดทข้อมูลระยะเวลาที่หายไปของ users
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
    
# API สำหรับดึง schedules ทั้งหมดพร้อมรายละเอียดของกลุ่ม
@router.get("/all-schedules/{page_id}")
async def get_all_schedules_with_details(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึง schedules ทั้งหมดพร้อมรายละเอียดของกลุ่ม"""
    try:
        # หา page จาก database
        page = db.query(models.FacebookPage).filter(
            models.FacebookPage.page_id == page_id
        ).first()
        
        if not page:
            return JSONResponse(
                status_code=404,
                content={"error": f"Page {page_id} not found"}
            )
        
        # Query schedules พร้อม join กับ customer_type_messages
        schedules_query = db.query(
            models.MessageSchedule,
            models.CustomerTypeMessage,
            models.CustomerTypeCustom,
            models.PageCustomerTypeKnowledge,
            models.CustomerTypeKnowledge
        ).join(
            models.CustomerTypeMessage,
            models.MessageSchedule.customer_type_message_id == models.CustomerTypeMessage.id
        ).outerjoin(
            models.CustomerTypeCustom,
            models.CustomerTypeMessage.customer_type_custom_id == models.CustomerTypeCustom.id
        ).outerjoin(
            models.PageCustomerTypeKnowledge,
            models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
        ).outerjoin(
            models.CustomerTypeKnowledge,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == models.CustomerTypeKnowledge.id
        ).filter(
            models.CustomerTypeMessage.page_id == page.ID
        ).all()
        
        # Group schedules by group
        grouped_schedules = {}
        
        for schedule, message, custom_type, page_knowledge, knowledge_type in schedules_query:
            # ตรวจสอบว่าเป็นกลุ่มประเภทไหน
            if custom_type:
                # กลุ่มที่ User สร้าง
                group_key = f"custom_{custom_type.id}"
                group_name = custom_type.type_name
                group_type = "user_created"
                group_id = custom_type.id
            elif knowledge_type:
                # กลุ่มพื้นฐาน (Knowledge Group)
                group_key = f"knowledge_{knowledge_type.id}"
                group_name = knowledge_type.type_name
                group_type = "knowledge"
                group_id = f"knowledge_{knowledge_type.id}"
            else:
                continue
            
            if group_key not in grouped_schedules:
                grouped_schedules[group_key] = {
                    "group_id": group_id,
                    "group_name": group_name,
                    "group_type": group_type,
                    "schedules": [],
                    "messages": [],
                    "schedule_ids": set()
                }
            
            # แปลง send_after_inactive จาก timedelta เป็น string ที่อ่านง่าย
            send_after_inactive_str = None
            if schedule.send_after_inactive:
                total_seconds = schedule.send_after_inactive.total_seconds()
                
                if total_seconds < 3600:  # น้อยกว่า 1 ชั่วโมง
                    minutes = int(total_seconds / 60)
                    send_after_inactive_str = f"{minutes} minutes"
                elif total_seconds < 86400:  # น้อยกว่า 1 วัน
                    hours = int(total_seconds / 3600)
                    send_after_inactive_str = f"{hours} hours"
                elif total_seconds < 604800:  # น้อยกว่า 1 สัปดาห์
                    days = int(total_seconds / 86400)
                    send_after_inactive_str = f"{days} days"
                elif total_seconds < 2592000:  # น้อยกว่า 30 วัน (ประมาณ 1 เดือน)
                    weeks = int(total_seconds / 604800)
                    send_after_inactive_str = f"{weeks} weeks"
                else:
                    months = int(total_seconds / 2592000)
                    send_after_inactive_str = f"{months} months"
            
            # เพิ่ม schedule (ตรวจสอบไม่ให้ซ้ำ)
            if schedule.id not in grouped_schedules[group_key]["schedule_ids"]:
                schedule_data = {
                    "id": schedule.id,
                    "send_type": schedule.send_type,
                    "scheduled_at": schedule.scheduled_at.isoformat() if schedule.scheduled_at else None,
                    "send_after_inactive": send_after_inactive_str,  # ใช้ string ที่แปลงแล้ว
                    "frequency": schedule.frequency,
                    "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
                    "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None
                }
                grouped_schedules[group_key]["schedules"].append(schedule_data)
                grouped_schedules[group_key]["schedule_ids"].add(schedule.id)
            
            # เพิ่มข้อความ
            message_data = {
                "id": message.id,
                "type": message.message_type,
                "content": message.content,
                "order": message.display_order
            }
            
            # ตรวจสอบไม่ให้ข้อความซ้ำ
            if not any(m["id"] == message.id for m in grouped_schedules[group_key]["messages"]):
                grouped_schedules[group_key]["messages"].append(message_data)
        
        # แปลงเป็น list และลบ schedule_ids set ออก
        result = []
        for key, value in grouped_schedules.items():
            value.pop("schedule_ids", None)
            result.append(value)
        
        # Debug log
        logger.info(f"Found {len(result)} groups with schedules")
        for group in result:
            logger.info(f"Group: {group['group_name']} ({group['group_type']})")
            for sched in group['schedules']:
                logger.info(f"  Schedule: type={sched['send_type']}, inactive={sched['send_after_inactive']}")
        
        return {
            "page_id": page_id,
            "total_groups": len(result),
            "schedules": result
        }
        
    except Exception as e:
        logger.error(f"Error getting all schedules: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# API สำหรับปิดการทำงานของ schedules ทั้งหมดใน knowledge group ที่ถูกปิด
@router.post("/schedule/deactivate-knowledge-group")
async def deactivate_knowledge_group_schedules(request: Request):
    """ปิดการทำงาน schedules ทั้งหมดของ knowledge group ที่ถูกปิด"""
    try:
        data = await request.json()
        page_id = data.get('page_id')
        knowledge_id = data.get('knowledge_id')
        
        if not page_id or not knowledge_id:
            return {"status": "error", "message": "Missing required data"}
        
        # สร้าง group_id ในรูปแบบที่ scheduler ใช้
        group_id = f"knowledge_{knowledge_id}"
        
        # หา schedules ทั้งหมดที่เกี่ยวข้องกับ group นี้
        schedules_to_remove = []
        for schedule_id, schedule in message_scheduler.active_schedules.get(page_id, {}).items():
            if group_id in schedule.get('groups', []):
                schedules_to_remove.append(schedule_id)
        
        # ลบ schedules ออกจาก active schedules
        for schedule_id in schedules_to_remove:
            message_scheduler.remove_schedule(page_id, schedule_id)
            logger.info(f"Deactivated schedule {schedule_id} for knowledge group {knowledge_id}")
        
        return {
            "status": "success",
            "message": f"Deactivated {len(schedules_to_remove)} schedules",
            "deactivated_count": len(schedules_to_remove)
        }
        
    except Exception as e:
        logger.error(f"Error deactivating knowledge group schedules: {e}")
        return {"status": "error", "message": str(e)}
    
# API สำหรับเปิดการทำงานของ schedules ของ knowledge group ที่ถูกเปิดกลับมา  
@router.post("/schedule/reactivate-knowledge-group")
async def reactivate_knowledge_group_schedules(request: Request, db: Session = Depends(get_db)):
    """เปิดการทำงาน schedules ของ knowledge group ที่ถูกเปิดกลับมา"""
    try:
        data = await request.json()
        page_id = data.get('page_id')
        knowledge_id = data.get('knowledge_id')
        
        if not page_id or not knowledge_id:
            return {"status": "error", "message": "Missing required data"}
        
        # ดึงข้อมูล schedules จาก database
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"status": "error", "message": "Page not found"}
        
        # ดึง schedules ของ knowledge group นี้จาก database
        group_id = f"group_knowledge_{knowledge_id}"
        schedules_response = await fetch(
            f"http://localhost:8000/message-schedules/group/{page.ID}/{group_id}"
        )
        
        if schedules_response.ok:
            schedules = await schedules_response.json()
            
            # เปิดใช้งาน schedules ทั้งหมด
            for schedule in schedules:
                # แปลงข้อมูลและเพิ่มเข้า active schedules
                formatted_schedule = {
                    'id': schedule['id'],
                    'type': schedule['send_type'],
                    'groups': [f"knowledge_{knowledge_id}"],
                    'pageId': page_id,
                    # ... เพิ่มข้อมูลอื่นๆ ตามต้องการ
                }
                
                message_scheduler.add_schedule(page_id, formatted_schedule)
                logger.info(f"Reactivated schedule {schedule['id']} for knowledge group {knowledge_id}")
        
        return {"status": "success", "message": "Schedules reactivated"}
        
    except Exception as e:
        logger.error(f"Error reactivating knowledge group schedules: {e}")
        return {"status": "error", "message": str(e)}