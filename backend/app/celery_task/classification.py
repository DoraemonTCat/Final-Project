# app/tasks/classification.py
from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.database import models
from app.LLM.agent import classify_and_assign_tier_hybrid
import logging
from celery.exceptions import SoftTimeLimitExceeded

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def classify_page_tier_task(self, page_id: str):
    """Task สำหรับจัด tier ให้เพจเดียว"""
    db = SessionLocal()
    try:
        logger.info(f"🔁 Running hybrid classification for page_id={page_id}")
        classify_and_assign_tier_hybrid(db, page_id)
        logger.info(f"✅ Done hybrid classification for page_id={page_id}")
        return {"status": "success", "page_id": page_id}
    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout during classification for page_id={page_id}")
        return {"status": "timeout", "page_id": page_id}
    except Exception as e:
        logger.error(f"❌ Error classifying page_id={page_id}: {e}")
        return {"status": "failed", "error": str(e), "page_id": page_id}
    finally:
        db.close()

@celery_app.task(bind=True)
def scheduled_hybrid_classification_task(self):
    """Task หลัก เรียก classify_page_tier_task สำหรับทุกเพจ"""
    db = SessionLocal()
    try:
        pages = db.query(models.FacebookPage).all()
        logger.info(f"📊 Scheduling hybrid classification for {len(pages)} pages...")

        # รันแบบ parallel (fan-out)
        subtasks = []
        for page in pages:
            t = classify_page_tier_task.apply_async(
                args=[page.ID],
                soft_time_limit=600,  # 5 นาที
                time_limit=720
            )
            subtasks.append(t.id)
        
        return {"scheduled_tasks": subtasks, "page_count": len(pages)}
    finally:
        db.close()
