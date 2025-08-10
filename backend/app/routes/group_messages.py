# backend/app/routes/group_messages.py
"""
Group Messages Component
จัดการ:
- ข้อความสำหรับกลุ่มลูกค้า (User Groups & Knowledge Groups)
- Universal API สำหรับข้อความทุกประเภท
- Message schedules และเงื่อนไขการส่ง
- Batch operations สำหรับข้อความและ schedules
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging

from app.database import models, crud
from app.database.database import get_db

# ==================== Configuration ====================
router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Pydantic Models - Messages ====================
class GroupMessageCreate(BaseModel):
    """Model สำหรับสร้างข้อความใหม่"""
    page_id: Union[int, str]  # รองรับทั้ง int และ string
    customer_type_custom_id: Optional[Union[int, str]] = None  # รองรับ "knowledge_123" format
    page_customer_type_knowledge_id: Optional[int] = None
    message_type: str
    content: str
    dir: Optional[str] = ""
    display_order: int

class GroupMessageUpdate(BaseModel):
    """Model สำหรับอัพเดทข้อความ"""
    message_type: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None

class GroupMessageResponse(BaseModel):
    """Model สำหรับ response ของข้อความ"""
    id: int
    page_id: int
    customer_type_custom_id: Optional[int]
    page_customer_type_knowledge_id: Optional[int]
    message_type: str
    content: str
    dir: Optional[str]
    display_order: int
    
    class Config:
        orm_mode = True

# ==================== Pydantic Models - Schedules ====================
class MessageScheduleCreate(BaseModel):
    """Model สำหรับสร้าง schedule ใหม่"""
    customer_type_message_id: int
    send_type: str  # immediate, scheduled, after_inactive
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None  # เก็บเป็น string เช่น "1 days", "2 hours"
    frequency: Optional[str] = "once"  # once, daily, weekly, monthly

class MessageScheduleUpdate(BaseModel):
    """Model สำหรับอัพเดท schedule"""
    send_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None
    frequency: Optional[str] = None

class MessageScheduleResponse(BaseModel):
    """Model สำหรับ response ของ schedule"""
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

# ==================== User Groups Messages APIs ====================

@router.post("/group-messages", response_model=GroupMessageResponse)
async def create_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """สร้างข้อความใหม่สำหรับ user group"""
    try:
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

@router.get("/group-messages/{page_id}/{group_id}", response_model=List[GroupMessageResponse])
async def get_group_messages(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """ดึงข้อความทั้งหมดของ user group"""
    messages = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id,
        models.CustomerTypeMessage.customer_type_custom_id == group_id
    ).order_by(models.CustomerTypeMessage.display_order).all()
    
    return messages

@router.put("/group-messages/{message_id}", response_model=GroupMessageResponse)
async def update_group_message(
    message_id: int,
    update_data: GroupMessageUpdate,
    db: Session = Depends(get_db)
):
    """อัพเดทข้อความของ user group"""
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

@router.delete("/group-messages/{message_id}")
async def delete_group_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """ลบข้อความของ user group"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    return {"status": "success", "message": "Message deleted"}

# ==================== Knowledge Groups Messages APIs ====================

@router.post("/knowledge-group-messages")
async def create_knowledge_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """สร้างข้อความใหม่สำหรับ knowledge group"""
    try:
        # ตรวจสอบและแปลง customer_type_custom_id
        group_id_str = str(message_data.customer_type_custom_id)
        
        if not group_id_str.startswith('knowledge_'):
            raise HTTPException(status_code=400, detail="Invalid knowledge group ID format")
        
        # ดึง knowledge_id จาก string
        knowledge_id = int(group_id_str.replace('knowledge_', ''))
        
        # แปลง page_id เป็น string เสมอ
        page_id_str = str(message_data.page_id)
        
        # หา page record
        page = crud.get_page_by_page_id(db, page_id_str)
        if not page:
            raise HTTPException(status_code=404, detail=f"Page not found: {page_id_str}")
        
        # หาหรือสร้าง page_customer_type_knowledge record
        page_knowledge = await _get_or_create_page_knowledge(
            db, page.ID, knowledge_id
        )
        
        # สร้างข้อความใหม่
        db_message = models.CustomerTypeMessage(
            page_id=page.ID,
            page_customer_type_knowledge_id=page_knowledge.id,
            customer_type_custom_id=None,  # ไม่ใส่ค่าสำหรับ knowledge groups
            message_type=message_data.message_type,
            content=message_data.content,
            dir=message_data.dir or "",
            display_order=message_data.display_order
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        logger.info(f"Created message ID {db_message.id} for knowledge group {knowledge_id}")
        
        return {
            "id": db_message.id,
            "page_id": db_message.page_id,
            "page_customer_type_knowledge_id": db_message.page_customer_type_knowledge_id,
            "message_type": db_message.message_type,
            "content": db_message.content,
            "dir": db_message.dir,
            "display_order": db_message.display_order
        }
        
    except ValueError as e:
        logger.error(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid knowledge ID format: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating knowledge group message: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/knowledge-group-messages/{page_id}/{knowledge_id}")
async def get_knowledge_group_messages(
    page_id: str,
    knowledge_id: Union[int, str],
    db: Session = Depends(get_db)
):
    """ดึงข้อความของ knowledge group"""
    try:
        # แปลง knowledge_id เป็น int
        if isinstance(knowledge_id, str):
            knowledge_id = int(knowledge_id)
        
        # หา page record
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            logger.warning(f"Page not found: {page_id}")
            return []
        
        # หา page_customer_type_knowledge record
        page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page.ID,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()
        
        if not page_knowledge:
            logger.info(f"No page_customer_type_knowledge found for page {page.ID} and knowledge {knowledge_id}")
            return []
        
        # ดึงข้อความที่เชื่อมกับ page_customer_type_knowledge นี้
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_customer_type_knowledge_id == page_knowledge.id
        ).order_by(models.CustomerTypeMessage.display_order).all()
        
        logger.info(f"Found {len(messages)} messages for knowledge group {knowledge_id}")
        
        # Format response
        result = []
        for msg in messages:
            result.append({
                "id": msg.id,
                "page_id": msg.page_id,
                "page_customer_type_knowledge_id": msg.page_customer_type_knowledge_id,
                "message_type": msg.message_type,
                "content": msg.content,
                "dir": msg.dir,
                "display_order": msg.display_order
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching knowledge group messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/knowledge-group-messages/{message_id}")
async def delete_knowledge_group_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """ลบข้อความของ knowledge group"""
    try:
        message = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.id == message_id
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        db.delete(message)
        db.commit()
        
        logger.info(f"Deleted message ID {message_id}")
        
        return {"status": "success", "message": "Message deleted"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting knowledge group message: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== Batch Operations APIs ====================

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
        
        logger.info(f"Created {len(db_messages)} messages in batch")
        return {"status": "success", "count": len(db_messages)}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating batch messages: {e}")
        raise HTTPException(status_code=400, detail=str(e))

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
    
    logger.info(f"Deleted {deleted} messages for group {group_id}")
    return {"status": "success", "deleted_count": deleted}

# ==================== Message Schedules APIs ====================

@router.post("/message-schedules", response_model=MessageScheduleResponse)
async def create_message_schedule(
    schedule_data: MessageScheduleCreate,
    db: Session = Depends(get_db)
):
    """สร้าง schedule ใหม่สำหรับข้อความ"""
    try:
        # แปลง string เป็น interval สำหรับ PostgreSQL
        interval_value = _parse_interval_string(schedule_data.send_after_inactive)
        
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

#API สำหรับดึง schedules ทั้งหมดของกลุ่มลูกค้า
@router.get("/message-schedules/group/{page_id}/{group_id}")
async def get_group_schedules(
    page_id: int,
    group_id: str,  # รองรับทั้ง ID ตัวเลขและ knowledge_x
    db: Session = Depends(get_db)
):
    """ดึง schedules ทั้งหมดของกลุ่มลูกค้า"""
    try:
        # ตรวจสอบว่าเป็น knowledge group หรือไม่
        if group_id.startswith('knowledge_') or group_id.startswith('group_knowledge_'):
            # แยก knowledge_id ออกมา
            if group_id.startswith('group_knowledge_'):
                knowledge_id = int(group_id.replace('group_knowledge_', ''))
            else:
                knowledge_id = int(group_id.replace('knowledge_', ''))
            
            logger.info(f"Fetching schedules for knowledge group {knowledge_id}")
            
            # หา page record
            page = db.query(models.FacebookPage).filter(
                models.FacebookPage.ID == page_id
            ).first()
            
            if not page:
                logger.warning(f"Page {page_id} not found")
                return []
            
            # ดึงข้อความของ knowledge group ผ่าน page_customer_type_knowledge
            messages = db.query(models.CustomerTypeMessage).join(
                models.PageCustomerTypeKnowledge,
                models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
            ).filter(
                models.PageCustomerTypeKnowledge.page_id == page_id,
                models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
            ).all()
            
            logger.info(f"Found {len(messages)} messages for knowledge group {knowledge_id}")
            
            if not messages:
                return []
            
            message_ids = [msg.id for msg in messages]
            
            # ดึง schedules ของข้อความเหล่านั้น
            schedules = db.query(models.MessageSchedule).filter(
                models.MessageSchedule.customer_type_message_id.in_(message_ids)
            ).all()
            
            logger.info(f"Found {len(schedules)} schedules")
            
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
                    "send_after_inactive": _format_interval_to_string(schedule.send_after_inactive)
                }
                result.append(schedule_dict)
            
            return result
            
        else:
            # สำหรับ user groups - ใช้โค้ดเดิม
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
                    "send_after_inactive": _format_interval_to_string(schedule.send_after_inactive)
                }
                result.append(schedule_dict)
            
            return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group schedules: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
        schedule.send_after_inactive = _parse_interval_string(update_data.send_after_inactive)
    
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

#API สำหรับลบ schedule
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

#  API สำหรับลบ schedules ทั้งหมดของ knowledge group
@router.delete("/message-schedules/knowledge-group/{page_id}/{knowledge_id}")
async def delete_knowledge_group_schedules(
    page_id: str,
    knowledge_id: int,
    db: Session = Depends(get_db)
):
    """ลบ schedules ทั้งหมดของ knowledge group"""
    try:
        # หา page
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # ดึงข้อความทั้งหมดของ knowledge group
        messages = db.query(models.CustomerTypeMessage).join(
            models.PageCustomerTypeKnowledge,
            models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
        ).filter(
            models.PageCustomerTypeKnowledge.page_id == page.ID,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).all()
        
        logger.info(f"Found {len(messages)} messages for knowledge group {knowledge_id}")
        
        deleted_count = 0
        for message in messages:
            # ลบ schedules ของแต่ละข้อความ
            deleted = db.query(models.MessageSchedule).filter(
                models.MessageSchedule.customer_type_message_id == message.id
            ).delete(synchronize_session=False)
            deleted_count += deleted
        
        db.commit()
        
        logger.info(f"Deleted {deleted_count} schedules for knowledge group {knowledge_id}")
        
        return {
            "status": "success",
            "deleted_count": deleted_count,
            "message": f"ลบ schedules ทั้งหมด {deleted_count} รายการสำเร็จ"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting knowledge group schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API สำหรับลบ schedules ทั้งหมดของกลุ่ม
@router.delete("/message-schedules/delete-by-group")
async def delete_schedules_by_group(
    page_id: str,
    group_id: str,
    db: Session = Depends(get_db)
):
    """ลบ schedules ทั้งหมดของกลุ่ม"""
    try:
        # ตรวจสอบว่าเป็น knowledge group หรือไม่
        if group_id.startswith('knowledge_'):
            knowledge_id = group_id.replace('knowledge_', '')
            
            # ดึงข้อความทั้งหมดของ knowledge group
            messages = db.query(models.CustomerTypeMessage).join(
                models.PageCustomerTypeKnowledge,
                models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
            ).filter(
                models.PageCustomerTypeKnowledge.customer_type_knowledge_id == int(knowledge_id)
            ).all()
            
            deleted_count = 0
            for message in messages:
                # ลบ schedules ของแต่ละข้อความ
                deleted = db.query(models.MessageSchedule).filter(
                    models.MessageSchedule.customer_type_message_id == message.id
                ).delete(synchronize_session=False)
                deleted_count += deleted
            
            db.commit()
            
            logger.info(f"Deleted {deleted_count} schedules for knowledge group {group_id}")
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "group_type": "knowledge"
            }
        else:
            # สำหรับ user groups
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                raise HTTPException(status_code=404, detail="Page not found")
            
            messages = db.query(models.CustomerTypeMessage).filter(
                models.CustomerTypeMessage.page_id == page.ID,
                models.CustomerTypeMessage.customer_type_custom_id == int(group_id)
            ).all()
            
            deleted_count = 0
            for message in messages:
                deleted = db.query(models.MessageSchedule).filter(
                    models.MessageSchedule.customer_type_message_id == message.id
                ).delete(synchronize_session=False)
                deleted_count += deleted
            
            db.commit()
            
            logger.info(f"Deleted {deleted_count} schedules for user group {group_id}")
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "group_type": "user"
            }
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting schedules by group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Batch Schedule Operations ====================

@router.post("/message-schedules/batch")
async def create_batch_schedules(
    schedules: List[MessageScheduleCreate],
    db: Session = Depends(get_db)
):
    """บันทึก schedules หลายรายการพร้อมกัน"""
    try:
        db_schedules = []
        for schedule_data in schedules:
            interval_value = _parse_interval_string(schedule_data.send_after_inactive)
            
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
        
        logger.info(f"Created {len(db_schedules)} schedules in batch")
        return {"status": "success", "count": len(db_schedules)}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating batch schedules: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/group-schedule/{page_id}/{group_id}")
async def delete_group_schedule(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """ลบ schedule ทั้งหมดของกลุ่ม"""
    try:
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_id == page_id,
            models.CustomerTypeMessage.customer_type_custom_id == group_id
        ).all()
        
        if messages:
            message_ids = [msg.id for msg in messages]
            deleted = db.query(models.MessageSchedule).filter(
                models.MessageSchedule.customer_type_message_id.in_(message_ids)
            ).delete(synchronize_session=False)
            
            db.commit()
            
            logger.info(f"Deleted {deleted} schedules for group {group_id}")
            return {
                "status": "success",
                "deleted_count": deleted
            }
        
        return {
            "status": "no_messages",
            "deleted_count": 0
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting group schedule: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# API สำหรับสร้าง schedule เดียวสำหรับข้อความทั้งหมดในกลุ่ม
@router.post("/group-schedule/{page_id}/{group_id}")
async def create_group_schedule(
    page_id: int,
    group_id: int,
    schedule_data: MessageScheduleCreate,
    db: Session = Depends(get_db)
):
    """สร้าง schedule เดียวสำหรับข้อความทั้งหมดในกลุ่ม"""
    try:
        # ลบ schedules เก่าทั้งหมดของกลุ่มนี้ก่อน
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_id == page_id,
            models.CustomerTypeMessage.customer_type_custom_id == group_id
        ).all()
        
        if not messages:
            raise HTTPException(status_code=404, detail="No messages found for this group")
        
        message_ids = [msg.id for msg in messages]
        
        # ลบ schedules เก่า
        db.query(models.MessageSchedule).filter(
            models.MessageSchedule.customer_type_message_id.in_(message_ids)
        ).delete(synchronize_session=False)
        
        # สร้าง schedule ใหม่สำหรับแต่ละข้อความ
        interval_value = _parse_interval_string(schedule_data.send_after_inactive)
        new_schedules = []
        
        for msg_id in message_ids:
            db_schedule = models.MessageSchedule(
                customer_type_message_id=msg_id,
                send_type=schedule_data.send_type,
                scheduled_at=schedule_data.scheduled_at,
                send_after_inactive=interval_value,
                frequency=schedule_data.frequency
            )
            new_schedules.append(db_schedule)
        
        db.add_all(new_schedules)
        db.commit()
        
        logger.info(f"Created schedule for {len(new_schedules)} messages in group {group_id}")
        return {
            "status": "success",
            "message": f"Created schedule for {len(new_schedules)} messages",
            "group_id": group_id
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group schedule: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== Schedule Summary APIs ====================

@router.get("/group-schedule-summary/{page_id}")
async def get_group_schedule_summaries(
    page_id: int,
    db: Session = Depends(get_db)
):
    """ดึงสรุป schedule ของแต่ละกลุ่ม"""
    try:
        # ดึงกลุ่มทั้งหมด
        groups = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.page_id == page_id,
            models.CustomerTypeCustom.is_active == True
        ).all()
        
        summaries = []
        
        for group in groups:
            # ดึงข้อความของกลุ่ม
            messages = db.query(models.CustomerTypeMessage).filter(
                models.CustomerTypeMessage.page_id == page_id,
                models.CustomerTypeMessage.customer_type_custom_id == group.id
            ).all()
            
            if messages:
                # ดึง schedule แรก (ถ้ามี) เป็นตัวแทน
                first_message_id = messages[0].id
                schedule = db.query(models.MessageSchedule).filter(
                    models.MessageSchedule.customer_type_message_id == first_message_id
                ).first()
                
                if schedule:
                    summaries.append({
                        "group_id": group.id,
                        "group_name": group.type_name,
                        "message_count": len(messages),
                        "send_type": schedule.send_type,
                        "scheduled_at": schedule.scheduled_at,
                        "send_after_inactive": _format_interval_to_string(schedule.send_after_inactive),
                        "frequency": schedule.frequency,
                        "created_at": schedule.created_at
                    })
        
        return summaries
        
    except Exception as e:
        logger.error(f"Error getting group schedule summaries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Helper Functions ====================

async def _get_or_create_page_knowledge(db: Session, page_id: int, knowledge_id: int):
    """Helper function สำหรับหาหรือสร้าง page_customer_type_knowledge record"""
    page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
        models.PageCustomerTypeKnowledge.page_id == page_id,
        models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
    ).first()
    
    if not page_knowledge:
        # สร้างใหม่ถ้ายังไม่มี
        page_knowledge = models.PageCustomerTypeKnowledge(
            page_id=page_id,
            customer_type_knowledge_id=knowledge_id,
            is_enabled=True
        )
        db.add(page_knowledge)
        db.commit()
        db.refresh(page_knowledge)
        logger.info(f"Created new page_customer_type_knowledge record: {page_knowledge.id}")
    
    return page_knowledge

def _parse_interval_string(interval_str: Optional[str]) -> Optional[timedelta]:
    """แปลง string เป็น timedelta object"""
    if not interval_str:
        return None
    
    parts = interval_str.split()
    if len(parts) != 2:
        return None
    
    try:
        value = int(parts[0])
        unit = parts[1].lower()
        
        if unit in ['minute', 'minutes']:
            return timedelta(minutes=value)
        elif unit in ['hour', 'hours']:
            return timedelta(hours=value)
        elif unit in ['day', 'days']:
            return timedelta(days=value)
        elif unit in ['week', 'weeks']:
            return timedelta(weeks=value)
        elif unit in ['month', 'months']:
            return timedelta(days=value * 30)  # โดยประมาณ
        else:
            return None
    except (ValueError, IndexError):
        return None

def _format_interval_to_string(interval: Optional[timedelta]) -> Optional[str]:
    """แปลง timedelta object เป็น string"""
    if not interval:
        return None
    
    total_seconds = interval.total_seconds()
    
    if total_seconds < 3600:  # น้อยกว่า 1 ชั่วโมง
        minutes = int(total_seconds / 60)
        return f"{minutes} minutes"
    elif total_seconds < 86400:  # น้อยกว่า 1 วัน
        hours = int(total_seconds / 3600)
        return f"{hours} hours"
    elif total_seconds < 604800:  # น้อยกว่า 1 สัปดาห์
        days = int(total_seconds / 86400)
        return f"{days} days"
    else:
        weeks = int(total_seconds / 604800)
        return f"{weeks} weeks"