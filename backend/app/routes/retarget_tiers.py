"""
API สำหรับจัดการ retarget tiers ของ Facebook Pages
- ดึงข้อมูล retarget tiers
- cleanup ข้อมูลซ้ำ
- sync เฉพาะ page ที่ยังไม่มีข้อมูล
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from app.database import crud, models
from app.database.database import get_db
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Constants ===============
VALID_TIER_NAMES = ['หาย', 'หายนาน', 'หายนานมากๆ']
EXPECTED_TIERS_PER_PAGE = 3

# =============== Helper Functions ===============
def format_tier_response(tier) -> Dict[str, Any]:
    """Format tier data for response"""
    return {
        "id": tier.id,
        "tier_name": tier.tier_name,
        "days_since_last_contact": tier.days_since_last_contact,
        "created_at": tier.created_at.isoformat() if tier.created_at else None,
        "updated_at": tier.updated_at.isoformat() if tier.updated_at else None
    }

def get_tier_statistics(db: Session) -> Dict[str, Any]:
    """Get comprehensive tier statistics"""
    # Import model locally if not available globally
    try:
        from app.database.models import RetargetTier
        model = RetargetTier
    except ImportError:
        # Fallback to generic query if model not found
        # This assumes the table exists even if model isn't imported
        from sqlalchemy import Table, MetaData
        metadata = MetaData()
        model = Table('retarget_tier_config', metadata, autoload_with=db.bind)
    
    # Total tiers - use raw SQL if model not available
    total_tiers = db.execute("SELECT COUNT(*) FROM retarget_tier_config").scalar() or 0
    
    # Pages with tiers
    pages_with_tiers = db.execute(
        "SELECT COUNT(DISTINCT page_id) FROM retarget_tier_config"
    ).scalar() or 0
    
    # Pages with excessive tiers
    excessive_query = db.execute("""
        SELECT page_id, COUNT(*) as tier_count 
        FROM retarget_tier_config 
        GROUP BY page_id 
        HAVING COUNT(*) > :expected
    """, {"expected": EXPECTED_TIERS_PER_PAGE}).fetchall()
    
    # Pages with correct tiers
    correct_tiers = db.execute("""
        SELECT COUNT(*) FROM (
            SELECT page_id 
            FROM retarget_tier_config 
            GROUP BY page_id 
            HAVING COUNT(*) = :expected
        ) as correct
    """, {"expected": EXPECTED_TIERS_PER_PAGE}).scalar() or 0
    
    # All pages count
    all_pages = db.query(models.FacebookPage).count()
    pages_without_tiers = all_pages - pages_with_tiers
    
    # Tier type summary
    tier_summary = db.execute("""
        SELECT tier_name, 
               COUNT(*) as count,
               AVG(days_since_last_contact) as avg_days
        FROM retarget_tier_config
        GROUP BY tier_name
    """).fetchall()
    
    return {
        "total_tiers": total_tiers,
        "total_pages": all_pages,
        "pages_with_tiers": pages_with_tiers,
        "pages_without_tiers": pages_without_tiers,
        "pages_with_correct_tiers": correct_tiers,
        "pages_need_cleanup": len(excessive_query),
        "excessive_pages": excessive_query,
        "tier_summary": tier_summary
    }

# =============== API Endpoints ===============
@router.get("/retarget-tiers/{page_id}")
async def get_retarget_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """Get retarget tiers for a specific page"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    tiers = crud.get_retarget_tiers_by_page(db, page.ID)
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "tiers": [format_tier_response(tier) for tier in tiers],
        "total": len(tiers),
        "status": "OK" if len(tiers) == EXPECTED_TIERS_PER_PAGE else "Needs adjustment"
    }

@router.put("/retarget-tiers/{tier_id}")
async def update_retarget_tier(
    tier_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Update retarget tier configuration"""
    # Validate tier_name if provided
    if 'tier_name' in update_data and update_data['tier_name'] not in VALID_TIER_NAMES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid tier_name. Must be one of: {VALID_TIER_NAMES}"
        )
    
    updated_tier = crud.update_retarget_tier(db, tier_id, update_data)
    
    if not updated_tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {
        "status": "success",
        "tier": format_tier_response(updated_tier)
    }

@router.post("/retarget-tiers/cleanup")
async def cleanup_duplicate_tiers(db: Session = Depends(get_db)):
    """Clean up duplicate retarget tiers"""
    try:
        crud.cleanup_duplicate_retarget_tiers(db)
        
        # Get statistics after cleanup
        stats = get_tier_statistics(db)
        
        return {
            "status": "success",
            "message": "Cleanup completed successfully",
            "stats": {
                "total_tiers_remaining": stats["total_tiers"],
                "pages_with_tiers": stats["pages_with_tiers"],
                "avg_tiers_per_page": (
                    round(stats["total_tiers"] / stats["pages_with_tiers"], 2) 
                    if stats["pages_with_tiers"] > 0 else 0
                )
            }
        }
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retarget-tiers/sync-missing")
async def sync_missing_tiers(db: Session = Depends(get_db)):
    """Sync retarget tiers for pages without configuration"""
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

@router.get("/retarget-tiers/stats")
async def get_retarget_tiers_stats(db: Session = Depends(get_db)):
    """Get comprehensive retarget tier statistics"""
    try:
        stats = get_tier_statistics(db)
        
        return {
            "summary": {
                "total_tiers": stats["total_tiers"],
                "total_pages": stats["total_pages"],
                "pages_with_tiers": stats["pages_with_tiers"],
                "pages_without_tiers": stats["pages_without_tiers"],
                "pages_with_correct_tiers": stats["pages_with_correct_tiers"],
                "pages_need_cleanup": stats["pages_need_cleanup"]
            },
            "tier_types": [
                {
                    "name": tier_name,
                    "count": count,
                    "avg_days": round(float(avg_days), 1) if avg_days else 0
                }
                for tier_name, count, avg_days in stats["tier_summary"]
            ],
            "pages_with_excessive_tiers": [
                {
                    "page_id": page_id,
                    "tier_count": count,
                    "excess": count - EXPECTED_TIERS_PER_PAGE
                }
                for page_id, count in stats["excessive_pages"]
            ],
            "health_status": "Good" if stats["pages_need_cleanup"] == 0 else "Needs Cleanup",
            "recommendation": (
                "Run /retarget-tiers/cleanup to fix" 
                if stats["pages_need_cleanup"] > 0 
                else "System is healthy"
            )
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/retarget-tiers/check/{page_id}")
async def check_page_tiers_status(
    page_id: str,
    db: Session = Depends(get_db)
):
    """Check retarget tier status for a specific page"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    tiers = crud.get_retarget_tiers_by_page(db, page.ID)
    tier_count = len(tiers)
    
    status = "OK" if tier_count == EXPECTED_TIERS_PER_PAGE else (
        "Missing" if tier_count == 0 else "Incorrect"
    )
    
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
        "needs_action": tier_count != EXPECTED_TIERS_PER_PAGE,
        "action": (
            "sync" if tier_count == 0 else 
            ("cleanup" if tier_count > EXPECTED_TIERS_PER_PAGE else None)
        )
    }

@router.delete("/retarget-tiers/reset/{page_id}")
async def reset_page_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """[DEV ONLY] Reset and resync retarget tiers for a page"""
    if not page_id:
        raise HTTPException(status_code=400, detail="Page ID required")
    
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    try:
        # Delete existing tiers using raw SQL
        deleted_count = db.execute(
            "DELETE FROM retarget_tier_config WHERE page_id = :page_id",
            {"page_id": page.ID}
        ).rowcount
        db.commit()
        
        # Sync new tiers
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