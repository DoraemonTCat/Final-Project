# app/celery_task/customer_task.py
import asyncio
from datetime import datetime
from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.database import crud
from app.service.auto_sync_service import auto_sync_service
from celery.exceptions import SoftTimeLimitExceeded
from app.utils.redis_helper import get_page_token
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def handle_new_customer_task(self, page_id: str, participant_id: str, participant_name: str, convo_id: str, access_token: str):
    """Celery task สำหรับสร้างลูกค้าใหม่"""
    db = SessionLocal()
    try:
        logger.info(f"🆕 [Celery] Creating new customer: {participant_name} ({participant_id}) | page={page_id}")

        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"Page {page_id} not found"}
        
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            auto_sync_service._handle_new_customer(page, participant_id, participant_name, convo_id, access_token, db)
        )
        loop.close()

        db.commit()
        logger.info(f"✅ Customer created: {participant_name}")
        return {"status": "success", "psid": participant_id, "result": result}

    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout creating new customer {participant_name}")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"❌ Error creating customer: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def handle_existing_customer_task(self, page_id: str, customer_psid: str, msg_time: str):
    """Celery task สำหรับอัปเดต interaction และ mining status"""
    db = SessionLocal()
    try:
        logger.info(f"📝 [Celery] Updating existing customer {customer_psid} | page={page_id}")

        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"Page {page_id} not found"}
        
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")

        customer = crud.get_customer_by_psid(db, page.ID, customer_psid)
        if not customer:
            return {"error": f"Customer {customer_psid} not found"}

        crud.update_customer_interaction(db, page.ID, customer_psid)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            auto_sync_service._update_mining_status_if_needed(db, customer, msg_time, page_id)
        )
        loop.close()

        db.commit()
        logger.info(f"✅ Updated interaction & mining for {customer_psid}")
        return {"status": "success", "psid": customer_psid}

    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout updating {customer_psid}")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"❌ Error updating {customer_psid}: {e}")
        raise
    finally:
        db.close()
