from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database import models
from pydantic import BaseModel
from typing import List, Optional
import logging

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