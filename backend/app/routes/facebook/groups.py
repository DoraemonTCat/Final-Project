# backend/app/routes/facebook/groups.py
"""
Facebook Customer Groups Component
จัดการ:
- CRUD operations สำหรับกลุ่มลูกค้า
- จัดกลุ่มอัตโนมัติตาม keywords
- จัดการ keywords และ rules
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import crud, models
from app.database.database import get_db

router = APIRouter()


class CustomerGroupCreate(BaseModel):
    page_id: int
    type_name: str
    keywords: List[str] = []
    rule_description: str = ""
    examples: List[str] = []


class CustomerGroupUpdate(BaseModel):
    type_name: Optional[str] = None
    keywords: Optional[List[str]] = None
    rule_description: Optional[str] = None
    examples: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.post("/customer-groups")
async def create_customer_group(
    group_data: CustomerGroupCreate,
    db: Session = Depends(get_db)
):
    """สร้างกลุ่มลูกค้าใหม่"""
    try:
        new_group = crud.create_customer_type_custom(
            db, 
            page_id=group_data.page_id,
            type_data={
                'type_name': group_data.type_name,
                'keywords': group_data.keywords,
                'rule_description': group_data.rule_description,
                'examples': group_data.examples,
                'is_active': True
            }
        )
        
        return {
            "id": new_group.id,
            "page_id": new_group.page_id,
            "type_name": new_group.type_name,
            "keywords": new_group.keywords if isinstance(new_group.keywords, list) else [],
            "rule_description": new_group.rule_description,
            "examples": new_group.examples if isinstance(new_group.examples, list) else [],
            "created_at": new_group.created_at,
            "updated_at": new_group.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/customer-groups/{page_id}")
async def get_customer_groups(
    page_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """ดึงกลุ่มลูกค้าทั้งหมดของเพจ"""
    query = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.page_id == page_id
    )
    
    if not include_inactive:
        query = query.filter(models.CustomerTypeCustom.is_active == True)
    
    groups = query.order_by(models.CustomerTypeCustom.created_at.desc()).all()
    
    result = []
    for group in groups:
        result.append({
            "id": group.id,
            "page_id": group.page_id,
            "type_name": group.type_name,
            "keywords": group.keywords or [],
            "examples": group.examples or [],
            "rule_description": group.rule_description,
            "is_active": group.is_active,
            "created_at": group.created_at,
            "updated_at": group.updated_at,
            "customer_count": len(group.customers)
        })
    
    return result


@router.get("/customer-group/{group_id}")
async def get_customer_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """ดึงข้อมูลกลุ่มลูกค้าตาม ID"""
    group = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.id == group_id
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {
        "id": group.id,
        "page_id": group.page_id,
        "type_name": group.type_name,
        "keywords": group.keywords.split(",") if group.keywords else [],
        "examples": group.examples.split("\n") if group.examples else [],
        "rule_description": group.rule_description,
        "is_active": group.is_active,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "customer_count": len(group.customers)
    }


@router.put("/customer-groups/{group_id}")
async def update_customer_group(
    group_id: int,
    group_update: CustomerGroupUpdate,
    db: Session = Depends(get_db)
):
    """อัพเดทข้อมูลกลุ่มลูกค้า"""
    group = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.id == group_id
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    try:
        update_data = {}
        if group_update.type_name is not None:
            update_data['type_name'] = group_update.type_name
        if group_update.keywords is not None:
            update_data['keywords'] = group_update.keywords
        if group_update.rule_description is not None:
            update_data['rule_description'] = group_update.rule_description
        if group_update.examples is not None:
            update_data['examples'] = group_update.examples
        if group_update.is_active is not None:
            update_data['is_active'] = group_update.is_active
            
        updated_group = crud.update_customer_type_custom(db, group_id, update_data)
        
        return {
            "id": updated_group.id,
            "type_name": updated_group.type_name,
            "keywords": updated_group.keywords if isinstance(updated_group.keywords, list) else [],
            "rule_description": updated_group.rule_description,
            "examples": updated_group.examples if isinstance(updated_group.examples, list) else [],
            "updated_at": updated_group.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/customer-groups/{group_id}")
async def delete_customer_group(
    group_id: int,
    hard_delete: bool = False,
    db: Session = Depends(get_db)
):
    """ลบกลุ่มลูกค้า"""
    group = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.id == group_id
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    try:
        if hard_delete:
            db.delete(group)
        else:
            group.is_active = False
            group.updated_at = datetime.now()
        
        db.commit()
        
        return {"status": "success", "message": "Group deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auto-group-customer")
async def auto_group_customer(
    page_id: str,
    customer_psid: str,
    message_text: str,
    db: Session = Depends(get_db)
):
    """ตรวจสอบข้อความและจัดกลุ่มลูกค้าอัตโนมัติ"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # ดึงกลุ่มทั้งหมดของเพจ
    groups = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.page_id == page.ID,
        models.CustomerTypeCustom.is_active == True
    ).all()
    
    # ตรวจสอบ keywords
    detected_group = None
    message_lower = message_text.lower()
    
    for group in groups:
        if group.keywords:
            keywords = [k.strip().lower() for k in group.keywords.split(",")]
            for keyword in keywords:
                if keyword and keyword in message_lower:
                    detected_group = group
                    break
        if detected_group:
            break
    
    if detected_group:
        # อัพเดทกลุ่มของลูกค้า
        customer = crud.get_customer_by_psid(db, page.ID, customer_psid)
        if customer:
            customer.customer_type_custom_id = detected_group.id
            customer.updated_at = datetime.now()
            db.commit()
            
            return {
                "status": "success",
                "group_detected": detected_group.type_name,
                "keywords_matched": True
            }
    
    return {
        "status": "no_match",
        "message": "No keywords matched"
    }