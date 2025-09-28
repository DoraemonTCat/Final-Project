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
    """Update mining status for multiple customers"""
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        updated_count = 0
        errors = []
        
        # Batch process customers
        for psid in status_update.customer_psids:
            try:
                customer = crud.get_customer_by_psid(db, page.ID, psid)
                if not customer:
                    errors.append(f"Customer {psid} not found")
                    continue
                
                update_customer_mining_status(
                    db, customer, status_update.status, status_update.note
                )
                updated_count += 1
                
            except Exception as e:
                logger.error(f"Error updating status for {psid}: {e}")
                errors.append(f"Error for {psid}: {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors if errors else None,
            "message": f"Successfully updated {updated_count} customers to status: {status_update.status}"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_mining_status: {e}")
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
    """Reset mining status to 'ยังไม่ขุด' for selected customers"""
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        reset_count = 0
        for psid in customer_psids:
            customer = crud.get_customer_by_psid(db, page.ID, psid)
            if customer:
                update_customer_mining_status(
                    db, customer, "ยังไม่ขุด", "Reset status"
                )
                reset_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "reset_count": reset_count,
            "message": f"Reset {reset_count} customers to 'ยังไม่ขุด'"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting mining status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/mining-status/clean-history/{page_id}")
async def clean_mining_history(
    page_id: str,
    db: Session = Depends(get_db)
):
    """Clean old mining status history, keep only latest per customer"""
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Use window function to identify and delete old records
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
        total_deleted = result.rowcount
        
        db.commit()
        
        return {
            "success": True,
            "total_deleted": total_deleted,
            "message": f"Cleaned {total_deleted} old mining status records"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error cleaning mining history: {e}")
        raise HTTPException(status_code=500, detail=str(e))