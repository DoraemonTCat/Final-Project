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
from app.database import crud, models
from app.database.database import get_db
import logging

from app.celery_task.groups_task import get_customer_groups_task , create_customer_group_task , get_customer_group_task , update_customer_group_task , delete_customer_group_task , get_all_customer_type_knowledge_task
from app.celery_task.groups_task import get_page_customer_type_knowledge_task  , toggle_page_knowledge_task , update_customer_type_knowledge_task , auto_group_customer_task
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
    """ส่งงานสร้างกลุ่มลูกค้าให้ Celery ทำใน background"""
    try:
        # แปลงเป็น dict เพื่อส่งเข้า Celery task
        task_data = {
            "page_id": group_data.page_id,
            "type_name": group_data.type_name,
            "keywords": group_data.keywords,
            "rule_description": group_data.rule_description,
            "examples": group_data.examples
        }

        task = create_customer_group_task.delay(task_data)

        return {
            "message": "กำลังสร้างกลุ่มลูกค้าใน background",
            "task_id": task.id
        }
    except Exception as e:
        logger.error(f"Error creating customer group task: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/customer-groups/{page_id}")
async def get_customer_groups(page_id: int, include_inactive: bool = False):
    """ส่ง task ไปให้ Celery ทำงาน"""
    task = get_customer_groups_task.delay(page_id, include_inactive)
    return {"job_id": task.id, "status": "processing"}

@router.get("/customer-group/{group_id}")
async def get_customer_group(group_id: int):
    """ดึงข้อมูลกลุ่มลูกค้าตาม ID แบบ background"""
    task = get_customer_group_task.delay(group_id)  # ส่งงานไป Celery
    return {"task_id": task.id, "status": "processing"}

@router.put("/customer-groups/{group_id}")
async def update_customer_group(group_id: int, group_update: CustomerGroupUpdate):
    """ส่งงานอัปเดทกลุ่มลูกค้าไป Celery"""
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

    task = update_customer_group_task.delay(group_id, update_data)
    return {"task_id": task.id, "status": "processing"}

@router.delete("/customer-groups/{group_id}")
async def delete_customer_group_endpoint(group_id: int, hard_delete: bool = False):
    """ส่งงานลบกลุ่มลูกค้าไป Celery"""
    task = delete_customer_group_task.delay(group_id, hard_delete)
    return {"task_id": task.id, "status": "processing"}

# ==================== Auto-Grouping API ====================

@router.post("/auto-group-customer")
async def auto_group_customer_endpoint(page_id: str, customer_psid: str, message_text: str):
    """ส่งงาน auto-group ไป Celery"""
    task = auto_group_customer_task.delay(page_id, customer_psid, message_text)
    return {"task_id": task.id, "status": "processing"}

# ==================== Knowledge Type APIs ====================

@router.get("/customer-type-knowledge")
async def get_all_customer_type_knowledge_endpoint():
    """ส่งงานดึงข้อมูล customer type knowledge ไป Celery"""
    task = get_all_customer_type_knowledge_task.delay()
    return {"task_id": task.id, "status": "processing"}

@router.get("/page-customer-type-knowledge/{page_id}")
async def get_page_customer_type_knowledge_endpoint(page_id: str):
    """ส่งงานดึง knowledge types ของ page ไป Celery"""
    task = get_page_customer_type_knowledge_task.delay(page_id)
    return {"task_id": task.id, "status": "processing"}

@router.put("/page-customer-type-knowledge/{page_id}/{knowledge_id}/toggle")
async def toggle_page_knowledge_endpoint(page_id: str, knowledge_id: int):
    """ส่งงาน toggle knowledge type ไป Celery"""
    task = toggle_page_knowledge_task.delay(page_id, knowledge_id)
    return {"task_id": task.id, "status": "processing"}

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

# API สำหรับสร้าง default page_customer_type_knowledge records
async def _create_default_page_knowledge_records(db: Session, page_db_id: int):
    """Helper function สำหรับสร้าง default page_customer_type_knowledge records"""
    logger.info(f"Creating default page_customer_type_knowledge records for page {page_db_id}")
    
    # ดึง knowledge types ทั้งหมด
    all_knowledge_types = db.query(models.CustomerTypeKnowledge).all()
    
    # สร้าง page_customer_type_knowledge records สำหรับ page นี้
    created_records = []
    for kt in all_knowledge_types:
        new_record = models.PageCustomerTypeKnowledge(
            page_id=page_db_id,
            customer_type_knowledge_id=kt.id,
            is_enabled=True
        )
        db.add(new_record)
        created_records.append(new_record)
    
    try:
        db.commit()
        logger.info(f"Created {len(all_knowledge_types)} page_knowledge records")
        
        # Refresh records เพื่อโหลด relationships
        for record in created_records:
            db.refresh(record)
        
        return created_records
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating page_knowledge records: {e}")
        return []
    
# เพิ่ม API สำหรับแก้ไข knowledge type
@router.put("/customer-type-knowledge/{knowledge_id}")
async def update_customer_type_knowledge_endpoint(knowledge_id: int, update_data: dict):
    """ส่งงาน update knowledge type ไป Celery"""
    task = update_customer_type_knowledge_task.delay(knowledge_id, update_data)
    return {"task_id": task.id, "status": "processing"}