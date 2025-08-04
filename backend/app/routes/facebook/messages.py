# backend/app/routes/facebook/messages.py
"""
Facebook Messages Component
จัดการ:
- ส่งข้อความ (text, image, video)
- อัพเดท interaction time
- จัดการ message types
"""

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import crud
from app.database.database import get_db
from app.service.facebook_api import send_message, send_image_binary, send_video_binary
from app.config import image_dir, vid_dir
from .auth import get_page_tokens

router = APIRouter()


class SendMessageRequest(BaseModel):
    message: str
    type: Optional[str] = "text"  # "text", "image", or "video"

# API สำหรับส่งข้อความไปยังผู้ใช้ผ่าน PSID
@router.post("/send/{page_id}/{psid}")
async def send_user_message_by_psid(
    page_id: str,
    psid: str,
    req: SendMessageRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """ส่งข้อความไปยัง user ผ่าน PSID"""
    print(f"📤 กำลังส่งข้อความไปยัง PSID: {psid}")
    print(f"📤 ข้อความ: {req.message}")

    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    
    if not access_token:
        return {"error": "Page token not found. Please connect via /connect first."}

    if not psid or len(psid) < 10:
        return {"error": "Invalid PSID"}

    # ส่งข้อความตามประเภท
    try:
        if req.type == "image":
            image_path = f"{image_dir}/{req.message}"
            result = send_image_binary(psid, image_path, access_token)
        elif req.type == "video":
            video_path = f"{vid_dir}/{req.message}"
            result = send_video_binary(psid, video_path, access_token)
        else:
            result = send_message(psid, req.message, access_token)

        if "error" in result:
            return {"error": result["error"], "details": result}
        else:
           # อัพเดท interaction time ถ้าไม่ใช่ system message
            body = await request.json()
            if not body.get('is_system_message', False):
                page = crud.get_page_by_page_id(db, page_id)
                if page:
                    crud.update_customer_interaction(db, page.ID, psid)
            
            return {"success": True, "result": result}
            
    except Exception as e:
        print(f"❌ Error sending message: {e}")
        return {"error": str(e)}