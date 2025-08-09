# backend/app/routes/facebook/groups.py
"""
Facebook Customer Groups Component
จัดการ:
- CRUD operations สำหรับกลุ่มลูกค้า
- จัดกลุ่มอัตโนมัติตาม keywords
- จัดการ customer type knowledge
- เปิด/ปิด knowledge types สำหรับแต่ละ page
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from app.database import crud, models
from app.database.database import get_db

# ==================== Configuration ====================
router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================
class CustomerGroupCreate(BaseModel):
    """Model สำหรับสร้างกลุ่มลูกค้าใหม่"""
    page_id: int
    type_name: str
    keywords: List[str] = []
    rule_description: str = ""
    examples: List[str] = []

class CustomerGroupUpdate(BaseModel):
    """Model สำหรับอัพเดทกลุ่มลูกค้า"""
    type_name: Optional[str] = None
    keywords: Optional[List[str]] = None
    rule_description: Optional[str] = None
    examples: Optional[List[str]] = None
    is_active: Optional[bool] = None

class CustomerGroupResponse(BaseModel):
    """Model สำหรับ response ของกลุ่มลูกค้า"""
    id: int
    page_id: int
    type_name: str
    keywords: List[str]
    rule_description: str
    examples: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    customer_count: Optional[int] = 0

# ==================== User Groups APIs ====================

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
        logger.error(f"Error creating customer group: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/customer-groups/{page_id}")
async def get_customer_groups(
    page_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """ดึงกลุ่มลูกค้าทั้งหมดของเพจ"""
    try:
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
    except Exception as e:
        logger.error(f"Error fetching customer groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        logger.error(f"Error updating customer group: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/customer-groups/{group_id}")
async def delete_customer_group(
    group_id: int,
    hard_delete: bool = False,
    db: Session = Depends(get_db)
):
    """ลบกลุ่มลูกค้า (soft delete หรือ hard delete)"""
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
        
        return {
            "status": "success", 
            "message": "Group deleted successfully",
            "hard_delete": hard_delete
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting customer group: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== Auto-Grouping API ====================

@router.post("/auto-group-customer")
async def auto_group_customer(
    page_id: str,
    customer_psid: str,
    message_text: str,
    db: Session = Depends(get_db)
):
    """ตรวจสอบข้อความและจัดกลุ่มลูกค้าอัตโนมัติตาม keywords"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # ดึงกลุ่มที่ active ทั้งหมดของเพจ
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
                "keywords_matched": True,
                "customer_psid": customer_psid
            }
    
    return {
        "status": "no_match",
        "message": "No keywords matched",
        "customer_psid": customer_psid
    }

# ==================== Knowledge Type APIs ====================

@router.get("/customer-type-knowledge")
async def get_all_customer_type_knowledge(
    db: Session = Depends(get_db)
):
    """ดึงข้อมูล customer type knowledge ทั้งหมด"""
    try:
        knowledge_types = db.query(models.CustomerTypeKnowledge).all()
        
        result = []
        for kt in knowledge_types:
            result.append({
                "id": f"knowledge_{kt.id}",  # ใช้ prefix เพื่อแยกจาก user groups
                "knowledge_id": kt.id,
                "type_name": kt.type_name,
                "rule_description": kt.rule_description,
                "examples": kt.examples,
                "keywords": kt.keywords,
                "logic": kt.logic,
                "supports_image": kt.supports_image,
                "image_label_keywords": kt.image_label_keywords,
                "is_knowledge": True  # flag เพื่อระบุว่าเป็น knowledge type
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching customer type knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/page-customer-type-knowledge/{page_id}")
async def get_page_customer_type_knowledge(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึง knowledge types ที่เชื่อมกับ page นี้"""
    try:
        # หา page จาก Facebook page ID
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            logger.warning(f"Page not found for page_id: {page_id}")
            return []
        
        page_db_id = page.ID
        
        # ดึง records จากตาราง page_customer_type_knowledge
        page_knowledge_records = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page_db_id
        ).all()
        
        logger.info(f"Found {len(page_knowledge_records)} page_knowledge records for page {page_id}")
        
        # ถ้าไม่มี records สำหรับ page นี้ ให้สร้างขึ้นมาใหม่
        if not page_knowledge_records:
            page_knowledge_records = await _create_default_page_knowledge_records(
                db, page_db_id
            )
        
        # สร้าง response
        result = []
        for pk_record in page_knowledge_records:
            if pk_record.customer_type_knowledge:
                kt = pk_record.customer_type_knowledge
                result.append({
                    "id": f"knowledge_{kt.id}",
                    "knowledge_id": kt.id,
                    "page_knowledge_id": pk_record.id,
                    "type_name": kt.type_name,
                    "rule_description": kt.rule_description,
                    "examples": kt.examples,
                    "keywords": kt.keywords,
                    "logic": kt.logic,
                    "supports_image": kt.supports_image,
                    "image_label_keywords": kt.image_label_keywords,
                    "is_knowledge": True,
                    "is_enabled": pk_record.is_enabled,
                    "is_active": True,  # แสดงเสมอ
                    "created_at": pk_record.created_at.isoformat() if pk_record.created_at else None
                })
                
                logger.debug(f"Added knowledge type: {kt.type_name} (ID: {kt.id})")
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching page customer type knowledge: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/page-customer-type-knowledge/{page_id}/{knowledge_id}/toggle")
async def toggle_page_knowledge_type(
    page_id: str,
    knowledge_id: int,
    db: Session = Depends(get_db)
):
    """เปิด/ปิด knowledge type สำหรับ page พร้อมจัดการ schedules"""
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        pk_record = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page.ID,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()
        
        if not pk_record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Toggle สถานะ
        pk_record.is_enabled = not pk_record.is_enabled
        pk_record.updated_at = datetime.now()
        db.commit()
        
        # ถ้าปิดกลุ่ม ให้ปิด schedules ด้วย
        if not pk_record.is_enabled:
            # ปิดการทำงานของ schedules ที่เกี่ยวข้อง
            from app.service.message_scheduler import message_scheduler
            
            group_id = f"knowledge_{knowledge_id}"
            removed_count = 0
            
            # ลบ schedules ที่ active อยู่
            if page_id in message_scheduler.active_schedules:
                schedules_to_remove = []
                for schedule in message_scheduler.active_schedules[page_id]:
                    if group_id in schedule.get('groups', []):
                        schedules_to_remove.append(schedule['id'])
                
                for schedule_id in schedules_to_remove:
                    message_scheduler.remove_schedule(page_id, schedule_id)
                    removed_count += 1
            
            logger.info(f"Disabled knowledge group {knowledge_id} and deactivated {removed_count} schedules")
        else:
            logger.info(f"Enabled knowledge group {knowledge_id}")
        
        return {
            "status": "success", 
            "is_enabled": pk_record.is_enabled,
            "knowledge_id": knowledge_id,
            "page_id": page_id
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error toggling page knowledge type: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Debug APIs ====================

@router.get("/debug/knowledge-types")
async def debug_knowledge_types(db: Session = Depends(get_db)):
    """Debug endpoint สำหรับดู knowledge types ทั้งหมด"""
    try:
        knowledge_types = db.query(models.CustomerTypeKnowledge).all()
        result = []
        for kt in knowledge_types:
            result.append({
                "id": kt.id,
                "type_name": kt.type_name,
                "rule_description": kt.rule_description,
                "keywords": kt.keywords,
                "examples": kt.examples
            })
        return {
            "total": len(result),
            "knowledge_types": result
        }
    except Exception as e:
        logger.error(f"Debug error: {e}")
        return {"error": str(e)}

# ==================== Helper Functions ====================

async def _create_default_page_knowledge_records(db: Session, page_db_id: int):
    """Helper function สำหรับสร้าง default page_customer_type_knowledge records"""
    logger.info(f"Creating default page_customer_type_knowledge records for page {page_db_id}")
    
    # ดึง knowledge types ทั้งหมด
    all_knowledge_types = db.query(models.CustomerTypeKnowledge).all()
    
    # สร้าง page_customer_type_knowledge records สำหรับ page นี้
    for kt in all_knowledge_types:
        new_record = models.PageCustomerTypeKnowledge(
            page_id=page_db_id,
            customer_type_knowledge_id=kt.id,
            is_enabled=True
        )
        db.add(new_record)
    
    try:
        db.commit()
        logger.info(f"Created {len(all_knowledge_types)} page_knowledge records")
        
        # ดึง records ที่เพิ่งสร้างใหม่
        return db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page_db_id
        ).all()
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating page_knowledge records: {e}")
        return []