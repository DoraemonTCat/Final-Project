from apscheduler.schedulers.background import BackgroundScheduler
import requests
from app.database.crud import get_all_connected_pages
from app.database.database import SessionLocal

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


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=1)
    scheduler.add_job(schedule_facebook_messages_sync, 'interval', hours=1)
    scheduler.start()