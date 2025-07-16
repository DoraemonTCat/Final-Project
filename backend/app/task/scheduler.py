from apscheduler.schedulers.background import BackgroundScheduler
import requests
from app.database.crud import get_all_connected_pages
from app.database.database import SessionLocal

def schedule_facebook_sync():
    db = SessionLocal()
    try:
        all_pages = get_all_connected_pages(db)
        for page_id in all_pages:
            print(f"🔁 Triggering sync for page_id={page_id}")
            requests.get(f"http://localhost:8000/trigger-sync/{page_id}")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(schedule_facebook_sync, 'interval', minutes=1)
    scheduler.start()