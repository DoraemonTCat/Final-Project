from app.celery_worker import celery_app
from app.database.database import SessionLocal
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import text
from app.database import crud, models
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def update_mining_status_task(self, page_id: str, psids: list, status: str, note: str = None):
    """Celery task สำหรับอัปเดต mining status ของลูกค้าหลายคน"""
    from app.routes.mining_status import update_customer_mining_status  # lazy import เพื่อเลี่ยง circular import

    db = SessionLocal()
    updated_count = 0
    errors = []

    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise ValueError(f"Page not found: {page_id}")

        for psid in psids:
            try:
                customer = crud.get_customer_by_psid(db, page.ID, psid)
                if not customer:
                    errors.append(f"❌ Customer {psid} not found")
                    continue

                update_customer_mining_status(db, customer, status, note)
                updated_count += 1

            except Exception as e:
                logger.error(f"Error updating status for {psid}: {e}")
                errors.append(str(e))

        db.commit()
        logger.info(f"✅ Updated {updated_count}/{len(psids)} customers to '{status}'")

        return {
            "status": "success",
            "updated": updated_count,
            "errors": errors,
        }

    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout while updating mining status for {page_id}")
        return {"status": "timeout"}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ update_mining_status_task failed: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def reset_mining_status_task(self, page_id: str, psids: list):
    """รีเซ็ตสถานะลูกค้าเป็น 'ยังไม่ขุด'"""
    from app.routes.mining_status import update_customer_mining_status

    db = SessionLocal()
    reset_count = 0
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise ValueError(f"Page not found: {page_id}")

        for psid in psids:
            customer = crud.get_customer_by_psid(db, page.ID, psid)
            if customer:
                update_customer_mining_status(db, customer, "ยังไม่ขุด", "Reset status")
                reset_count += 1

        db.commit()
        logger.info(f"✅ Reset {reset_count} customers on page {page_id}")
        return {"status": "success", "reset_count": reset_count}

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error resetting mining status: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def clean_mining_history_task(self, page_id: str):
    """ล้าง record เก่าของสถานะ (เก็บเฉพาะล่าสุด)"""
    db = SessionLocal()
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise ValueError(f"Page not found: {page_id}")

        query = """
            DELETE FROM fb_customer_mining_status
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY customer_id 
                               ORDER BY created_at DESC
                           ) as rn
                    FROM fb_customer_mining_status
                    WHERE customer_id IN (
                        SELECT id FROM fb_customers WHERE page_id = :page_id
                    )
                ) ranked
                WHERE rn > 1
            )
        """
        result = db.execute(text(query), {"page_id": page.ID})
        db.commit()

        logger.info(f"🧹 Cleaned {result.rowcount} old mining records for page {page_id}")
        return {"status": "success", "deleted": result.rowcount}

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error cleaning mining history: {e}")
        raise
    finally:
        db.close()