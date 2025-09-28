from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database.database import get_db
from pydantic import BaseModel, Field
from typing import List, Optional
from app.database.models import FBCustomMessage, MessageSets
import base64
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Pydantic Schemas ===============
class MessageBase(BaseModel):
    message_set_id: int
    page_id: str
    message_type: str = Field(..., pattern="^(text|image|video)$")
    content: str
    display_order: int
    image_data_base64: Optional[str] = None

class MessageCreate(MessageBase):
    pass

class MessageBatchCreate(BaseModel):
    messages: List[MessageCreate]

class MessageSetBase(BaseModel):
    set_name: str

class MessageSetCreate(MessageSetBase):
    page_id: str

class MessageSetUpdate(MessageSetBase):
    pass

# =============== Helper Functions ===============
def process_image_data(image_data_base64: Optional[str], message_type: str) -> Optional[bytes]:
    """Convert base64 image to binary data"""
    if not image_data_base64 or message_type not in ['image', 'video']:
        return None
    
    try:
        # Remove data URL prefix if present
        if ',' in image_data_base64:
            return base64.b64decode(image_data_base64.split(',')[1])
        return base64.b64decode(image_data_base64)
    except Exception as e:
        logger.error(f"Error decoding base64: {e}")
        return None

def format_message_response(msg: FBCustomMessage, include_image: bool = False) -> dict:
    """Format message for response"""
    response = {
        "id": msg.id,
        "message_set_id": msg.message_set_id,
        "page_id": msg.page_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "display_order": msg.display_order,
        "has_image": bool(msg.image_data),
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }
    
    if include_image and msg.image_data:
        try:
            image_base64 = base64.b64encode(msg.image_data).decode('utf-8')
            media_type = "image" if msg.message_type == 'image' else "video"
            media_subtype = "jpeg" if msg.message_type == 'image' else "mp4"
            response["image_base64"] = f"data:{media_type}/{media_subtype};base64,{image_base64}"
        except Exception as e:
            logger.error(f"Error encoding image: {e}")
            response["image_base64"] = None
    else:
        response["image_base64"] = None
    
    return response

def create_message_record(data: MessageCreate, db: Session) -> FBCustomMessage:
    """Create a new message record"""
    image_binary = process_image_data(data.image_data_base64, data.message_type)
    
    msg = FBCustomMessage(
        message_set_id=data.message_set_id,
        page_id=data.page_id,
        message_type=data.message_type,
        content=data.content,
        display_order=data.display_order,
        image_data=image_binary
    )
    db.add(msg)
    return msg

# =============== Message Sets APIs ===============
@router.post("/message_set")
def create_message_set(data: MessageSetCreate, db: Session = Depends(get_db)):
    """Create new message set"""
    new_set = MessageSets(page_id=data.page_id, set_name=data.set_name)
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set

@router.get("/message_sets/{page_id}")
def get_message_sets_by_page(page_id: str, db: Session = Depends(get_db)):
    """Get all message sets for a page"""
    sets = (db.query(MessageSets)
            .filter(MessageSets.page_id == page_id)
            .order_by(MessageSets.created_at.desc())
            .all())
    return sets

@router.put("/message_set/{set_id}")
def update_message_set(set_id: int, data: MessageSetUpdate, db: Session = Depends(get_db)):
    """Update message set name"""
    message_set = db.query(MessageSets).filter(MessageSets.id == set_id).first()
    if not message_set:
        raise HTTPException(status_code=404, detail="Message set not found")
    
    message_set.set_name = data.set_name
    db.commit()
    db.refresh(message_set)
    return message_set

@router.delete("/message_set/{set_id}")
def delete_message_set(set_id: int, db: Session = Depends(get_db)):
    """Delete message set and all its messages"""
    message_set = db.query(MessageSets).filter(MessageSets.id == set_id).first()
    if not message_set:
        raise HTTPException(status_code=404, detail="Message set not found")
    
    # Cascade delete will handle messages
    db.delete(message_set)
    db.commit()
    return {"status": "deleted", "id": set_id}

# =============== Message APIs ===============
@router.post("/custom_message")
def create_custom_message(data: MessageCreate, db: Session = Depends(get_db)):
    """Create single custom message"""
    msg = create_message_record(data, db)
    db.commit()
    db.refresh(msg)
    return format_message_response(msg)

@router.post("/custom_message/batch")
def create_batch_custom_messages(data: MessageBatchCreate, db: Session = Depends(get_db)):
    """Create multiple messages in batch"""
    try:
        for message_data in data.messages:
            create_message_record(message_data, db)
        
        db.commit()
        return {"status": "created", "count": len(data.messages)}
    except Exception as e:
        db.rollback()
        logger.error(f"Batch creation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/custom_messages/{message_set_id}")
def get_custom_messages(message_set_id: int, db: Session = Depends(get_db)):
    """Get all messages in a message set"""
    messages = (db.query(FBCustomMessage)
                .filter(FBCustomMessage.message_set_id == message_set_id)
                .order_by(FBCustomMessage.display_order)
                .all())
    
    return [format_message_response(msg, include_image=True) for msg in messages]

@router.get("/custom_message/{message_id}/image")
def get_message_image(message_id: int, db: Session = Depends(get_db)):
    """Get message image as binary"""
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not msg.image_data:
        raise HTTPException(status_code=404, detail="No image found for this message")
    
    media_type = "image/jpeg" if msg.message_type == 'image' else "video/mp4"
    return Response(content=msg.image_data, media_type=media_type)

@router.put("/custom_message/{message_id}")
def update_custom_message(message_id: int, data: MessageCreate, db: Session = Depends(get_db)):
    """Update existing message"""
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Update fields
    msg.message_type = data.message_type
    msg.content = data.content
    msg.display_order = data.display_order
    
    # Update image if provided
    if data.image_data_base64:
        msg.image_data = process_image_data(data.image_data_base64, data.message_type)
    elif data.message_type == 'text':
        msg.image_data = None
    
    db.commit()
    db.refresh(msg)
    return format_message_response(msg)

@router.delete("/custom_message/{id}")
def delete_custom_message(id: int, db: Session = Depends(get_db)):
    """Delete single message"""
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}