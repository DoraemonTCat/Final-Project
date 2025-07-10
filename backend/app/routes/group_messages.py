from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database import models
from pydantic import BaseModel
from typing import List, Optional
import logging
from datetime import datetime, date

from app.database.models import MessageSchedule

router = APIRouter()
logger = logging.getLogger(__name__)

class GroupMessageCreate(BaseModel):
    page_id: int
    customer_type_custom_id: Optional[int] = None
    message_type: str
    content: str
    dir: Optional[str] = ""
    display_order: int

class GroupMessageUpdate(BaseModel):
    message_type: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None

class GroupMessageResponse(BaseModel):
    id: int
    page_id: int
    customer_type_custom_id: Optional[int]
    message_type: str
    content: str
    dir: Optional[str]
    display_order: int
    
    class Config:
        orm_mode = True
        
# เพิ่ม Pydantic Models
class MessageScheduleCreate(BaseModel):
    customer_type_message_id: int
    send_type: str  # immediate, scheduled, after_inactive
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None  # เก็บเป็น string เช่น "1 days", "2 hours"
    frequency: Optional[str] = "once"  # once, daily, weekly, monthly

class MessageScheduleUpdate(BaseModel):
    send_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None
    frequency: Optional[str] = None

class MessageScheduleResponse(BaseModel):
    id: int
    customer_type_message_id: int
    send_type: str
    scheduled_at: Optional[datetime]
    send_after_inactive: Optional[str]
    frequency: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
        


# API สำหรับเพิ่มข้อความให้กลุ่ม
@router.post("/group-messages", response_model=GroupMessageResponse)
async def create_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """สร้างข้อความใหม่สำหรับกลุ่มลูกค้า"""
    try:
        # สร้างข้อความใหม่
        db_message = models.CustomerTypeMessage(
            page_id=message_data.page_id,
            customer_type_custom_id=message_data.customer_type_custom_id,
            message_type=message_data.message_type,
            content=message_data.content,
            dir=message_data.dir or "",
            display_order=message_data.display_order
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        logger.info(f"Created message for group {message_data.customer_type_custom_id}")
        return db_message
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group message: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# API สำหรับดึงข้อความของกลุ่ม
@router.get("/group-messages/{page_id}/{group_id}", response_model=List[GroupMessageResponse])
async def get_group_messages(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """ดึงข้อความทั้งหมดของกลุ่มลูกค้า"""
    messages = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id,
        models.CustomerTypeMessage.customer_type_custom_id == group_id
    ).order_by(models.CustomerTypeMessage.display_order).all()
    
    return messages

# API สำหรับอัพเดทข้อความ
@router.put("/group-messages/{message_id}", response_model=GroupMessageResponse)
async def update_group_message(
    message_id: int,
    update_data: GroupMessageUpdate,
    db: Session = Depends(get_db)
):
    """อัพเดทข้อความของกลุ่ม"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # อัพเดทเฉพาะฟิลด์ที่ส่งมา
    if update_data.message_type is not None:
        message.message_type = update_data.message_type
    if update_data.content is not None:
        message.content = update_data.content
    if update_data.display_order is not None:
        message.display_order = update_data.display_order
    
    db.commit()
    db.refresh(message)
    
    return message

# API สำหรับลบข้อความ
@router.delete("/group-messages/{message_id}")
async def delete_group_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """ลบข้อความของกลุ่ม"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    return {"status": "success", "message": "Message deleted"}

# API สำหรับบันทึกข้อความหลายรายการพร้อมกัน
@router.post("/group-messages/batch")
async def create_batch_group_messages(
    messages: List[GroupMessageCreate],
    db: Session = Depends(get_db)
):
    """บันทึกข้อความหลายรายการพร้อมกัน"""
    try:
        db_messages = []
        for msg_data in messages:
            db_message = models.CustomerTypeMessage(
                page_id=msg_data.page_id,
                customer_type_custom_id=msg_data.customer_type_custom_id,
                message_type=msg_data.message_type,
                content=msg_data.content,
                dir=msg_data.dir or "",
                display_order=msg_data.display_order
            )
            db_messages.append(db_message)
        
        db.add_all(db_messages)
        db.commit()
        
        return {"status": "success", "count": len(db_messages)}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating batch messages: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# API สำหรับลบข้อความทั้งหมดของกลุ่ม
@router.delete("/group-messages/{page_id}/{group_id}/all")
async def delete_all_group_messages(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """ลบข้อความทั้งหมดของกลุ่ม"""
    deleted = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id,
        models.CustomerTypeMessage.customer_type_custom_id == group_id
    ).delete()
    
    db.commit()
    
    return {"status": "success", "deleted_count": deleted}


########################## ไว้จัดการเงื่อนไขระยะเวลา ################################

# API สำหรับสร้าง schedule ใหม่
@router.post("/message-schedules", response_model=MessageScheduleResponse)
async def create_message_schedule(
    schedule_data: MessageScheduleCreate,
    db: Session = Depends(get_db)
):
    """สร้าง schedule ใหม่สำหรับข้อความกลุ่ม"""
    try:
        # แปลง string เป็น interval สำหรับ PostgreSQL
        interval_value = None
        if schedule_data.send_after_inactive:
            # Parse string เช่น "1 days", "2 hours"
            parts = schedule_data.send_after_inactive.split()
            if len(parts) == 2:
                value = int(parts[0])
                unit = parts[1].lower()
                
                if unit in ['minute', 'minutes']:
                    interval_value = timedelta(minutes=value)
                elif unit in ['hour', 'hours']:
                    interval_value = timedelta(hours=value)
                elif unit in ['day', 'days']:
                    interval_value = timedelta(days=value)
                elif unit in ['week', 'weeks']:
                    interval_value = timedelta(weeks=value)
                elif unit in ['month', 'months']:
                    interval_value = timedelta(days=value * 30)  # โดยประมาณ
        
        db_schedule = models.MessageSchedule(
            customer_type_message_id=schedule_data.customer_type_message_id,
            send_type=schedule_data.send_type,
            scheduled_at=schedule_data.scheduled_at,
            send_after_inactive=interval_value,
            frequency=schedule_data.frequency
        )
        
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        
        # แปลง interval กลับเป็น string สำหรับ response
        response_data = {
            "id": db_schedule.id,
            "customer_type_message_id": db_schedule.customer_type_message_id,
            "send_type": db_schedule.send_type,
            "scheduled_at": db_schedule.scheduled_at,
            "frequency": db_schedule.frequency,
            "created_at": db_schedule.created_at,
            "updated_at": db_schedule.updated_at,
            "send_after_inactive": schedule_data.send_after_inactive  # ส่งกลับเป็น string เดิม
        }
        
        return response_data
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating message schedule: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# API สำหรับดึง schedules ของกลุ่ม
@router.get("/message-schedules/group/{page_id}/{group_id}")
async def get_group_schedules(
    page_id: int,
    group_id: str,  # เปลี่ยนจาก int เป็น str เพื่อรองรับทั้ง ID ตัวเลขและ default_x
    db: Session = Depends(get_db)
):
    """ดึง schedules ทั้งหมดของกลุ่มลูกค้า"""
    try:
        # ตรวจสอบว่าเป็น default group หรือไม่
        if group_id.startswith('default_'):
            # สำหรับ default groups ให้ return array ว่าง หรือดึงจาก localStorage
            # เพราะ default groups ไม่ได้เก็บใน database
            return []
        
        # แปลง group_id เป็น integer สำหรับ user groups
        try:
            group_id_int = int(group_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid group ID format")
        
        # ดึงข้อความทั้งหมดของกลุ่ม
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_id == page_id,
            models.CustomerTypeMessage.customer_type_custom_id == group_id_int
        ).all()
        
        if not messages:
            return []
        
        message_ids = [msg.id for msg in messages]
        
        # ดึง schedules ของข้อความเหล่านั้น
        schedules = db.query(models.MessageSchedule).filter(
            models.MessageSchedule.customer_type_message_id.in_(message_ids)
        ).all()
        
        # แปลง interval เป็น string
        result = []
        for schedule in schedules:
            schedule_dict = {
                "id": schedule.id,
                "customer_type_message_id": schedule.customer_type_message_id,
                "send_type": schedule.send_type,
                "scheduled_at": schedule.scheduled_at,
                "frequency": schedule.frequency,
                "created_at": schedule.created_at,
                "updated_at": schedule.updated_at,
                "send_after_inactive": None
            }
            
            # แปลง interval เป็น string
            if schedule.send_after_inactive:
                total_seconds = schedule.send_after_inactive.total_seconds()
                if total_seconds < 3600:  # น้อยกว่า 1 ชั่วโมง
                    minutes = int(total_seconds / 60)
                    schedule_dict["send_after_inactive"] = f"{minutes} minutes"
                elif total_seconds < 86400:  # น้อยกว่า 1 วัน
                    hours = int(total_seconds / 3600)
                    schedule_dict["send_after_inactive"] = f"{hours} hours"
                elif total_seconds < 604800:  # น้อยกว่า 1 สัปดาห์
                    days = int(total_seconds / 86400)
                    schedule_dict["send_after_inactive"] = f"{days} days"
                else:
                    weeks = int(total_seconds / 604800)
                    schedule_dict["send_after_inactive"] = f"{weeks} weeks"
            
            result.append(schedule_dict)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API สำหรับอัพเดท schedule
@router.put("/message-schedules/{schedule_id}", response_model=MessageScheduleResponse)
async def update_message_schedule(
    schedule_id: int,
    update_data: MessageScheduleUpdate,
    db: Session = Depends(get_db)
):
    """อัพเดท schedule"""
    schedule = db.query(models.MessageSchedule).filter(
        models.MessageSchedule.id == schedule_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # อัพเดทเฉพาะฟิลด์ที่ส่งมา
    if update_data.send_type is not None:
        schedule.send_type = update_data.send_type
    if update_data.scheduled_at is not None:
        schedule.scheduled_at = update_data.scheduled_at
    if update_data.frequency is not None:
        schedule.frequency = update_data.frequency
    
    # แปลง string เป็น interval
    if update_data.send_after_inactive is not None:
        parts = update_data.send_after_inactive.split()
        if len(parts) == 2:
            value = int(parts[0])
            unit = parts[1].lower()
            
            if unit in ['minute', 'minutes']:
                schedule.send_after_inactive = timedelta(minutes=value)
            elif unit in ['hour', 'hours']:
                schedule.send_after_inactive = timedelta(hours=value)
            elif unit in ['day', 'days']:
                schedule.send_after_inactive = timedelta(days=value)
            elif unit in ['week', 'weeks']:
                schedule.send_after_inactive = timedelta(weeks=value)
    
    schedule.updated_at = datetime.now()
    db.commit()
    db.refresh(schedule)
    
    # แปลงกลับเป็น response format
    response_data = {
        "id": schedule.id,
        "customer_type_message_id": schedule.customer_type_message_id,
        "send_type": schedule.send_type,
        "scheduled_at": schedule.scheduled_at,
        "frequency": schedule.frequency,
        "created_at": schedule.created_at,
        "updated_at": schedule.updated_at,
        "send_after_inactive": update_data.send_after_inactive
    }
    
    return response_data

# API สำหรับลบ schedule
@router.delete("/message-schedules/{schedule_id}")
async def delete_message_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):
    """ลบ schedule"""
    schedule = db.query(models.MessageSchedule).filter(
        models.MessageSchedule.id == schedule_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"status": "success", "message": "Schedule deleted"}

# API สำหรับบันทึก schedule หลายรายการพร้อมกัน
@router.post("/message-schedules/batch")
async def create_batch_schedules(
    schedules: List[MessageScheduleCreate],
    db: Session = Depends(get_db)
):
    """บันทึก schedules หลายรายการพร้อมกัน"""
    try:
        db_schedules = []
        for schedule_data in schedules:
            # แปลง string เป็น interval
            interval_value = None
            if schedule_data.send_after_inactive:
                parts = schedule_data.send_after_inactive.split()
                if len(parts) == 2:
                    value = int(parts[0])
                    unit = parts[1].lower()
                    
                    if unit in ['minute', 'minutes']:
                        interval_value = timedelta(minutes=value)
                    elif unit in ['hour', 'hours']:
                        interval_value = timedelta(hours=value)
                    elif unit in ['day', 'days']:
                        interval_value = timedelta(days=value)
                    elif unit in ['week', 'weeks']:
                        interval_value = timedelta(weeks=value)
            
            db_schedule = models.MessageSchedule(
                customer_type_message_id=schedule_data.customer_type_message_id,
                send_type=schedule_data.send_type,
                scheduled_at=schedule_data.scheduled_at,
                send_after_inactive=interval_value,
                frequency=schedule_data.frequency
            )
            db_schedules.append(db_schedule)
        
        db.add_all(db_schedules)
        db.commit()
        
        return {"status": "success", "count": len(db_schedules)}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating batch schedules: {e}")
        raise HTTPException(status_code=400, detail=str(e))