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
from typing import List, Optional, Union, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging
import base64

from app.database import models, crud
from app.database.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================
class GroupMessageBase(BaseModel):
    message_type: str
    content: str
    display_order: int
    image_data_base64: Optional[str] = None

class GroupMessageCreate(GroupMessageBase):
    page_id: Union[int, str]
    customer_type_custom_id: Optional[Union[int, str]] = None
    page_customer_type_knowledge_id: Optional[int] = None

class GroupMessageUpdate(BaseModel):
    message_type: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None
    image_data_base64: Optional[str] = None

class MessageScheduleBase(BaseModel):
    send_type: str  # immediate, scheduled, after_inactive
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None
    frequency: Optional[str] = "once"

class MessageScheduleCreate(MessageScheduleBase):
    customer_type_message_id: int

class MessageScheduleUpdate(BaseModel):
    send_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[str] = None
    frequency: Optional[str] = None

# ==================== Helper Functions ====================
def process_media_data(base64_data: Optional[str], message_type: str) -> Optional[bytes]:
    """Convert base64 media to binary data"""
    if not base64_data or message_type not in ['image', 'video']:
        return None
    
    try:
        if ',' in base64_data:
            return base64.b64decode(base64_data.split(',')[1])
        return base64.b64decode(base64_data)
    except Exception as e:
        logger.error(f"Error decoding base64: {e}")
        return None

def format_message_with_media(msg: models.CustomerTypeMessage) -> dict:
    """Format message response with media data"""
    result = {
        "id": msg.id,
        "page_id": msg.page_id,
        "customer_type_custom_id": msg.customer_type_custom_id,
        "page_customer_type_knowledge_id": msg.page_customer_type_knowledge_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "display_order": msg.display_order,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "has_image": bool(msg.image_data),
        "has_media": bool(msg.image_data),
        "image_base64": None,
        "media_base64": None
    }
    
    if msg.image_data:
        try:
            media_base64 = base64.b64encode(msg.image_data).decode('utf-8')
            if msg.message_type == 'image':
                result["image_base64"] = f"data:image/jpeg;base64,{media_base64}"
            elif msg.message_type == 'video':
                result["image_base64"] = f"data:video/mp4;base64,{media_base64}"
            result["media_base64"] = result["image_base64"]
        except Exception as e:
            logger.error(f"Error encoding media: {e}")
    
    return result

def parse_interval_string(interval_str: Optional[str]) -> Optional[timedelta]:
    """Convert string to timedelta"""
    if not interval_str:
        return None
    
    parts = interval_str.split()
    if len(parts) != 2:
        return None
    
    try:
        value = int(parts[0])
        unit = parts[1].lower()
        
        unit_map = {
            'minute': timedelta(minutes=value),
            'minutes': timedelta(minutes=value),
            'hour': timedelta(hours=value),
            'hours': timedelta(hours=value),
            'day': timedelta(days=value),
            'days': timedelta(days=value),
            'week': timedelta(weeks=value),
            'weeks': timedelta(weeks=value),
            'month': timedelta(days=value * 30),
            'months': timedelta(days=value * 30)
        }
        
        return unit_map.get(unit)
    except (ValueError, IndexError):
        return None

def format_interval_to_string(interval: Optional[timedelta]) -> Optional[str]:
    """Convert timedelta to string"""
    if not interval:
        return None
    
    total_seconds = interval.total_seconds()
    
    if total_seconds < 3600:
        return f"{int(total_seconds / 60)} minutes"
    elif total_seconds < 86400:
        return f"{int(total_seconds / 3600)} hours"
    elif total_seconds < 604800:
        return f"{int(total_seconds / 86400)} days"
    else:
        return f"{int(total_seconds / 604800)} weeks"

async def get_or_create_page_knowledge(
    db: Session, 
    page_id: int, 
    knowledge_id: int
) -> models.PageCustomerTypeKnowledge:
    """Get or create page_customer_type_knowledge record"""
    page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
        models.PageCustomerTypeKnowledge.page_id == page_id,
        models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
    ).first()
    
    if not page_knowledge:
        page_knowledge = models.PageCustomerTypeKnowledge(
            page_id=page_id,
            customer_type_knowledge_id=knowledge_id,
            is_enabled=True
        )
        db.add(page_knowledge)
        db.commit()
        db.refresh(page_knowledge)
    
    return page_knowledge

# ==================== User Group Messages APIs ====================
@router.post("/group-messages")
async def create_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """Create new group message with media support"""
    try:
        image_binary = process_media_data(message_data.image_data_base64, message_data.message_type)
        
        db_message = models.CustomerTypeMessage(
            page_id=message_data.page_id,
            customer_type_custom_id=message_data.customer_type_custom_id,
            message_type=message_data.message_type,
            content=message_data.content,
            display_order=message_data.display_order,
            image_data=image_binary
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        return {
            "id": db_message.id,
            "page_id": db_message.page_id,
            "customer_type_custom_id": db_message.customer_type_custom_id,
            "message_type": db_message.message_type,
            "content": db_message.content,
            "display_order": db_message.display_order,
            "has_image": bool(db_message.image_data),
            "created_at": db_message.created_at.isoformat() if db_message.created_at else None
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group message: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/group-messages/{page_id}/{group_id}")
async def get_group_messages(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """Get all messages for a user group"""
    messages = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id,
        models.CustomerTypeMessage.customer_type_custom_id == group_id
    ).order_by(models.CustomerTypeMessage.display_order).all()
    
    return [format_message_with_media(msg) for msg in messages]

@router.put("/group-messages/{message_id}")
async def update_group_message(
    message_id: int,
    update_data: GroupMessageUpdate,
    db: Session = Depends(get_db)
):
    """Update group message"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Update only provided fields
    update_dict = update_data.dict(exclude_unset=True)
    
    if 'image_data_base64' in update_dict:
        image_data = update_dict.pop('image_data_base64')
        message.image_data = process_media_data(image_data, update_dict.get('message_type', message.message_type))
    
    for key, value in update_dict.items():
        setattr(message, key, value)
    
    if update_dict.get('message_type') == 'text':
        message.image_data = None
    
    db.commit()
    db.refresh(message)
    
    return {
        "id": message.id,
        "message_type": message.message_type,
        "content": message.content,
        "display_order": message.display_order,
        "has_image": bool(message.image_data)
    }

@router.delete("/group-messages/{message_id}")
async def delete_group_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """Delete group message"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    return {"status": "success"}

# ==================== Knowledge Group Messages APIs ====================
@router.post("/knowledge-group-messages")
async def create_knowledge_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """Create message for knowledge group"""
    try:
        group_id_str = str(message_data.customer_type_custom_id)
        
        if not group_id_str.startswith('knowledge_'):
            raise HTTPException(status_code=400, detail="Invalid knowledge group ID format")
        
        knowledge_id = int(group_id_str.replace('knowledge_', ''))
        page_id_str = str(message_data.page_id)
        
        page = crud.get_page_by_page_id(db, page_id_str)
        if not page:
            raise HTTPException(status_code=404, detail=f"Page not found: {page_id_str}")
        
        page_knowledge = await get_or_create_page_knowledge(db, page.ID, knowledge_id)
        
        image_binary = process_media_data(message_data.image_data_base64, message_data.message_type)
        
        db_message = models.CustomerTypeMessage(
            page_id=page.ID,
            page_customer_type_knowledge_id=page_knowledge.id,
            customer_type_custom_id=None,
            message_type=message_data.message_type,
            content=message_data.content,
            display_order=message_data.display_order,
            image_data=image_binary
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        return {
            "id": db_message.id,
            "page_id": db_message.page_id,
            "page_customer_type_knowledge_id": db_message.page_customer_type_knowledge_id,
            "message_type": db_message.message_type,
            "content": db_message.content,
            "display_order": db_message.display_order,
            "has_image": bool(db_message.image_data),
            "created_at": db_message.created_at.isoformat() if db_message.created_at else None
        }
        
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
    """Get messages for knowledge group"""
    try:
        if isinstance(knowledge_id, str):
            knowledge_id = int(knowledge_id)
        
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return []
        
        page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page.ID,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()
        
        if not page_knowledge:
            return []
        
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_customer_type_knowledge_id == page_knowledge.id
        ).order_by(models.CustomerTypeMessage.display_order).all()
        
        return [format_message_with_media(msg) for msg in messages]
        
    except Exception as e:
        logger.error(f"Error fetching knowledge group messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/knowledge-group-messages/{message_id}")
async def delete_knowledge_group_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """Delete knowledge group message"""
    message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    return {"status": "success"}

# ==================== Batch Operations ====================
@router.post("/group-messages/batch")
async def create_batch_group_messages(
    messages: List[GroupMessageCreate],
    db: Session = Depends(get_db)
):
    """Create multiple messages in batch"""
    try:
        for msg_data in messages:
            image_binary = process_media_data(msg_data.image_data_base64, msg_data.message_type)
            
            db_message = models.CustomerTypeMessage(
                page_id=msg_data.page_id,
                customer_type_custom_id=msg_data.customer_type_custom_id,
                message_type=msg_data.message_type,
                content=msg_data.content,
                display_order=msg_data.display_order,
                image_data=image_binary
            )
            db.add(db_message)
        
        db.commit()
        return {"status": "success", "count": len(messages)}
        
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
    """Delete all messages for a group"""
    deleted = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id,
        models.CustomerTypeMessage.customer_type_custom_id == group_id
    ).delete()
    
    db.commit()
    return {"status": "success", "deleted_count": deleted}

# ==================== Message Schedules APIs ====================
@router.post("/message-schedules")
async def create_message_schedule(
    schedule_data: MessageScheduleCreate,
    db: Session = Depends(get_db)
):
    """Create new message schedule"""
    try:
        interval_value = parse_interval_string(schedule_data.send_after_inactive)
        
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
        
        return {
            "id": db_schedule.id,
            "customer_type_message_id": db_schedule.customer_type_message_id,
            "send_type": db_schedule.send_type,
            "scheduled_at": db_schedule.scheduled_at,
            "frequency": db_schedule.frequency,
            "created_at": db_schedule.created_at,
            "updated_at": db_schedule.updated_at,
            "send_after_inactive": schedule_data.send_after_inactive
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating message schedule: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/message-schedules/group/{page_id}/{group_id}")
async def get_group_schedules(
    page_id: int,
    group_id: str,
    db: Session = Depends(get_db)
):
    """Get all schedules for a group"""
    try:
        message_ids = []
        
        # Check if knowledge group
        if group_id.startswith('knowledge_') or group_id.startswith('group_knowledge_'):
            knowledge_id = int(group_id.replace('group_knowledge_', '').replace('knowledge_', ''))
            
            messages = db.query(models.CustomerTypeMessage).join(
                models.PageCustomerTypeKnowledge,
                models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
            ).filter(
                models.PageCustomerTypeKnowledge.page_id == page_id,
                models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
            ).all()
            
            message_ids = [msg.id for msg in messages]
        else:
            # User group
            group_id_int = int(group_id)
            messages = db.query(models.CustomerTypeMessage).filter(
                models.CustomerTypeMessage.page_id == page_id,
                models.CustomerTypeMessage.customer_type_custom_id == group_id_int
            ).all()
            
            message_ids = [msg.id for msg in messages]
        
        if not message_ids:
            return []
        
        schedules = db.query(models.MessageSchedule).filter(
            models.MessageSchedule.customer_type_message_id.in_(message_ids)
        ).all()
        
        return [
            {
                "id": schedule.id,
                "customer_type_message_id": schedule.customer_type_message_id,
                "send_type": schedule.send_type,
                "scheduled_at": schedule.scheduled_at,
                "frequency": schedule.frequency,
                "created_at": schedule.created_at,
                "updated_at": schedule.updated_at,
                "send_after_inactive": format_interval_to_string(schedule.send_after_inactive)
            }
            for schedule in schedules
        ]
        
    except Exception as e:
        logger.error(f"Error getting group schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/message-schedules/{schedule_id}")
async def update_message_schedule(
    schedule_id: int,
    update_data: MessageScheduleUpdate,
    db: Session = Depends(get_db)
):
    """Update message schedule"""
    schedule = db.query(models.MessageSchedule).filter(
        models.MessageSchedule.id == schedule_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    update_dict = update_data.dict(exclude_unset=True)
    
    if 'send_after_inactive' in update_dict:
        interval_str = update_dict.pop('send_after_inactive')
        schedule.send_after_inactive = parse_interval_string(interval_str)
    
    for key, value in update_dict.items():
        setattr(schedule, key, value)
    
    schedule.updated_at = datetime.now()
    db.commit()
    db.refresh(schedule)
    
    return {
        "id": schedule.id,
        "customer_type_message_id": schedule.customer_type_message_id,
        "send_type": schedule.send_type,
        "scheduled_at": schedule.scheduled_at,
        "frequency": schedule.frequency,
        "created_at": schedule.created_at,
        "updated_at": schedule.updated_at,
        "send_after_inactive": update_data.send_after_inactive
    }

@router.delete("/message-schedules/{schedule_id}")
async def delete_message_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):
    """Delete message schedule"""
    schedule = db.query(models.MessageSchedule).filter(
        models.MessageSchedule.id == schedule_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"status": "success"}

@router.delete("/message-schedules/knowledge-group/{page_id}/{knowledge_id}")
async def delete_knowledge_group_schedules(
    page_id: str,
    knowledge_id: int,
    db: Session = Depends(get_db)
):
    """Delete all schedules for a knowledge group"""
    try:
        # Get page
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Get all messages for knowledge group
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
            # Delete schedules for each message
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

@router.delete("/group-schedule/{page_id}/{group_id}")
async def delete_group_schedule(
    page_id: int,
    group_id: int,
    db: Session = Depends(get_db)
):
    """Delete all schedules for a user group"""
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

@router.delete("/message-schedules/delete-by-group")
async def delete_schedules_by_group(
    page_id: str,
    group_id: str,
    db: Session = Depends(get_db)
):
    """Delete all schedules for a group"""
    try:
        deleted_count = 0
        
        if group_id.startswith('knowledge_'):
            knowledge_id = int(group_id.replace('knowledge_', ''))
            
            messages = db.query(models.CustomerTypeMessage).join(
                models.PageCustomerTypeKnowledge,
                models.CustomerTypeMessage.page_customer_type_knowledge_id == models.PageCustomerTypeKnowledge.id
            ).filter(
                models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
            ).all()
            
            for message in messages:
                deleted = db.query(models.MessageSchedule).filter(
                    models.MessageSchedule.customer_type_message_id == message.id
                ).delete(synchronize_session=False)
                deleted_count += deleted
            
            db.commit()
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "group_type": "knowledge"
            }
        else:
            page = crud.get_page_by_page_id(db, page_id)
            if not page:
                raise HTTPException(status_code=404, detail="Page not found")
            
            messages = db.query(models.CustomerTypeMessage).filter(
                models.CustomerTypeMessage.page_id == page.ID,
                models.CustomerTypeMessage.customer_type_custom_id == int(group_id)
            ).all()
            
            for message in messages:
                deleted = db.query(models.MessageSchedule).filter(
                    models.MessageSchedule.customer_type_message_id == message.id
                ).delete(synchronize_session=False)
                deleted_count += deleted
            
            db.commit()
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "group_type": "user"
            }
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting schedules by group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/message-schedules/batch")
async def create_batch_schedules(
    schedules: List[MessageScheduleCreate],
    db: Session = Depends(get_db)
):
    """Create multiple schedules in batch"""
    try:
        for schedule_data in schedules:
            interval_value = parse_interval_string(schedule_data.send_after_inactive)
            
            db_schedule = models.MessageSchedule(
                customer_type_message_id=schedule_data.customer_type_message_id,
                send_type=schedule_data.send_type,
                scheduled_at=schedule_data.scheduled_at,
                send_after_inactive=interval_value,
                frequency=schedule_data.frequency
            )
            db.add(db_schedule)
        
        db.commit()
        return {"status": "success", "count": len(schedules)}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating batch schedules: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/group-schedule/{page_id}/{group_id}")
async def create_group_schedule(
    page_id: int,
    group_id: int,
    schedule_data: MessageScheduleCreate,
    db: Session = Depends(get_db)
):
    """Create single schedule for all messages in a group"""
    try:
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_id == page_id,
            models.CustomerTypeMessage.customer_type_custom_id == group_id
        ).all()
        
        if not messages:
            raise HTTPException(status_code=404, detail="No messages found for this group")
        
        message_ids = [msg.id for msg in messages]
        
        # Delete old schedules
        db.query(models.MessageSchedule).filter(
            models.MessageSchedule.customer_type_message_id.in_(message_ids)
        ).delete(synchronize_session=False)
        
        # Create new schedules
        interval_value = parse_interval_string(schedule_data.send_after_inactive)
        
        for msg_id in message_ids:
            db_schedule = models.MessageSchedule(
                customer_type_message_id=msg_id,
                send_type=schedule_data.send_type,
                scheduled_at=schedule_data.scheduled_at,
                send_after_inactive=interval_value,
                frequency=schedule_data.frequency
            )
            db.add(db_schedule)
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Created schedule for {len(message_ids)} messages",
            "group_id": group_id
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group schedule: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/group-schedule-summary/{page_id}")
async def get_group_schedule_summaries(
    page_id: int,
    db: Session = Depends(get_db)
):
    """Get schedule summaries for each group"""
    try:
        # Get all groups
        groups = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.page_id == page_id,
            models.CustomerTypeCustom.is_active == True
        ).all()
        
        summaries = []
        
        for group in groups:
            # Get group messages
            messages = db.query(models.CustomerTypeMessage).filter(
                models.CustomerTypeMessage.page_id == page_id,
                models.CustomerTypeMessage.customer_type_custom_id == group.id
            ).all()
            
            if messages:
                # Get first schedule as representative
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
                        "send_after_inactive": format_interval_to_string(schedule.send_after_inactive),
                        "frequency": schedule.frequency,
                        "created_at": schedule.created_at
                    })
        
        return summaries
        
    except Exception as e:
        logger.error(f"Error getting group schedule summaries: {e}")
        raise HTTPException(status_code=500, detail=str(e))