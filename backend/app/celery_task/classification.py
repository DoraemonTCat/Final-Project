# app/tasks/classification.py
from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.database import models
from app.LLM.agent import classify_and_assign_tier_hybrid
import logging
from app.database.models import FacebookPage
from celery.exceptions import SoftTimeLimitExceeded

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def classify_page_tier_task(self, page_id: str):
    """Task สำหรับจัด tier ให้เพจเดียว"""
    db = SessionLocal()
    try:
        logger.info(f"🔁 Running hybrid classification for page_id={page_id}")
        # เรียกฟังก์ชัน classification จริงของคุณ
        classify_and_assign_tier_hybrid(db, page_id)
        logger.info(f"✅ Done hybrid classification for page_id={page_id}")
        return {"status": "success", "page_id": page_id}
    except Exception as e:
        logger.error(f"❌ Error classifying page_id={page_id}: {e}")
        return {"status": "failed", "error": str(e), "page_id": page_id}
    finally:
        db.close()


@celery_app.task(bind=True)
def scheduled_hybrid_classification_task(self):
    """Task หลัก: fan-out ส่ง classify_page_tier_task สำหรับทุกเพจ"""
    db = SessionLocal()
    try:
        pages = db.query(FacebookPage).all()
        logger.info(f"📊 Scheduling hybrid classification for {len(pages)} pages...")

        subtasks = []
        for page in pages:
            # ใช้ apply_async เพื่อ fan-out แต่ละ page เป็น task แยก
            task = classify_page_tier_task.apply_async(
                args=[page.page_id],
                soft_time_limit=600,  # 10 นาที
                time_limit=720
            )
            subtasks.append(task.id)
            logger.info(f"➡ Scheduled task for page_id={page.page_id}, task_id={task.id}")

        return {"scheduled_tasks": subtasks, "page_count": len(pages)}
    finally:
        db.close()