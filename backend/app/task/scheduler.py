# backend/app/main.py
import logging
from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from app.database.database import SessionLocal
from app.database.crud import get_all_connected_pages, sync_missing_retarget_tiers
from app.database.models import FacebookPage
from app.celery_task.customers import sync_customers_task
from app.celery_task.messages import sync_customer_messages_task
from app.celery_task.classification import classify_page_tier_task
from app.celery_task.auto_sync_tasks import sync_all_pages_task

logger = logging.getLogger(__name__)

app = FastAPI()
scheduler = BackgroundScheduler()

def schedule_facebook_sync():
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            logger.info(f"🔁 Scheduling Celery sync for page_id={page_id}")
            sync_customers_task.delay(page_id)
    finally:
        db.close()

def schedule_facebook_messages_sync():
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            logger.info(f"🔁 Scheduling Celery sync messages for page_id={page_id}")
            sync_customer_messages_task.delay(page_id)
    finally:
        db.close()

def scheduled_hybrid_classification():
    db = SessionLocal()
    try:
        pages = db.query(FacebookPage).all()
        for page in pages:
            classify_page_tier_task.delay(page.ID)
            logger.info(f"✅ Scheduled hybrid classification for page_id={page.ID}")
    finally:
        db.close()

def sync_all_pages_task_wrapper():
    # Wrapper สำหรับเรียก Celery task
    sync_all_pages_task.delay()
    logger.info("✅ Scheduled sync_all_pages_task")

def sync_missing_tiers_on_startup():
    db = SessionLocal()
    try:
        result = sync_missing_retarget_tiers(db)
        logger.info(f"✅ Initial retarget tiers sync completed: {result}")
    except Exception as e:
        logger.error(f"❌ Failed initial retarget tiers sync: {e}")
    finally:
        db.close()

def start_scheduler():
    """เริ่มต้น scheduler สำหรับ background tasks"""
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=5, max_instances=5, coalesce=True, misfire_grace_time=120)
    scheduler.add_job(schedule_facebook_messages_sync, 'interval', minutes=5, max_instances=5, coalesce=True, misfire_grace_time=120)
    scheduler.add_job(scheduled_hybrid_classification, 'interval', minutes=5, max_instances=5, coalesce=True, misfire_grace_time=120)

    # Sync retarget tiers ตอนเริ่มระบบ
    sync_missing_tiers_on_startup()

    scheduler.start()
    logger.info("✅ Scheduler started successfully")
