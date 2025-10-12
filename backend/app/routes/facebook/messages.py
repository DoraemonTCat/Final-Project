from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from fastapi.responses import StreamingResponse
from app.database.database import get_db
from app.database import crud
from app.celery_task.message_sender import send_message_task
from app.utils.redis_helper import get_page_token
from app.database.models import CustomerMessage
import io
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class SendMessageRequest(BaseModel):
    message: Optional[str] = None
    type: Optional[str] = "text"  # "text" หรือ "image"
    is_system_message: Optional[bool] = False

@router.post("/send/{page_id}/{psid}")
async def send_user_message(
    page_id: str,
    psid: str,
    req: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """
    ส่งข้อความหรือรูปภาพจาก DB ผ่าน Celery
    - ถ้า type="image" จะดึง binary จาก DB
    - fallback เป็นข้อความถ้าไม่มีรูป
    """
    try:
        # 🔑 ตรวจ token จาก Redis
        access_token = get_page_token(page_id)
        if not access_token:
            raise HTTPException(status_code=400, detail="Page token not found")

        # 🔍 ถ้าเป็นรูป ให้ดึง binary จาก DB
        image_binary = None
        if req.type == "image":
            customer_msg = crud.get_customer_message_by_psid(db, psid)
            if customer_msg and customer_msg.message_binary:
                image_binary = customer_msg.message_binary
            else:
                # fallback เป็นข้อความ
                req.type = "text"
                if not req.message:
                    req.message = "📷 รูปภาพไม่พร้อมส่ง"

        # 🚀 ส่งงานเข้า Celery
        job = send_message_task.delay(
            page_id=page_id,
            psid=psid,
            message=req.message,
            msg_type=req.type,
            image_binary=image_binary,
            is_system_message=req.is_system_message
        )

        return {
            "success": True,
            "task_id": job.id,
            "message": f"⏳ Message queued to PSID={psid}"
        }

    except Exception as e:
        logger.error(f"❌ Error in /send endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/message_image/{message_id}")
def get_message_image(message_id: int, db: Session = Depends(get_db)):
    """Endpoint ดึงรูปจาก DB เป็น StreamingResponse"""
    msg = db.query(CustomerMessage).filter(CustomerMessage.id == message_id).first()
    if not msg or not msg.message_binary:
        raise HTTPException(status_code=404, detail="Image not found")
    return StreamingResponse(io.BytesIO(msg.message_binary), media_type="image/jpeg")