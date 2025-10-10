from app.celery_worker import celery_app
from app.database.database import SessionLocal

@celery_app.task
def sync_customer_messages_task(page_id: str):
    """Celery task สำหรับ sync ข้อความลูกค้า"""
    from app.routes.facebook.psids_sync import sync_messages_for_page # lazy import ป้องกัน circular import

    db = SessionLocal()
    try:
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        result = loop.run_until_complete(
            sync_messages_for_page(page_id, db=db)
        )
        return result
    except Exception as e:
        print(f"❌ sync_customer_messages_task error: {e}")
        raise
    finally:
        db.close()
        loop.close()
