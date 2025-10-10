"""
Mining Status Management API
จัดการสถานะการขุดของลูกค้า
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.database.database import get_db
from app.database import models, crud
from app.celery_task.mining_tasks import (
    update_mining_status_task,
    reset_mining_status_task,
    clean_mining_history_task,
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Pydantic Schemas ===============
class MiningStatusUpdate(BaseModel):
    customer_psids: List[str]
    status: str  # 'ยังไม่ขุด', 'ขุดแล้ว', 'มีการตอบกลับ'
    note: Optional[str] = None

class MiningStatusResponse(BaseModel):
    customer_psid: str
    status: str
    note: Optional[str]
    created_at: datetime

# =============== Helper Functions ===============
def update_customer_mining_status(
    db: Session,
    customer: models.FbCustomer,
    status: str,
    note: Optional[str] = None
) -> models.FBCustomerMiningStatus:
    """Update mining status for a customer"""
    # Delete old status records
    db.query(models.FBCustomerMiningStatus).filter(
        models.FBCustomerMiningStatus.customer_id == customer.id
    ).delete()
    
    # Create new status
    new_status = models.FBCustomerMiningStatus(
        customer_id=customer.id,
        status=status,
        note=note or f"Updated at {datetime.now()}"
    )
    db.add(new_status)
    return new_status

def get_page_mining_statuses(db: Session, page_id: int) -> Dict[str, Dict[str, Any]]:
    """Get mining statuses for all customers in a page"""
    query = """
        SELECT 
            c.customer_psid,
            ms.status,
            ms.note,
            ms.created_at
        FROM fb_customers c
        LEFT JOIN fb_customer_mining_status ms ON c.id = ms.customer_id
        WHERE c.page_id = :page_id
        ORDER BY c.customer_psid
    """
    
    result = db.execute(text(query), {"page_id": page_id})
    
    statuses = {}
    for row in result:
        statuses[row[0]] = {
            "status": row[1] or "ยังไม่ขุด",
            "note": row[2],
            "created_at": row[3]
        }
    
    return statuses

# =============== API Endpoints ===============
@router.post("/mining-status/update/{page_id}")
async def update_mining_status(
    page_id: str,
    status_update: MiningStatusUpdate,
    db: Session = Depends(get_db)
):
    """Trigger Celery task เพื่ออัปเดตสถานะลูกค้า"""
    try:
        # ✅ ส่งงานเข้า queue
        job = update_mining_status_task.delay(
            page_id,
            status_update.customer_psids,
            status_update.status,
            status_update.note
        )

        return {
            "success": True,
            "task_id": job.id,
            "message": f"⏳ Celery job queued to update {len(status_update.customer_psids)} customers."
        }

    except Exception as e:
        logger.error(f"❌ Error queuing mining update: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mining-status/{page_id}")
async def get_mining_statuses(
    page_id: str,
    db: Session = Depends(get_db)
):
    """Get current mining statuses for all customers in a page"""
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        statuses = get_page_mining_statuses(db, page.ID)
        
        return {
            "success": True,
            "statuses": statuses
        }
        
    except Exception as e:
        logger.error(f"Error getting mining statuses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mining-status/reset/{page_id}")
async def reset_mining_status(
    page_id: str,
    customer_psids: List[str],
    db: Session = Depends(get_db)
):
    """Trigger Celery task เพื่อรีเซ็ตสถานะลูกค้า"""
    try:
        job = reset_mining_status_task.delay(page_id, customer_psids)
        return {"success": True, "task_id": job.id, "message": "⏳ Celery job queued to reset mining statuses."}
    except Exception as e:
        logger.error(f"Error queuing reset task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/mining-status/clean-history/{page_id}")
async def clean_mining_history(
    page_id: str,
    db: Session = Depends(get_db)
):
    """Trigger Celery task เพื่อล้าง record เก่าของสถานะ"""
    try:
        job = clean_mining_history_task.delay(page_id)
        return {"success": True, "task_id": job.id, "message": "⏳ Celery job queued to clean mining history."}
    except Exception as e:
        logger.error(f"Error queuing clean task: {e}")
        raise HTTPException(status_code=500, detail=str(e))