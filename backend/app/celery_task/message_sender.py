from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.service.fb_messenger import send_facebook_message
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def send_message_task(
    self,
    page_id: str,
    psid: str,
    message: str,
    msg_type: str = "text",
    access_token: str = None,
    is_system_message: bool = False
):
    """
    Celery Task: ส่งข้อความผ่าน Facebook Messenger API
    """
    db = SessionLocal()
    try:
        result = send_facebook_message(
            db=db,
            page_id=page_id,
            psid=psid,
            message=message,
            msg_type=msg_type,
            access_token=access_token,
            is_system_message=is_system_message
        )

        if "error" in result:
            raise Exception(result["error"])

        return {"status": "success", "psid": psid, "result": result}

    except Exception as e:
        logger.error(f"❌ Celery error sending message to {psid}: {e}")
        raise
    finally:
        db.close()