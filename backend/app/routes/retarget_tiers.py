"""
API สำหรับจัดการ retarget tiers ของ Facebook Pages
- ดึงข้อมูล retarget tiers
- cleanup ข้อมูลซ้ำ
- sync เฉพาะ page ที่ยังไม่มีข้อมูล
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from app.database import crud, models
from app.database.database import get_db
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Main APIs ====================

# API สำหรับดึงข้อมูล retarget tiers ของ page
@router.get("/retarget-tiers/{page_id}")
async def get_retarget_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึง retarget tiers ของ page"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    tiers = crud.get_retarget_tiers_by_page(db, page.ID)
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "tiers": [
            {
                "id": tier.id,
                "tier_name": tier.tier_name,
                "days_since_last_contact": tier.days_since_last_contact,
                "created_at": tier.created_at.isoformat() if tier.created_at else None,
                "updated_at": tier.updated_at.isoformat() if tier.updated_at else None
            }
            for tier in tiers
        ],
        "total": len(tiers)
    }

# ==================== Create/Update APIs ====================

# API สำหรับสร้าง retarget tier ใหม่
@router.put("/retarget-tiers/{tier_id}")
async def update_retarget_tier(
    tier_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """อัพเดท retarget tier - แก้ไขจำนวนวันของ tier"""
    
    # Validate tier_name ถ้ามีการเปลี่ยน
    if 'tier_name' in update_data:
        valid_names = ['หาย', 'หายนาน', 'หายนานมากๆ']
        if update_data['tier_name'] not in valid_names:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid tier_name. Must be one of: {valid_names}"
            )
    
    updated_tier = crud.update_retarget_tier(db, tier_id, update_data)
    
    if not updated_tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {
        "status": "success",
        "tier": {
            "id": updated_tier.id,
            "tier_name": updated_tier.tier_name,
            "days_since_last_contact": updated_tier.days_since_last_contact,
            "updated_at": updated_tier.updated_at.isoformat() if updated_tier.updated_at else None
        }
    }

# ==================== Cleanup & Maintenance APIs ====================

# API สำหรับลบข้อมูล retarget tiers ที่ซ้ำซ้อน เหลือแค่ 3 tiers ต่อ page
@router.post("/retarget-tiers/cleanup")
async def cleanup_duplicate_tiers(
    db: Session = Depends(get_db)
):
    """ลบข้อมูล retarget tiers ที่ซ้ำซ้อน เหลือแค่ 3 tiers ต่อ page"""
    try:
        crud.cleanup_duplicate_retarget_tiers(db)
        
        # นับสถิติหลัง cleanup
        total_tiers = db.query(models.RetargetTierConfig).count()
        pages_with_tiers = db.query(
            models.RetargetTierConfig.page_id
        ).distinct().count()
        
        return {
            "status": "success",
            "message": "Cleanup completed successfully",
            "stats": {
                "total_tiers_remaining": total_tiers,
                "pages_with_tiers": pages_with_tiers,
                "avg_tiers_per_page": round(total_tiers / pages_with_tiers, 2) if pages_with_tiers > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API สำหรับ sync เฉพาะ page ที่ยังไม่มีข้อมูล retarget tiers
@router.post("/retarget-tiers/sync-missing")
async def sync_missing_tiers(
    db: Session = Depends(get_db)
):
    """Sync retarget tiers เฉพาะ page ที่ยังไม่มีข้อมูล"""
    try:
        result = crud.sync_missing_retarget_tiers(db)
        return {
            "status": "success",
            "result": result,
            "message": f"Synced {result.get('synced', 0)} pages, skipped {result.get('skipped', 0)} pages"
        }
    except Exception as e:
        logger.error(f"Error during sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Statistics & Monitoring APIs ====================

# API สำหรับดูสถิติข้อมูล retarget tiers ทั้งหมด
@router.get("/retarget-tiers/stats")
async def get_retarget_tiers_stats(
    db: Session = Depends(get_db)
):
    """ดูสถิติข้อมูล retarget tiers ทั้งหมด"""
    try:
        # นับจำนวน tiers ทั้งหมด
        total_tiers = db.query(models.RetargetTierConfig).count()
        
        # นับจำนวน pages ที่มี tiers
        pages_with_tiers = db.query(
            models.RetargetTierConfig.page_id
        ).distinct().count()
        
        # หา pages ที่มี tiers มากเกิน (มากกว่า 3)
        pages_with_excessive_tiers = db.query(
            models.RetargetTierConfig.page_id,
            func.count(models.RetargetTierConfig.id).label('tier_count')
        ).group_by(
            models.RetargetTierConfig.page_id
        ).having(
            func.count(models.RetargetTierConfig.id) > 3
        ).all()
        
        # หา pages ที่มี tiers พอดี (3 tiers)
        pages_with_correct_tiers = db.query(
            models.RetargetTierConfig.page_id,
            func.count(models.RetargetTierConfig.id).label('tier_count')
        ).group_by(
            models.RetargetTierConfig.page_id
        ).having(
            func.count(models.RetargetTierConfig.id) == 3
        ).count()
        
        # หา pages ที่ยังไม่มี tiers
        all_pages = db.query(models.FacebookPage).count()
        pages_without_tiers = all_pages - pages_with_tiers
        
        # สรุปจำนวน tiers แต่ละประเภท
        tier_summary = db.query(
            models.RetargetTierConfig.tier_name,
            func.count(models.RetargetTierConfig.id).label('count'),
            func.avg(models.RetargetTierConfig.days_since_last_contact).label('avg_days')
        ).group_by(
            models.RetargetTierConfig.tier_name
        ).all()
        
        return {
            "summary": {
                "total_tiers": total_tiers,
                "total_pages": all_pages,
                "pages_with_tiers": pages_with_tiers,
                "pages_without_tiers": pages_without_tiers,
                "pages_with_correct_tiers": pages_with_correct_tiers,
                "pages_need_cleanup": len(pages_with_excessive_tiers)
            },
            "tier_types": [
                {
                    "name": tier_name,
                    "count": count,
                    "avg_days": round(float(avg_days), 1) if avg_days else 0
                }
                for tier_name, count, avg_days in tier_summary
            ],
            "pages_with_excessive_tiers": [
                {
                    "page_id": page_id,
                    "tier_count": count,
                    "excess": count - 3
                }
                for page_id, count in pages_with_excessive_tiers
            ],
            "health_status": "Good" if len(pages_with_excessive_tiers) == 0 else "Needs Cleanup",
            "recommendation": "Run /retarget-tiers/cleanup to fix" if len(pages_with_excessive_tiers) > 0 else "System is healthy"
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API สำหรับตรวจสอบสถานะ retarget tiers ของ page เฉพาะ
@router.get("/retarget-tiers/check/{page_id}")
async def check_page_tiers_status(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ตรวจสอบสถานะ retarget tiers ของ page เฉพาะ"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    tiers = crud.get_retarget_tiers_by_page(db, page.ID)
    tier_count = len(tiers)
    
    status = "OK" if tier_count == 3 else ("Missing" if tier_count == 0 else "Incorrect")
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "tier_count": tier_count,
        "status": status,
        "tiers": [
            {
                "id": tier.id,
                "name": tier.tier_name,
                "days": tier.days_since_last_contact
            }
            for tier in tiers
        ],
        "needs_action": tier_count != 3,
        "action": "sync" if tier_count == 0 else ("cleanup" if tier_count > 3 else None)
    }

# ==================== Manual Operations (Development/Debug) ====================

# API สำหรับ reset retarget tiers ของ page - ลบแล้ว sync ใหม่
@router.delete("/retarget-tiers/reset/{page_id}")
async def reset_page_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """[DEV ONLY] Reset retarget tiers ของ page - ลบแล้ว sync ใหม่"""
    if not page_id:
        raise HTTPException(status_code=400, detail="Page ID required")
    
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    try:
        # ลบ tiers เก่าทั้งหมด
        deleted_count = db.query(models.RetargetTierConfig).filter(
            models.RetargetTierConfig.page_id == page.ID
        ).delete()
        db.commit()
        
        # Sync ใหม่
        new_tiers = crud.sync_retarget_tiers_from_knowledge(db, page.ID)
        
        return {
            "status": "success",
            "deleted": deleted_count,
            "created": len(new_tiers),
            "new_tiers": [
                {
                    "id": tier.id,
                    "name": tier.tier_name,
                    "days": tier.days_since_last_contact
                }
                for tier in new_tiers
            ]
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting tiers: {e}")
        raise HTTPException(status_code=500, detail=str(e))