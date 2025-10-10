from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import crud
from app.database.database import get_db
from .auth import get_page_tokens
from app.celery_task.message_sender import send_message_task

router = APIRouter()

class SendMessageRequest(BaseModel):
    message: str
    type: Optional[str] = "text"
    is_system_message: Optional[bool] = False


@router.post("/send/{page_id}/{psid}")
async def send_user_message_by_psid(
    page_id: str,
    psid: str,
    req: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """ส่งข้อความไปยัง user ผ่าน PSID (รันใน Celery)"""
    try:
        page_tokens = get_page_tokens()
        access_token = page_tokens.get(page_id)
        if not access_token:
            raise HTTPException(status_code=400, detail="Page token not found")

        # 🚀 ส่งงานเข้า Celery
        job = send_message_task.delay(
            page_id,
            psid,
            req.message,
            req.type,
            access_token,
            req.is_system_message
        )

        return {
            "success": True,
            "task_id": job.id,
            "message": f"⏳ Message queued to PSID={psid}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))