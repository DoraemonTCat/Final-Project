from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.service.fb_messenger import send_facebook_message
from app.utils.redis_helper import get_page_token
from datetime import datetime, timezone
import logging
import io
import base64

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def send_message_task(
    self,
    page_id: str,
    psid: str,
    message: str = None,
    msg_type: str = "text",
    image_binary: bytes = None,
    is_system_message: bool = False,
    message_tag: str = None
):
    """
    Celery Task: ส่งข้อความหรือรูปภาพผ่าน Facebook Messenger API
    - msg_type: "text" หรือ "image"
    - image_binary: ถ้าเป็นรูป ให้ใส่ binary data
    """
    db = SessionLocal()
    try:
        # 🔑 ดึง access_token จาก Redis
        access_token = get_page_token(page_id)
        if not access_token:
            raise ValueError(f"No access_token found for page_id={page_id}")

        # 🚀 เรียกฟังก์ชันส่งข้อความ/รูป
        tag_allowed = "POST_PURCHASE_UPDATE"
        result = send_facebook_message(
            db=db,
            page_id=page_id,
            psid=psid,
            message=message,
            msg_type=msg_type,
            image_binary=image_binary,
            access_token=access_token,
            is_system_message=is_system_message,
            message_tag=tag_allowed
        )

        # ❌ ถ้า Facebook ส่ง error กลับ
        if "error" in result:
            raise Exception(result["error"])

        logger.info(f"✅ Message sent to PSID={psid} successfully")
        return {"status": "success", "psid": psid, "result": result}

    except Exception as e:
        logger.error(f"❌ Celery error sending message to {psid}: {e}")
        raise
    finally:
        db.close()