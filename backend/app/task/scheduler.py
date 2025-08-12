from apscheduler.schedulers.background import BackgroundScheduler
import requests
from app.database.crud import get_all_connected_pages
from app.database.database import SessionLocal
from app.database import crud, database, models, schemas

# ฟังก์ชันสำหรับรันการ sync ข้อมูลลูกค้าใน background
SYNC_TIMEOUT = 60*5

def schedule_facebook_sync():
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

# ฟังก์ชันสำหรับรันการ sync ข้อมูลข้อความใน background
def schedule_facebook_messages_sync():
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

# ฟังก์ชันสำหรับ sync retarget tiers สำหรับทุก page    
def sync_all_retarget_tiers():
    """Sync retarget tiers สำหรับทุก page ในระบบ"""
    db = SessionLocal()
    try:
        # ดึง pages ทั้งหมด
        pages = db.query(models.FacebookPage).all()
        
        for page in pages:
            try:
                synced_tiers = crud.sync_retarget_tiers_from_knowledge(db, page.ID)
                logger.info(f"✅ Synced {len(synced_tiers)} tiers for page {page.page_name}")
            except Exception as e:
                logger.error(f"❌ Failed to sync tiers for page {page.page_name}: {e}")
                
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=1)
    scheduler.add_job(schedule_facebook_messages_sync, 'interval', hours=1)
    
    # เพิ่ม job สำหรับ sync retarget tiers ทุกวัน
    scheduler.add_job(sync_all_retarget_tiers, 'interval', minutes=1)
    scheduler.start()