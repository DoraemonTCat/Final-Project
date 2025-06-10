from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database.models import CustomMessage, MessageSets
from app.database.database import get_db
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import base64
import uuid
from datetime import datetime

router = APIRouter()

# กำหนด path สำหรับเก็บไฟล์
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 🔶 Schema สำหรับข้อความเดี่ยว
class MessageCreate(BaseModel):
    message_set_id: int
    page_id: str
    message_type: str = Field(..., pattern="^(text|image|video)$")
    content: str
    display_order: int
    media_data: Optional[str] = None  # base64 encoded media
    filename: Optional[str] = None

# 🔶 Schema สำหรับหลายข้อความ
class MessageBatchCreate(BaseModel):
    messages: List[MessageCreate]

class MessageSetCreate(BaseModel):
    page_id: str
    set_name: str

# 🔶 Schema สำหรับแก้ไขชุดข้อความ
class MessageSetUpdate(BaseModel):
    set_name: str

# ฟังก์ชันสำหรับบันทึกไฟล์จาก base64
def save_media_from_base64(base64_data: str, filename: str, media_type: str) -> str:
    """บันทึกไฟล์จาก base64 และคืน path"""
    try:
        # แยก data URL scheme ออก
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
        
        # Decode base64
        file_data = base64.b64decode(base64_data)
        
        # สร้างชื่อไฟล์ unique
        file_extension = os.path.splitext(filename)[1] or ('.jpg' if media_type == 'image' else '.mp4')
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # กำหนด subdirectory ตาม type
        type_dir = os.path.join(UPLOAD_DIR, f"{media_type}s")
        os.makedirs(type_dir, exist_ok=True)
        
        # path เต็ม
        file_path = os.path.join(type_dir, unique_filename)
        
        # บันทึกไฟล์
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # คืน relative path สำหรับเก็บใน DB
        return f"{media_type}s/{unique_filename}"
        
    except Exception as e:
        print(f"❌ Error saving media: {e}")
        raise HTTPException(status_code=400, detail=f"ไม่สามารถบันทึกไฟล์ได้: {str(e)}")

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
    
    # ลบไฟล์ที่เกี่ยวข้อง (ถ้ามี)
    messages = db.query(CustomMessage).filter(CustomMessage.message_set_id == set_id).all()
    for msg in messages:
        if msg.message_type in ['image', 'video'] and msg.content:
            # ถ้า content เป็น path ของไฟล์
            file_path = os.path.join(UPLOAD_DIR, msg.content)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"✅ ลบไฟล์: {file_path}")
                except Exception as e:
                    print(f"⚠️ ไม่สามารถลบไฟล์: {file_path}, {e}")
    
    # ลบชุดข้อความ (cascade จะลบ messages ที่เกี่ยวข้องอัตโนมัติ)
    db.delete(message_set)
    db.commit()
    return {"status": "deleted", "id": set_id}

# ✅ เพิ่มข้อความใหม่ (เดี่ยว) - รองรับ media
@router.post("/custom_message")
def create_custom_message(data: MessageCreate, db: Session = Depends(get_db)):
    content = data.content
    
    # ถ้าเป็น media และมี base64 data ให้บันทึกไฟล์
    if data.message_type in ['image', 'video'] and data.media_data:
        try:
            media_path = save_media_from_base64(
                data.media_data, 
                data.filename or f"media.{data.message_type}", 
                data.message_type
            )
            # เก็บ path ใน content พร้อมกับชื่อไฟล์เดิม
            content = f"{media_path}|{data.filename or 'untitled'}"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"ไม่สามารถบันทึก media ได้: {str(e)}")
    
    msg = CustomMessage(
        message_set_id=data.message_set_id,
        page_id=data.page_id,
        message_type=data.message_type,
        content=content,
        display_order=data.display_order
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

# ✅ เพิ่มข้อความหลายรายการในชุดเดียว
@router.post("/custom_message/batch")
def create_batch_custom_messages(data: MessageBatchCreate, db: Session = Depends(get_db)):
    new_messages = []
    
    for m in data.messages:
        content = m.content
        
        # ถ้าเป็น media และมี base64 data ให้บันทึกไฟล์
        if m.message_type in ['image', 'video'] and m.media_data:
            try:
                media_path = save_media_from_base64(
                    m.media_data,
                    m.filename or f"media.{m.message_type}",
                    m.message_type
                )
                content = f"{media_path}|{m.filename or 'untitled'}"
            except Exception as e:
                # Rollback ไฟล์ที่บันทึกไปแล้ว
                for msg in new_messages:
                    if msg.message_type in ['image', 'video'] and '|' in msg.content:
                        file_path = os.path.join(UPLOAD_DIR, msg.content.split('|')[0])
                        if os.path.exists(file_path):
                            os.remove(file_path)
                
                raise HTTPException(status_code=400, detail=f"ไม่สามารถบันทึก media ได้: {str(e)}")
        
        new_message = CustomMessage(
            message_set_id=m.message_set_id,
            page_id=m.page_id,
            message_type=m.message_type,
            content=content,
            display_order=m.display_order
        )
        new_messages.append(new_message)
    
    db.add_all(new_messages)
    db.commit()
    return {"status": "created", "count": len(new_messages)}

# ✅ ดึงข้อความในชุดข้อความตาม message_set_id (พร้อม URL สำหรับ media)
@router.get("/custom_messages/{message_set_id}")
def get_custom_messages(message_set_id: int, db: Session = Depends(get_db)):
    messages = db.query(CustomMessage)\
        .filter(CustomMessage.message_set_id == message_set_id)\
        .order_by(CustomMessage.display_order)\
        .all()
    
    # แปลงข้อมูลสำหรับ frontend
    result = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "message_set_id": msg.message_set_id,
            "page_id": msg.page_id,
            "message_type": msg.message_type,
            "content": msg.content,
            "display_order": msg.display_order,
            "created_at": msg.created_at
        }
        
        # ถ้าเป็น media ให้แยก path และชื่อไฟล์
        if msg.message_type in ['image', 'video'] and '|' in msg.content:
            parts = msg.content.split('|', 1)
            msg_dict["media_path"] = parts[0]
            msg_dict["filename"] = parts[1] if len(parts) > 1 else "untitled"
            # สร้าง URL สำหรับเข้าถึงไฟล์
            msg_dict["media_url"] = f"/media/{parts[0]}"
        
        result.append(msg_dict)
    
    return result

# ✅ ลบข้อความตาม id (พร้อมลบไฟล์)
@router.delete("/custom_message/{id}")
def delete_custom_message(id: int, db: Session = Depends(get_db)):
    msg = db.query(CustomMessage).get(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # ลบไฟล์ถ้าเป็น media
    if msg.message_type in ['image', 'video'] and msg.content:
        if '|' in msg.content:
            file_path = os.path.join(UPLOAD_DIR, msg.content.split('|')[0])
        else:
            file_path = os.path.join(UPLOAD_DIR, msg.content)
            
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"✅ ลบไฟล์: {file_path}")
            except Exception as e:
                print(f"⚠️ ไม่สามารถลบไฟล์: {file_path}, {e}")
    
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}

# Endpoint สำหรับอัพโหลดไฟล์โดยตรง (optional)
@router.post("/upload-media")
async def upload_media(
    file: UploadFile = File(...),
    media_type: str = Form(..., pattern="^(image|video)$")
):
    """อัพโหลดไฟล์ media โดยตรง"""
    try:
        # ตรวจสอบ file type
        allowed_image_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        allowed_video_types = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"]
        
        if media_type == "image" and file.content_type not in allowed_image_types:
            raise HTTPException(status_code=400, detail="ไฟล์รูปภาพไม่ถูกต้อง")
        elif media_type == "video" and file.content_type not in allowed_video_types:
            raise HTTPException(status_code=400, detail="ไฟล์วิดีโอไม่ถูกต้อง")
        
        # สร้างชื่อไฟล์ unique
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # กำหนด subdirectory
        type_dir = os.path.join(UPLOAD_DIR, f"{media_type}s")
        os.makedirs(type_dir, exist_ok=True)
        
        # path เต็ม
        file_path = os.path.join(type_dir, unique_filename)
        
        # บันทึกไฟล์
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        return {
            "filename": file.filename,
            "media_path": f"{media_type}s/{unique_filename}",
            "media_url": f"/media/{media_type}s/{unique_filename}",
            "size": len(content),
            "content_type": file.content_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการอัพโหลด: {str(e)}")