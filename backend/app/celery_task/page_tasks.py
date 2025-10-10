# backend/app/celery_app/tasks/pages.py
from celery import shared_task
from app.database.database import SessionLocal
from app.database import crud
import logging

logger = logging.getLogger(__name__)

@shared_task
def create_page_task(page_data: dict):
    """สร้างเพจใหม่ใน background"""
    db = SessionLocal()
    try:
        page = crud.create_page(db, page_data)
        if not page:
            logger.warning("Page already exists")
            return {"status": "failed", "reason": "Page already exists"}
        logger.info(f"✅ Page created: {page.page_name}")
        return {"status": "success", "page_id": page.page_id}
    except Exception as e:
        logger.exception("❌ Error creating page")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@shared_task
def update_page_task(page_id: str, update_data: dict):
    """อัปเดตข้อมูลเพจ"""
    db = SessionLocal()
    try:
        updated = crud.update_page(db, page_id, update_data)
        if not updated:
            logger.warning(f"Page {page_id} not found for update")
            return {"status": "failed", "reason": "Page not found"}
        logger.info(f"✅ Page updated: {page_id}")
        return {"status": "success", "page_id": page_id}
    except Exception as e:
        logger.exception("❌ Error updating page")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@shared_task
def delete_page_task(page_id: str):
    """ลบเพจ"""
    db = SessionLocal()
    try:
        deleted = crud.delete_page(db, page_id)
        if not deleted:
            logger.warning(f"Page {page_id} not found for delete")
            return {"status": "failed", "reason": "Page not found"}
        logger.info(f"✅ Page deleted: {page_id}")
        return {"status": "success", "page_id": page_id}
    except Exception as e:
        logger.exception("❌ Error deleting page")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
