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
import logging
from app.database import crud, models
from app.database.database import get_db
from app.routes.group_messages import GroupMessageCreate

router = APIRouter()

# สร้าง logger instance
logger = logging.getLogger(__name__)

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

# API สำหรับสร้างกลุ่มลูกค้าใหม่
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

# API สำหรับดึงกลุ่มลูกค้าทั้งหมดของเพจ
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

# API สำหรับดึงข้อมูลกลุ่มลูกค้าตาม ID
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

# API สำหรับอัพเดทข้อมูลกลุ่มลูกค้า
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

# API สำหรับลบกลุ่มลูกค้า
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

# API สำหรับจัดกลุ่มลูกค้าอัตโนมัติ
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

# เพิ่ม API สำหรับดึงข้อมูล customer_type_knowledge
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

# เพิ่ม API สำหรับดึง page_customer_type_knowledge (ความสัมพันธ์ระหว่าง page และ knowledge types)
@router.get("/page-customer-type-knowledge/{page_id}")
async def get_page_customer_type_knowledge(
    page_id: int,
    db: Session = Depends(get_db)
):
    """ดึง knowledge types ที่ enabled สำหรับ page นี้"""
    try:
        # หา page จาก Facebook page ID เพื่อได้ database ID
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            logger.warning(f"Page not found for page_id: {page_id}")
            return []
        
        # ใช้ integer ID จาก database
        page_db_id = page.ID
        
        # ดึง knowledge types ที่ enabled สำหรับ page นี้
        page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page_db_id,  # ใช้ integer ID
            models.PageCustomerTypeKnowledge.is_enabled == True
        ).all()
        
        logger.info(f"Found {len(page_knowledge)} knowledge types for page {page_id} (DB ID: {page_db_id})")
        
        result = []
        for pk in page_knowledge:
            if pk.customer_type_knowledge:
                kt = pk.customer_type_knowledge
                result.append({
                    "id": f"knowledge_{kt.id}",
                    "knowledge_id": kt.id,
                    "type_name": kt.type_name,
                    "rule_description": kt.rule_description,
                    "examples": kt.examples,
                    "keywords": kt.keywords,
                    "logic": kt.logic,
                    "supports_image": kt.supports_image,
                    "image_label_keywords": kt.image_label_keywords,
                    "is_knowledge": True,
                    "is_enabled": pk.is_enabled
                })
                
                logger.debug(f"Added knowledge type: {kt.type_name} (ID: {kt.id})")
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching page customer type knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# เพิ่ม API สำหรับดึงข้อความของ knowledge groups
@router.get("/knowledge-group-messages/{page_id}/{knowledge_id}")
async def get_knowledge_group_messages(
    page_id: str,
    knowledge_id: int,
    db: Session = Depends(get_db)
):
    """ดึงข้อความของ knowledge group"""
    try:
        # หา page_customer_type_knowledge record
        page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page_id,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()
        
        if not page_knowledge:
            return []
        
        # ดึงข้อความที่เชื่อมกับ page_customer_type_knowledge นี้
        messages = db.query(models.CustomerTypeMessage).filter(
            models.CustomerTypeMessage.page_customer_type_knowledge_id == page_knowledge.id
        ).order_by(models.CustomerTypeMessage.display_order).all()
        
        return messages
        
    except Exception as e:
        logger.error(f"Error fetching knowledge group messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# เพิ่ม API สำหรับบันทึกข้อความให้ knowledge groups
@router.post("/knowledge-group-messages")
async def create_knowledge_group_message(
    message_data: GroupMessageCreate,
    db: Session = Depends(get_db)
):
    """สร้างข้อความใหม่สำหรับ knowledge group"""
    try:
        # ดึง knowledge_id จาก group id ที่ส่งมา (format: knowledge_123)
        if not message_data.customer_type_custom_id.startswith('knowledge_'):
            raise HTTPException(status_code=400, detail="Invalid knowledge group ID")
        
        knowledge_id = int(message_data.customer_type_custom_id.replace('knowledge_', ''))
        
        # หา page record จาก page_id string
        page = crud.get_page_by_page_id(db, str(message_data.page_id))
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # หา page_customer_type_knowledge record
        page_knowledge = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == str(message_data.page_id),
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()
        
        if not page_knowledge:
            raise HTTPException(status_code=404, detail="Knowledge group not found for this page")
        
        # สร้างข้อความใหม่
        db_message = models.CustomerTypeMessage(
            page_id=page.ID,  # ใช้ integer ID สำหรับ page_id ใน CustomerTypeMessage
            page_customer_type_knowledge_id=page_knowledge.id,
            message_type=message_data.message_type,
            content=message_data.content,
            dir=message_data.dir or "",
            display_order=message_data.display_order
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        logger.info(f"Created message for knowledge group {knowledge_id}")
        return db_message
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating knowledge group message: {e}")
        raise HTTPException(status_code=400, detail=str(e))