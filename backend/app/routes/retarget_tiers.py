from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import crud, models
from app.database.database import get_db
from datetime import datetime

router = APIRouter()

"""
    API สำหรับจัดการ retarget tiers ของ Facebook Pages
    - ดึงข้อมูล retarget tiers
    - สร้าง retarget tier ใหม่
    - อัพเดท
"""
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
        "tiers": [
            {
                "id": tier.id,
                "tier_name": tier.tier_name,
                "days_since_last_contact": tier.days_since_last_contact,
                "created_at": tier.created_at,
                "updated_at": tier.updated_at
            }
            for tier in tiers
        ]
    }

# API สำหรับสร้าง retarget tier ใหม่
@router.post("/retarget-tiers/{page_id}")
async def create_retarget_tier(
    page_id: str,
    tier_data: dict,
    db: Session = Depends(get_db)
):
    """สร้าง retarget tier ใหม่"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Validate tier_name
    valid_names = ['หาย', 'หายนาน', 'หายนานมากๆ']
    if tier_data.get('tier_name') not in valid_names:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid tier_name. Must be one of: {valid_names}"
        )
    
    new_tier = crud.create_retarget_tier(db, page.ID, tier_data)
    
    return {
        "status": "success",
        "tier": {
            "id": new_tier.id,
            "tier_name": new_tier.tier_name,
            "days_since_last_contact": new_tier.days_since_last_contact
        }
    }

# API สำหรับอัพเดท retarget tier
@router.put("/retarget-tiers/{tier_id}")
async def update_retarget_tier(
    tier_id: int,
    update_data: dict,
    db: Session = Depends(get_db)
):
    """อัพเดท retarget tier"""
    updated_tier = crud.update_retarget_tier(db, tier_id, update_data)
    
    if not updated_tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {
        "status": "success",
        "tier": {
            "id": updated_tier.id,
            "tier_name": updated_tier.tier_name,
            "days_since_last_contact": updated_tier.days_since_last_contact
        }
    }

# API สำหรับลบ retarget tier
@router.delete("/retarget-tiers/{tier_id}")
async def delete_retarget_tier(
    tier_id: int,
    db: Session = Depends(get_db)
):
    """ลบ retarget tier"""
    success = crud.delete_retarget_tier(db, tier_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {"status": "success", "message": "Tier deleted"}