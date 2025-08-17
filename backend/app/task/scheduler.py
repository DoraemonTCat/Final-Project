from apscheduler.schedulers.background import BackgroundScheduler
import requests
from app.database.crud import get_all_connected_pages, sync_missing_retarget_tiers
from app.database.database import SessionLocal
from app.database import crud
from app.LLM.agent import classify_and_assign_tier_hybrid
from app.database import models
import logging

logger = logging.getLogger(__name__)

SYNC_TIMEOUT = 60*5

# ฟังก์ชันสำหรับ sync ข้อมูลลูกค้าจาก Facebook
def schedule_facebook_sync():
    """Sync ข้อมูลลูกค้าจาก Facebook"""
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            try:
                print(f"🔁 Triggering sync for page_id={page_id}")
                r = requests.get(
                    f"http://localhost:8000/trigger-sync/{page_id}",
                    timeout=SYNC_TIMEOUT
                )
                r.raise_for_status()
            except Exception as e:
                print(f"❌ Failed syncing page_id={page_id}: {e}")
    finally:
        db.close()

# ฟังก์ชันสำหรับ sync ข้อความจาก Facebook
def schedule_facebook_messages_sync():
    """Sync ข้อความจาก Facebook"""
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            try:
                print(f"🔁 Triggering sync messages for page_id={page_id}")
                r = requests.get(
                    f"http://localhost:8000/trigger-messages-sync/{page_id}",
                    timeout=SYNC_TIMEOUT
                )
                r.raise_for_status()
            except Exception as e:
                print(f"❌ Failed syncing messages for page_id={page_id}: {e}")
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
    db = SessionLocal()
    try:
        # ดึง pages ทั้งหมดที่ connect อยู่
        pages = db.query(models.FacebookPage).all()
        for page in pages:
            try:
                logger.info(f"🔁 Running hybrid classification for page_id={page.ID}")
                classify_and_assign_tier_hybrid(db, page.ID)
                logger.info(f"✅ Done hybrid classification for page_id={page.ID}")
            except Exception as e:
                logger.error(f"❌ Error classifying page_id={page.ID}: {e}")
    finally:
        db.close()

# ฟังก์ชันสำหรับเริ่มต้น scheduler
def start_scheduler():
    """เริ่มต้น scheduler สำหรับ background tasks"""
    scheduler = BackgroundScheduler()
    
    # Sync ข้อมูลลูกค้าทุกนาที
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=1)
    
    # Sync ข้อความทุกชั่วโมง
    scheduler.add_job(schedule_facebook_messages_sync, 'interval', minutes=1)

    # clssi
    scheduler.add_job(scheduled_hybrid_classification, 'interval', minutes=1)
    
    # Sync retarget tiers เฉพาะตอนเริ่มระบบ (ครั้งเดียว)
    sync_missing_tiers_on_startup()
    
    scheduler.start()
    logger.info("✅ Scheduler started successfully")