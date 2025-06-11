from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.models import CustomMessage, MessageSets
from app.database.database import get_db
from pydantic import BaseModel, Field
from typing import List

router = APIRouter()

# 🔶 Schema สำหรับข้อความเดี่ยว
class MessageCreate(BaseModel):
    message_set_id: int
    page_id: str
    message_type: str = Field(..., pattern="^(text|image|video)$")# จำกัดชนิด
    content: str
    display_order: int

# 🔶 Schema สำหรับหลายข้อความ
class MessageBatchCreate(BaseModel):
    messages: List[MessageCreate]

class MessageSetCreate(BaseModel):
    page_id: str
    set_name: str

# 🔶 Schema สำหรับแก้ไขชุดข้อความ
class MessageSetUpdate(BaseModel):
    set_name: str

@router.post("/message_set")
def create_message_set(data: MessageSetCreate, db: Session = Depends(get_db)):
    new_set = MessageSets(
        page_id=data.page_id,
        set_name=data.set_name
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set

@router.get("/message_sets/{page_id}")
def get_message_sets_by_page(page_id: str, db: Session = Depends(get_db)):
    sets = db.query(MessageSets).filter(MessageSets.page_id == page_id).order_by(MessageSets.created_at.desc()).all()
    return sets

# ✅ แก้ไขชื่อชุดข้อความ
@router.put("/message_set/{set_id}")
def update_message_set(set_id: int, data: MessageSetUpdate, db: Session = Depends(get_db)):
    message_set = db.query(MessageSets).filter(MessageSets.id == set_id).first()
    if not message_set:
        raise HTTPException(status_code=404, detail="Message set not found")
    
    message_set.set_name = data.set_name
    db.commit()
    db.refresh(message_set)
    return message_set

# ✅ ลบชุดข้อความ (จะลบข้อความทั้งหมดในชุดด้วย cascade)
@router.delete("/message_set/{set_id}")
def delete_message_set(set_id: int, db: Session = Depends(get_db)):
    message_set = db.query(MessageSets).filter(MessageSets.id == set_id).first()
    if not message_set:
        raise HTTPException(status_code=404, detail="Message set not found")
    
    # ลบชุดข้อความ (cascade จะลบ messages ที่เกี่ยวข้องอัตโนมัติ)
    db.delete(message_set)
    db.commit()
    return {"status": "deleted", "id": set_id}

# ✅ เพิ่มข้อความใหม่ (เดี่ยว)
@router.post("/custom_message")
def create_custom_message(data: MessageCreate, db: Session = Depends(get_db)):
    msg = CustomMessage(
        message_set_id=data.message_set_id,
        page_id=data.page_id,
        message_type=data.message_type,
        content=data.content,
        display_order=data.display_order
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

# ✅ เพิ่มข้อความหลายรายการในชุดเดียว
@router.post("/custom_message/batch")
def create_batch_custom_messages(data: MessageBatchCreate, db: Session = Depends(get_db)):
    new_messages = [
        CustomMessage(
            message_set_id=m.message_set_id,
            page_id=m.page_id,
            message_type=m.message_type,
            content=m.content,
            display_order=m.display_order
        ) for m in data.messages
    ]
    db.add_all(new_messages)
    db.commit()
    return {"status": "created", "count": len(new_messages)}

# ✅ ดึงข้อความในชุดข้อความตาม message_set_id
@router.get("/custom_messages/{message_set_id}")
def get_custom_messages(message_set_id: int, db: Session = Depends(get_db)):
    messages = db.query(CustomMessage)\
        .filter(CustomMessage.message_set_id == message_set_id)\
        .order_by(CustomMessage.display_order)\
        .all()
    return messages

# ✅ ลบข้อความตาม id
@router.delete("/custom_message/{id}")
def delete_custom_message(id: int, db: Session = Depends(get_db)):
    msg = db.query(CustomMessage).get(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}