from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.utils.redis_helper import get_page_token

@celery_app.task
def sync_customer_messages_task(page_id: str):
    from app.routes.facebook.psids_sync import do_sync_messages_for_page
    db = SessionLocal()
    try:
        import asyncio

        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅Success: Token found for page_id={page_id}")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(do_sync_messages_for_page(page_id, db=db))
        return result  # ✅ เป็น dict แล้ว serialize ได้แน่นอน
    except Exception as e:
        print(f"❌ sync_customer_messages_task error: {e}")
        raise
    finally:
        db.close()
        loop.close()
