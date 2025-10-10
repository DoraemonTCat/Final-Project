from apscheduler.schedulers.background import BackgroundScheduler
import requests
from app.database.crud import get_all_connected_pages, sync_missing_retarget_tiers
from app.database.database import SessionLocal
from app.database import crud
from app.LLM.agent import classify_and_assign_tier_hybrid
from app.database import models
from app.celery_task.customers import sync_customers_task
from app.celery_task.messages import sync_customer_messages_task
from app.celery_task.classification import scheduled_hybrid_classification_task, classify_page_tier_task
from app.celery_task.auto_sync_tasks import sync_all_pages_task
import logging

logger = logging.getLogger(__name__)

SYNC_TIMEOUT = 60*5

# ฟังก์ชันสำหรับ sync ข้อมูลลูกค้าจาก Facebook
def schedule_facebook_sync():
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            print(f"🔁 Scheduling Celery sync for page_id={page_id}")
            sync_customers_task.delay(page_id) 
    finally:
        db.close()

# ฟังก์ชันสำหรับ sync ข้อความจาก Facebook
def schedule_facebook_messages_sync():
    """Sync ข้อความจาก Facebook"""
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            print(f"🔁 Scheduling Celery sync messages for page_id={page_id}")
            sync_customer_messages_task.delay(page_id)  
    finally:
        db.close()

# ฟังก์ชันสำหรับ sync retarget tiers เฉพาะ page ที่ยังไม่มีข้อมูล
def sync_missing_tiers_on_startup():
    """Sync retarget tiers เฉพาะ page ที่ยังไม่มีข้อมูล - ทำครั้งเดียวตอนเริ่มระบบ"""
    db = SessionLocal()
    try:
        result = crud.sync_missing_retarget_tiers(db)
        logger.info(f"✅ Initial retarget tiers sync completed: {result}")
    except Exception as e:
        logger.error(f"❌ Failed initial retarget tiers sync: {e}")
    finally:
        db.close()

def scheduled_hybrid_classification():
    """Trigger Celery hybrid classification"""
    print("🔁 Scheduling hybrid classification via Celery...")
    scheduled_hybrid_classification_task.delay()

def scheduled_hybrid_classification():
    """Trigger Celery hybrid classification"""
    print("🔁 Scheduling hybrid classification via Celery...")
    classify_page_tier_task.delay()

# ฟังก์ชันสำหรับเริ่มต้น scheduler
def start_scheduler():
    """เริ่มต้น scheduler สำหรับ background tasks"""
    scheduler = BackgroundScheduler()
    
    # Sync ข้อมูลลูกค้าทุกๆ 1 นาที (เดิม)
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=1)
    
    # Sync ข้อความทุกนาที (เดิม)
    scheduler.add_job(schedule_facebook_messages_sync, 'interval', minutes=10) 
    
    # 🆕 แก้ไข: เปลี่ยนจาก 1 นาที
    scheduler.add_job(scheduled_hybrid_classification, 'interval', minutes=10)

    scheduler.add_job(sync_all_pages_task.delay, 'interval', minutes=10)
    
    # Sync retarget tiers เฉพาะตอนเริ่มระบบ
    sync_missing_tiers_on_startup()
    
    scheduler.start()
    logger.info("✅ Scheduler started successfully")