# ไฟล์ crud.py ที่สมบูรณ์พร้อม imports ทั้งหมด

from sqlalchemy.orm import Session
from app.database.models import FacebookPage, FbCustomer
from app.database.schemas import FacebookPageCreate, FacebookPageUpdate
from sqlalchemy.exc import IntegrityError
import app.database.models as models
import app.database.schemas as schemas
from sqlalchemy import or_, func
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# ฟังก์ชันเดิมทั้งหมด...

def get_page_by_id(db: Session, id: int):
    return db.query(FacebookPage).filter(FacebookPage.ID == id).first()

def get_page_by_page_id(db: Session, page_id: str):
    return db.query(models.FacebookPage).filter(models.FacebookPage.page_id == page_id).first()

def get_pages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(FacebookPage).offset(skip).limit(limit).all()

def create_page(db: Session, page: schemas.FacebookPageCreate):
    db_page = models.FacebookPage(
        page_id=page.page_id,
        page_name=page.page_name
        # created_at จะถูกกำหนดอัตโนมัติใน DB
    )
    db.add(db_page)
    db.commit()
    db.refresh(db_page)
    return db_page

def update_page(db: Session, id: int, page_update: FacebookPageUpdate):
    db_page = db.query(FacebookPage).filter(FacebookPage.ID == id).first()
    if not db_page:
        return None
    if page_update.page_name is not None:
        db_page.page_name = page_update.page_name
    db.commit()
    db.refresh(db_page)
    return db_page

def delete_page(db: Session, id: int):
    db_page = db.query(FacebookPage).filter(FacebookPage.ID == id).first()
    if db_page:
        db.delete(db_page)
        db.commit()
    return db_page

def get_all_connected_pages(db: Session):
    return [
        page.page_id
        for page in db.query(FacebookPage).all()
    ]

# ========== FbCustomer CRUD Operations ==========

def get_customer_by_psid(db: Session, page_id: int, customer_psid: str):
    """ดึงข้อมูลลูกค้าจาก PSID และ Page ID"""
    return db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.customer_psid == customer_psid
    ).first()

def get_customers_by_page(db: Session, page_id: int, skip: int = 0, limit: int = 100):
    """ดึงรายชื่อลูกค้าทั้งหมดของเพจ"""
    return db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id
    ).order_by(models.FbCustomer.last_interaction_at.desc()).offset(skip).limit(limit).all()

def create_or_update_customer(db: Session, page_id: int, customer_psid: str, customer_data: dict):
    """สร้างหรืออัพเดทข้อมูลลูกค้า"""
    # ตรวจสอบว่ามีลูกค้าอยู่แล้วหรือไม่
    existing_customer = get_customer_by_psid(db, page_id, customer_psid)
    
    if existing_customer:
        # อัพเดทข้อมูล - ไม่เปลี่ยน first_interaction_at และ created_at
        if customer_data.get('name'):
            existing_customer.name = customer_data['name']
        
        # อัพเดท last_interaction_at เฉพาะเมื่อมีค่าใหม่ที่ใหม่กว่า
        if customer_data.get('last_interaction_at'):
            new_interaction = customer_data['last_interaction_at']
            if isinstance(new_interaction, str):
                new_interaction = datetime.fromisoformat(new_interaction.replace('Z', '+00:00'))
            
            if not existing_customer.last_interaction_at or new_interaction > existing_customer.last_interaction_at:
                existing_customer.last_interaction_at = new_interaction
        
        # อัพเดท customer type ถ้ามี
        if 'customer_type_custom_id' in customer_data:
            existing_customer.customer_type_custom_id = customer_data['customer_type_custom_id']
        if 'customer_type_knowledge_id' in customer_data:
            existing_customer.customer_type_knowledge_id = customer_data['customer_type_knowledge_id']
        
        # updated_at จะอัพเดทอัตโนมัติเมื่อมีการเปลี่ยนแปลง
        existing_customer.updated_at = datetime.now()
        
        db.commit()
        db.refresh(existing_customer)
        return existing_customer
    else:
        # สร้างใหม่
        first_interaction = customer_data.get('first_interaction_at', datetime.now())
        if isinstance(first_interaction, str):
            first_interaction = datetime.fromisoformat(first_interaction.replace('Z', '+00:00'))

        last_interaction = customer_data.get('last_interaction_at', first_interaction)
        if isinstance(last_interaction, str):
            last_interaction = datetime.fromisoformat(last_interaction.replace('Z', '+00:00'))

        source_type = customer_data.get('source_type', 'new')

        db_customer = models.FbCustomer(
            page_id=page_id,
            customer_psid=customer_psid,
            name=customer_data.get('name', ''),
            customer_type_custom_id=customer_data.get('customer_type_custom_id'),
            customer_type_knowledge_id=customer_data.get('customer_type_knowledge_id'),
            first_interaction_at=first_interaction,
            last_interaction_at=last_interaction,
            source_type=source_type
            # created_at, updated_at handled by DB
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

def update_customer_interaction(db: Session, page_id: int, customer_psid: str):
    """อัพเดทเวลาล่าสุดที่มีการติดต่อ - ใช้เมื่อมี message ใหม่"""
    customer = get_customer_by_psid(db, page_id, customer_psid)
    
    if customer:
        current_time = datetime.now()
        
        # ถ้ายังไม่มี first_interaction_at ให้ set ด้วย (กรณีข้อมูลเก่าที่อาจไม่มี)
        if not customer.first_interaction_at:
            customer.first_interaction_at = current_time
            
        # อัพเดท last_interaction_at
        customer.last_interaction_at = current_time
        
        # updated_at จะอัพเดทอัตโนมัติ
        customer.updated_at = current_time
        
        db.commit()
        db.refresh(customer)
        return customer
    
    return None

def search_customers(db: Session, page_id: int, search_term: str):
    """ค้นหาลูกค้าจากชื่อหรือ PSID"""
    return db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id,
        or_(
            models.FbCustomer.name.ilike(f"%{search_term}%"),
            models.FbCustomer.customer_psid.ilike(f"%{search_term}%")
        )
    ).all()

def get_customer_with_conversation_data(db: Session, page_id: int):
    """ดึงข้อมูลลูกค้าพร้อมข้อมูล conversation"""
    customers = db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id
    ).order_by(models.FbCustomer.last_interaction_at.desc()).all()
    
    # แปลงเป็น format ที่ frontend ต้องการ
    result = []
    for idx, customer in enumerate(customers):
        result.append({
            "id": idx + 1,
            "conversation_id": f"conv_{customer.customer_psid}",  # สร้าง conversation_id จาก psid
            "conversation_name": customer.name or f"User...{customer.customer_psid[-8:]}",
            "user_name": customer.name or f"User...{customer.customer_psid[-8:]}",
            "psids": [customer.customer_psid],
            "names": [customer.name or f"User...{customer.customer_psid[-8:]}"],
            "raw_psid": customer.customer_psid,
            "updated_time": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
            "created_time": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
            "last_user_message_time": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
            # เพิ่มข้อมูลเพิ่มเติมจาก database
            "first_interaction_at": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "source_type": customer.source_type
        })
    
    return result

def get_customers_by_page_with_details(db: Session, page_id: int, skip: int = 0, limit: int = 100):
    """ดึงรายชื่อลูกค้าพร้อมรายละเอียดทั้งหมด"""
    customers = db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id
    ).order_by(models.FbCustomer.last_interaction_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for customer in customers:
        result.append({
            "id": customer.id,
            "page_id": customer.page_id,
            "customer_psid": customer.customer_psid,
            "name": customer.name,
            "customer_type_custom": customer.customer_type_custom.type_name if customer.customer_type_custom else None,
            "customer_type_knowledge": customer.customer_type_knowledge.type_name if customer.customer_type_knowledge else None,
            "first_interaction_at": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
            "last_interaction_at": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
            "source_type": customer.source_type,
            "days_since_first_interaction": (datetime.now() - customer.first_interaction_at).days if customer.first_interaction_at else None,
            "hours_since_last_interaction": int((datetime.now() - customer.last_interaction_at).total_seconds() / 3600) if customer.last_interaction_at else None
        })
    
    return result

def bulk_create_or_update_customers(db: Session, page_id: int, customers_data: List[Dict]):
    """สร้างหรืออัพเดทลูกค้าหลายคนพร้อมกัน"""
    results = {"created": 0, "updated": 0, "errors": 0}

    try:
        # ดึง PSID ทั้งหมดในครั้งเดียวเพื่อลดจำนวน query
        psids = [c.get("customer_psid") for c in customers_data if c.get("customer_psid")]
        existing_customers = {
            customer.customer_psid: customer
            for customer in db.query(FbCustomer)
            .filter(FbCustomer.page_id == page_id, FbCustomer.customer_psid.in_(psids))
            .all()
        }

        for customer_data in customers_data:
            try:
                psid = customer_data.get("customer_psid")
                if not psid:
                    results["errors"] += 1
                    continue

                # ตรวจสอบว่ามีอยู่แล้วหรือไม่
                if psid in existing_customers:
                    create_or_update_customer(db, page_id, psid, customer_data)
                    results["updated"] += 1
                else:
                    create_or_update_customer(db, page_id, psid, customer_data)
                    results["created"] += 1

            except Exception as e:
                logger.error(f"❌ Error processing customer {customer_data.get('customer_psid')}: {e}")
                results["errors"] += 1

        db.commit()

    except Exception as e:
        logger.exception("❌ Bulk sync failed")
        db.rollback()
        results["errors"] += len(customers_data)  # ถ้า fail ทั้งหมด
    
    return results

def get_customer_statistics(db: Session, page_id: int):
    """ดึงสถิติของลูกค้าในเพจ"""
    total_customers = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == page_id
    ).scalar()
    
    # ลูกค้าที่ active ใน 7 วันที่ผ่านมา
    active_7days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.last_interaction_at >= datetime.now() - timedelta(days=7)
    ).scalar()
    
    # ลูกค้าที่ active ใน 30 วันที่ผ่านมา
    active_30days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.last_interaction_at >= datetime.now() - timedelta(days=30)
    ).scalar()
    
    # ลูกค้าใหม่ใน 7 วันที่ผ่านมา
    new_7days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.created_at >= datetime.now() - timedelta(days=7)
    ).scalar()
    
    return {
        "total_customers": total_customers,
        "active_7days": active_7days,
        "active_30days": active_30days,
        "new_7days": new_7days,
        "inactive_customers": total_customers - active_30days
    }
    
# ========== CustomerTypeCustom CRUD Operations ==========

def create_customer_type_custom(db: Session, page_id: int, type_data: dict):
    """สร้างประเภทลูกค้าใหม่"""
    # จัดการ keywords ให้เป็น PostgreSQL array format
    keywords = type_data.get('keywords', '')
    if isinstance(keywords, list):
        # ถ้าเป็น list แล้ว ใช้ PostgreSQL array format
        keywords_array = keywords
    elif isinstance(keywords, str) and keywords:
        # ถ้าเป็น string ให้แปลงเป็น list
        keywords_array = [k.strip() for k in keywords.split(',') if k.strip()]
    else:
        keywords_array = []
    
    db_type = models.CustomerTypeCustom(
        page_id=page_id,
        type_name=type_data.get('type_name'),
        keywords=keywords_array,  # ส่งเป็น list สำหรับ PostgreSQL array
        rule_description=type_data.get('rule_description', ''),
        examples=type_data.get('examples'), 
        is_active=type_data.get('is_active', True)
    )
    db.add(db_type)
    db.commit()
    db.refresh(db_type)
    return db_type

def get_customer_type_custom_by_id(db: Session, type_id: int):
    """ดึงประเภทลูกค้าตาม ID"""
    return db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.id == type_id
    ).first()

def get_customer_types_by_page(db: Session, page_id: int, include_inactive: bool = False):
    """ดึงประเภทลูกค้าทั้งหมดของเพจ"""
    query = db.query(models.CustomerTypeCustom).filter(
        models.CustomerTypeCustom.page_id == page_id
    )
    
    if not include_inactive:
        query = query.filter(models.CustomerTypeCustom.is_active == True)
    
    return query.order_by(models.CustomerTypeCustom.created_at.desc()).all()

def update_customer_type_custom(db: Session, type_id: int, update_data: dict):
    """อัพเดทประเภทลูกค้า"""
    db_type = get_customer_type_custom_by_id(db, type_id)
    if not db_type:
        return None
    
    # อัพเดทเฉพาะฟิลด์ที่มีค่า
    if 'type_name' in update_data:
        db_type.type_name = update_data['type_name']
    if 'rule_description' in update_data:
        db_type.rule_description = update_data['rule_description']
    if 'keywords' in update_data:
        # จัดการ keywords ให้เป็น array
        keywords = update_data['keywords']
        if isinstance(keywords, list):
            db_type.keywords = keywords
        elif isinstance(keywords, str):
            db_type.keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        else:
            db_type.keywords = []
    if 'examples' in update_data:
        # จัดการ examples ให้เป็น array
        examples = update_data['examples']
        if isinstance(examples, list):
            db_type.examples = examples
        elif isinstance(examples, str):
            if '\n' in examples:
                db_type.examples = [e.strip() for e in examples.split('\n') if e.strip()]
        else:
            db_type.examples = []
    if 'is_active' in update_data:
        db_type.is_active = update_data['is_active']
    
    db_type.updated_at = datetime.now()
    db.commit()
    db.refresh(db_type)
    return db_type

def delete_customer_type_custom(db: Session, type_id: int, hard_delete: bool = False):
    """ลบประเภทลูกค้า"""
    db_type = get_customer_type_custom_by_id(db, type_id)
    if not db_type:
        return None
    
    if hard_delete:
        # ลบจริงจาก database
        db.delete(db_type)
    else:
        # Soft delete
        db_type.is_active = False
        db_type.updated_at = datetime.now()
    
    db.commit()
    return db_type

def auto_assign_customer_type(db: Session, page_id: int, customer_psid: str, message_text: str):
    """จัดประเภทลูกค้าอัตโนมัติตาม keywords"""
    # ดึงประเภททั้งหมดของเพจ
    types = get_customer_types_by_page(db, page_id, include_inactive=False)
    
    if not types:
        return None
    
    message_lower = message_text.lower()
    
    for type_obj in types:
        if type_obj.keywords:
            keywords = [k.strip().lower() for k in type_obj.keywords.split(",")]
            for keyword in keywords:
                if keyword and keyword in message_lower:
                    # พบ keyword ที่ตรงกัน
                    customer = get_customer_by_psid(db, page_id, customer_psid)
                    if customer:
                        customer.customer_type_custom_id = type_obj.id
                        customer.updated_at = datetime.now()
                        db.commit()
                        return type_obj
    
    return None

def get_customer_type_statistics(db: Session, page_id: int):
    """ดึงสถิติประเภทลูกค้า"""
    # ดึงจำนวนลูกค้าในแต่ละประเภท
    types = get_customer_types_by_page(db, page_id)
    
    statistics = []
    for type_obj in types:
        customer_count = db.query(func.count(models.FbCustomer.id)).filter(
            models.FbCustomer.page_id == page_id,
            models.FbCustomer.customer_type_custom_id == type_obj.id
        ).scalar()
        
        statistics.append({
            "type_id": type_obj.id,
            "type_name": type_obj.type_name,
            "customer_count": customer_count,
            "is_active": type_obj.is_active
        })
    
    # เพิ่มลูกค้าที่ยังไม่ได้จัดประเภท
    unassigned_count = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.customer_type_custom_id == None
    ).scalar()
    
    statistics.append({
        "type_id": None,
        "type_name": "ยังไม่ได้จัดประเภท",
        "customer_count": unassigned_count,
        "is_active": True
    })
    
    return statistics

def get_customers_updated_after(db: Session, page_id: int, after_time: datetime):
    """Get customers updated after specific time"""
    return db.query(models.FbCustomer).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.updated_at > after_time
    ).all()