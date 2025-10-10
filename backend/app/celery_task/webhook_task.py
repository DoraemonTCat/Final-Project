# app/tasks/webhook_tasks.py
from app.celery_worker import celery_app
from app.database.database import SessionLocal
from celery.exceptions import SoftTimeLimitExceeded
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def sync_new_user_data_task(self, page_id: str, sender_id: str, page_db_id: int):
    """Celery task สำหรับ sync ข้อมูลลูกค้าใหม่จาก webhook"""
    from app.routes.facebook.customers import sync_new_user_data  # lazy import เพื่อหลีกเลี่ยง circular import

    db = SessionLocal()
    try:
        logger.info(f"🆕 [Celery] Syncing new user data for {sender_id} (page_id={page_id})")

        # เรียก async function แบบ sync
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            sync_new_user_data(page_id, sender_id, page_db_id, db)
        )

        logger.info(f"✅ [Celery] Done syncing user {sender_id} for page_id={page_id}")
        return {"status": "success", "sender_id": sender_id, "result": result}

    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout syncing user {sender_id} for page_id={page_id}")
        return {"status": "timeout", "sender_id": sender_id}
    except Exception as e:
        logger.error(f"❌ Error in sync_new_user_data_task: {e}")
        raise
    finally:
        db.close()
        loop.close()