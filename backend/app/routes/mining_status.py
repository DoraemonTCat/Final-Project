# backend/app/routes/mining_status.py
"""
Mining Status Management API
จัดการสถานะการขุดของลูกค้า
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from app.database.database import get_db
from app.database import models, crud
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Schemas
class MiningStatusUpdate(BaseModel):
    customer_psids: List[str]
    status: str  # 'ยังไม่ขุด', 'ขุดแล้ว', 'มีการตอบกลับ'
    note: Optional[str] = None

class MiningStatusResponse(BaseModel):
    customer_psid: str
    status: str
    note: Optional[str]
    created_at: datetime

# API สำหรับอัพเดทสถานะการขุด (เมื่อกดขุด)
@router.post("/mining-status/update/{page_id}")
async def update_mining_status(
    page_id: str,
    status_update: MiningStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    อัพเดทสถานะการขุดสำหรับลูกค้าหลายคน
    เรียกใช้เมื่อกดปุ่มขุด
    """
    try:
        # ดึง page record
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        updated_count = 0
        errors = []
        
        for psid in status_update.customer_psids:
            try:
                # หา customer
                customer = crud.get_customer_by_psid(db, page.ID, psid)
                if not customer:
                    errors.append(f"Customer {psid} not found")
                    continue
                
                # สร้างหรืออัพเดท mining status
                existing_status = db.query(models.FBCustomerMiningStatus).filter(
                    models.FBCustomerMiningStatus.customer_id == customer.id
                ).order_by(models.FBCustomerMiningStatus.created_at.desc()).first()
                
                # เพิ่มสถานะใหม่เฉพาะเมื่อสถานะเปลี่ยน
                if not existing_status or existing_status.status != status_update.status:
                    new_status = models.FBCustomerMiningStatus(
                        customer_id=customer.id,
                        status=status_update.status,
                        note=status_update.note or f"Updated via mining action at {datetime.now()}"
                    )
                    db.add(new_status)
                    updated_count += 1
                    
                    logger.info(f"✅ Updated mining status for {psid}: {status_update.status}")
            
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

# API สำหรับดึงสถานะการขุดปัจจุบัน
@router.get("/mining-status/{page_id}")
async def get_mining_statuses(
    page_id: str,
    db: Session = Depends(get_db)
):
    """
    ดึงสถานะการขุดล่าสุดของลูกค้าทั้งหมดในเพจ
    """
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Query สถานะล่าสุดของแต่ละลูกค้า
        query = """
            SELECT DISTINCT ON (c.customer_psid) 
                c.customer_psid,
                ms.status,
                ms.note,
                ms.created_at
            FROM fb_customers c
            LEFT JOIN fb_customer_mining_status ms ON c.id = ms.customer_id
            WHERE c.page_id = :page_id
            ORDER BY c.customer_psid, ms.created_at DESC NULLS LAST
        """
        
        from sqlalchemy import text
        result = db.execute(text(query), {"page_id": page.ID})
        
        statuses = {}
        for row in result:
            statuses[row[0]] = {
                "status": row[1] or "ยังไม่ขุด",  # Default ถ้าไม่มีสถานะ
                "note": row[2],
                "created_at": row[3]
            }
        
        return {
            "success": True,
            "statuses": statuses
        }
        
    except Exception as e:
        logger.error(f"Error getting mining statuses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API สำหรับรีเซ็ตสถานะการขุด
@router.post("/mining-status/reset/{page_id}")
async def reset_mining_status(
    page_id: str,
    customer_psids: List[str],
    db: Session = Depends(get_db)
):
    """
    รีเซ็ตสถานะการขุดกลับเป็น 'ยังไม่ขุด'
    """
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        for psid in customer_psids:
            customer = crud.get_customer_by_psid(db, page.ID, psid)
            if customer:
                new_status = models.FBCustomerMiningStatus(
                    customer_id=customer.id,
                    status="ยังไม่ขุด",
                    note="Reset status"
                )
                db.add(new_status)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Reset {len(customer_psids)} customers to 'ยังไม่ขุด'"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting mining status: {e}")
        raise HTTPException(status_code=500, detail=str(e))