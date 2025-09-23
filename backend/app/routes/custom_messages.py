from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from app.database.database import get_db
from pydantic import BaseModel, Field
from typing import List, Optional
from app.database.models import FBCustomMessage, MessageSets
import base64
import io

router = APIRouter()

# 🔶 Schema สำหรับข้อความเดี่ยว
class MessageCreate(BaseModel):
    message_set_id: int
    page_id: str
    message_type: str = Field(..., pattern="^(text|image|video)$")
    content: str
    display_order: int
    image_data_base64: Optional[str] = None  # เพิ่ม field สำหรับรับ base64

# 🔶 Schema สำหรับหลายข้อความ
class MessageBatchCreate(BaseModel):
    messages: List[MessageCreate]

class MessageSetCreate(BaseModel):
    page_id: str
    set_name: str

# 🔶 Schema สำหรับแก้ไขชุดข้อความ
class MessageSetUpdate(BaseModel):
    set_name: str

# 🔶 Schema สำหรับ response ที่มีรูปภาพ
class MessageResponse(BaseModel):
    id: int
    message_set_id: int
    page_id: str
    message_type: str
    content: str
    display_order: int
    has_image: bool
    image_base64: Optional[str] = None
    created_at: Optional[str] = None

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

# ✅ ลบชุดข้อความ
@router.delete("/message_set/{set_id}")
def delete_message_set(set_id: int, db: Session = Depends(get_db)):
    message_set = db.query(MessageSets).filter(MessageSets.id == set_id).first()
    if not message_set:
        raise HTTPException(status_code=404, detail="Message set not found")
    
    db.delete(message_set)
    db.commit()
    return {"status": "deleted", "id": set_id}

# ✅ เพิ่มข้อความใหม่ (เดี่ยว) - รองรับ binary image
@router.post("/custom_message")
def create_custom_message(data: MessageCreate, db: Session = Depends(get_db)):
    # แปลง base64 เป็น binary ถ้ามี
    image_binary = None
    if data.image_data_base64 and data.message_type == 'image':
        try:
            # ตัด prefix 'data:image/...;base64,' ออกถ้ามี
            if ',' in data.image_data_base64:
                image_binary = base64.b64decode(data.image_data_base64.split(',')[1])
            else:
                image_binary = base64.b64decode(data.image_data_base64)
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
    
    msg = FBCustomMessage(
        message_set_id=data.message_set_id,
        page_id=data.page_id,
        message_type=data.message_type,
        content=data.content,
        display_order=data.display_order,
        image_data=image_binary  # เก็บ binary data
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    # ส่งกลับโดยไม่มี image data (เพื่อประหยัด bandwidth)
    return {
        "id": msg.id,
        "message_set_id": msg.message_set_id,
        "page_id": msg.page_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "display_order": msg.display_order,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }

# ✅ เพิ่มข้อความหลายรายการในชุดเดียว - รองรับ binary image
@router.post("/custom_message/batch")
def create_batch_custom_messages(data: MessageBatchCreate, db: Session = Depends(get_db)):
    new_messages = []
    for m in data.messages:
        # แปลง base64 เป็น binary ถ้ามี
        image_binary = None
        if m.image_data_base64 and m.message_type == 'image':
            try:
                if ',' in m.image_data_base64:
                    image_binary = base64.b64decode(m.image_data_base64.split(',')[1])
                else:
                    image_binary = base64.b64decode(m.image_data_base64)
            except Exception as e:
                print(f"Error decoding base64 image: {e}")
        
        new_messages.append(FBCustomMessage(
            message_set_id=m.message_set_id,
            page_id=m.page_id,
            message_type=m.message_type,
            content=m.content,
            display_order=m.display_order,
            image_data=image_binary
        ))
    
    db.add_all(new_messages)
    db.commit()
    return {"status": "created", "count": len(new_messages)}

# ✅ ดึงข้อความในชุดข้อความตาม message_set_id - รวม image binary
@router.get("/custom_messages/{message_set_id}")
def get_custom_messages(message_set_id: int, db: Session = Depends(get_db)):
    messages = db.query(FBCustomMessage)\
        .filter(FBCustomMessage.message_set_id == message_set_id)\
        .order_by(FBCustomMessage.display_order)\
        .all()
    
    # แปลงข้อความเป็น response format พร้อม base64 image
    response_messages = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "message_set_id": msg.message_set_id,
            "page_id": msg.page_id,
            "message_type": msg.message_type,
            "content": msg.content,
            "display_order": msg.display_order,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "has_image": bool(msg.image_data),
            "image_base64": None
        }
        
        # ถ้ามี image data ให้แปลงเป็น base64
        if msg.image_data:
            try:
                image_base64 = base64.b64encode(msg.image_data).decode('utf-8')
                msg_dict["image_base64"] = f"data:image/jpeg;base64,{image_base64}"
            except Exception as e:
                print(f"Error encoding image to base64: {e}")
        
        response_messages.append(msg_dict)
    
    return response_messages

# ✅ ดึงรูปภาพแบบ binary โดยตรง
@router.get("/custom_message/{message_id}/image")
def get_message_image(message_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import Response
    
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not msg.image_data:
        raise HTTPException(status_code=404, detail="No image found for this message")
    
    # ส่งคืนรูปภาพเป็น binary โดยตรง
    return Response(content=msg.image_data, media_type="image/jpeg")

# ✅ ลบข้อความตาม id
@router.delete("/custom_message/{id}")
def delete_custom_message(id: int, db: Session = Depends(get_db)):
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}

# 🆕 อัพเดทข้อความพร้อมรูปภาพ
@router.put("/custom_message/{message_id}")
def update_custom_message(
    message_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db)
):
    msg = db.query(FBCustomMessage).filter(FBCustomMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # อัพเดทข้อมูล
    msg.message_type = data.message_type
    msg.content = data.content
    msg.display_order = data.display_order
    
    # อัพเดทรูปภาพถ้ามี
    if data.image_data_base64 and data.message_type == 'image':
        try:
            if ',' in data.image_data_base64:
                msg.image_data = base64.b64decode(data.image_data_base64.split(',')[1])
            else:
                msg.image_data = base64.b64decode(data.image_data_base64)
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
    elif data.message_type != 'image':
        # ถ้าเปลี่ยนประเภทเป็นไม่ใช่รูปภาพ ให้ลบรูปภาพออก
        msg.image_data = None
    
    db.commit()
    db.refresh(msg)
    
    return {
        "id": msg.id,
        "message_set_id": msg.message_set_id,
        "page_id": msg.page_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "display_order": msg.display_order,
        "has_image": bool(msg.image_data)
    }