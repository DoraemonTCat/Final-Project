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
import json
from sqlalchemy.orm import Session, joinedload



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
    """ดึงข้อมูลลูกค้าจาก PSID และ Page ID พร้อม eager loading"""
    return db.query(models.FbCustomer).options(
        joinedload(models.FbCustomer.customer_type_custom),
        joinedload(models.FbCustomer.customer_type_knowledge)
    ).filter(
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
        # อัพเดทข้อมูล
        if customer_data.get('name'):
            existing_customer.name = customer_data['name']
        
        # อัพเดท profile_pic ถ้ามี
        if customer_data.get('profile_pic'):
            existing_customer.profile_pic = customer_data['profile_pic']
        
        # อัพเดท last_interaction_at
        if customer_data.get('last_interaction_at'):
            new_interaction = customer_data['last_interaction_at']
            if isinstance(new_interaction, str):
                new_interaction = datetime.fromisoformat(new_interaction.replace('Z', '+00:00'))
            
            if not existing_customer.last_interaction_at or new_interaction > existing_customer.last_interaction_at:
                existing_customer.last_interaction_at = new_interaction
        
        # อัพเดท current_category_id ถ้ามี (ไม่ใช่ customer_type_custom_id แล้ว)
        if 'current_category_id' in customer_data:
            existing_customer.current_category_id = customer_data['current_category_id']
        
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
            profile_pic=customer_data.get('profile_pic', ''),
            current_category_id=customer_data.get('current_category_id'),  # ใช้ current_category_id แทน
            first_interaction_at=first_interaction,
            last_interaction_at=last_interaction,
            source_type=source_type
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

# แก้ไขฟังก์ชัน get_customer_by_psid ให้ใช้ ID ที่ถูกต้อง
def get_customer_by_psid(db: Session, page_id: int, customer_psid: str):
    """ดึงข้อมูลลูกค้าจาก PSID และ Page ID พร้อม eager loading"""
    return db.query(models.FbCustomer).options(
        joinedload(models.FbCustomer.custom_classifications),
        joinedload(models.FbCustomer.classifications),
        joinedload(models.FbCustomer.current_category)
    ).filter(
        models.FbCustomer.page_id == page_id,
        models.FbCustomer.customer_psid == customer_psid
    ).first()

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
    """ดึงรายชื่อลูกค้าพร้อมรายละเอียดทั้งหมด รวมทั้ง knowledge groups"""
    customers = db.query(models.FbCustomer).options(
        joinedload(models.FbCustomer.customer_type_custom),
        joinedload(models.FbCustomer.customer_type_knowledge)
    ).filter(
        models.FbCustomer.page_id == page_id
    ).order_by(models.FbCustomer.last_interaction_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for customer in customers:
        result.append({
            "id": customer.id,
            "page_id": customer.page_id,
            "customer_psid": customer.customer_psid,
            "name": customer.name,
            # User Groups
            "customer_type_custom_id": customer.customer_type_custom_id,
            "customer_type_custom": customer.customer_type_custom.type_name if customer.customer_type_custom else None,
            # Knowledge Groups
            "customer_type_knowledge_id": customer.customer_type_knowledge_id,
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

def get_customer_statistics(db: Session, page_id):
    """ดึงสถิติของลูกค้าในเพจ"""
    # แปลง page_id ให้เป็น database ID ที่ถูกต้อง
    db_page_id = get_page_db_id(db, page_id) if isinstance(page_id, str) else page_id
    
    if not db_page_id:
        return {
            "total_customers": 0,
            "active_7days": 0,
            "active_30days": 0,
            "new_7days": 0,
            "inactive_customers": 0
        }
    
    total_customers = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == db_page_id
    ).scalar()
    
    # ลูกค้าที่ active ใน 7 วันที่ผ่านมา
    active_7days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == db_page_id,
        models.FbCustomer.last_interaction_at >= datetime.now() - timedelta(days=7)
    ).scalar()
    
    # ลูกค้าที่ active ใน 30 วันที่ผ่านมา
    active_30days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == db_page_id,
        models.FbCustomer.last_interaction_at >= datetime.now() - timedelta(days=30)
    ).scalar()
    
    # ลูกค้าใหม่ใน 7 วันที่ผ่านมา
    new_7days = db.query(func.count(models.FbCustomer.id)).filter(
        models.FbCustomer.page_id == db_page_id,
        models.FbCustomer.created_at >= datetime.now() - timedelta(days=7)
    ).scalar()
    
    return {
        "total_customers": total_customers or 0,
        "active_7days": active_7days or 0,
        "active_30days": active_30days or 0,
        "new_7days": new_7days or 0,
        "inactive_customers": (total_customers or 0) - (active_30days or 0)
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
    """Get customers updated after specific time with current category"""
    try:
        customers = db.query(models.FbCustomer).options(
            joinedload(models.FbCustomer.current_category),  # ใช้ current_category
            joinedload(models.FbCustomer.classifications),
            joinedload(models.FbCustomer.custom_classifications)
        ).filter(
            models.FbCustomer.page_id == page_id,
            models.FbCustomer.updated_at > after_time
        ).all()
        
        return customers
    except Exception as e:
        logger.error(f"Error in get_customers_updated_after: {e}")
        db.rollback()
        return []
    
# ========== RetargetTierConfig CRUD Operations ==========

def get_retarget_tiers_by_page(db: Session, page_id: int):
    """ดึง retarget tiers ทั้งหมดของ page"""
    return db.query(models.RetargetTierConfig).filter(
        models.RetargetTierConfig.page_id == page_id
    ).order_by(models.RetargetTierConfig.days_since_last_contact).all()

def create_retarget_tier(db: Session, page_id: int, tier_data: dict):
    """สร้าง retarget tier ใหม่"""
    db_tier = models.RetargetTierConfig(
        page_id=page_id,
        tier_name=tier_data.get('tier_name'),
        days_since_last_contact=tier_data.get('days_since_last_contact')
    )
    db.add(db_tier)
    db.commit()
    db.refresh(db_tier)
    return db_tier

def update_retarget_tier(db: Session, tier_id: int, update_data: dict):
    """อัพเดท retarget tier"""
    tier = db.query(models.RetargetTierConfig).filter(
        models.RetargetTierConfig.id == tier_id
    ).first()
    
    if not tier:
        return None
    
    if 'tier_name' in update_data:
        tier.tier_name = update_data['tier_name']
    if 'days_since_last_contact' in update_data:
        tier.days_since_last_contact = update_data['days_since_last_contact']
    
    tier.updated_at = datetime.now()
    db.commit()
    db.refresh(tier)
    return tier

# ฟังก์ชันสำหรับลบ retarget tier
def delete_retarget_tier(db: Session, tier_id: int):
    """ลบ retarget tier"""
    tier = db.query(models.RetargetTierConfig).filter(
        models.RetargetTierConfig.id == tier_id
    ).first()
    
    if tier:
        db.delete(tier)
        db.commit()
        return True
    return False

# ฟังก์ชันสำหรับ sync retarget tiers จาก customer_type_knowledge
def sync_retarget_tiers_from_knowledge(db: Session, page_id: int):
    """
    Sync retarget tiers จาก customer_type_knowledge 
    สำหรับ page ที่ระบุ - ทำเพียงครั้งเดียว
    """
    try:
        # 🔥 ตรวจสอบก่อนว่ามีข้อมูลของ page นี้อยู่แล้วหรือไม่
        existing_tiers = db.query(models.RetargetTierConfig).filter(
            models.RetargetTierConfig.page_id == page_id
        ).all()
        
        # ถ้ามีข้อมูลอยู่แล้ว ไม่ต้องทำอะไร
        if existing_tiers and len(existing_tiers) > 0:
            logger.info(f"✅ Page {page_id} already has {len(existing_tiers)} retarget tiers - skipping sync")
            return existing_tiers
        
        # กำหนดค่า default สำหรับแต่ละ tier (มีแค่ 3 tiers เท่านั้น)
        default_tiers = [
            {"name": "หาย", "days": 7},
            {"name": "หายนาน", "days": 30},
            {"name": "หายนานมากๆ", "days": 90}
        ]
        
        # Dictionary เพื่อเก็บ tier ที่จะ sync (ป้องกันซ้ำ)
        tiers_dict = {}
        
        # พยายามดึงข้อมูลจาก customer_type_knowledge ก่อน
        knowledge_types = db.query(models.CustomerTypeKnowledge).all()
        
        for kt in knowledge_types:
            if kt.logic:
                # ตรวจสอบประเภทของ logic
                if isinstance(kt.logic, dict):
                    retarget_tiers = kt.logic.get('retarget_tiers', [])
                    
                    if isinstance(retarget_tiers, list):
                        for tier in retarget_tiers:
                            if isinstance(tier, dict):
                                tier_name = tier.get('name')
                                days = tier.get('days', 0)
                                
                                # ตรวจสอบว่า tier_name ถูกต้องและยังไม่มีใน dict
                                valid_names = ['หาย', 'หายนาน', 'หายนานมากๆ']
                                if tier_name in valid_names and tier_name not in tiers_dict:
                                    tiers_dict[tier_name] = int(days) if isinstance(days, (int, float)) else 0
                elif isinstance(kt.logic, str):
                    # ถ้า logic เป็น string ทั้งหมด
                    try:
                        import json
                        parsed_logic = json.loads(kt.logic)
                        if isinstance(parsed_logic, dict):
                            retarget_tiers = parsed_logic.get('retarget_tiers', [])
                            if isinstance(retarget_tiers, list):
                                for tier in retarget_tiers:
                                    if isinstance(tier, dict):
                                        tier_name = tier.get('name')
                                        days = tier.get('days', 0)
                                        
                                        valid_names = ['หาย', 'หายนาน', 'หายนานมากๆ']
                                        if tier_name in valid_names and tier_name not in tiers_dict:
                                            tiers_dict[tier_name] = int(days) if isinstance(days, (int, float)) else 0
                    except json.JSONDecodeError:
                        logger.warning(f"Could not parse logic as JSON for {kt.type_name}")
                
                # ถ้าพบครบ 3 tiers แล้ว ให้หยุดค้นหา
                if len(tiers_dict) == 3:
                    break
        
        # ถ้ายังไม่ครบ 3 tiers ให้เติมจาก default
        for tier in default_tiers:
            if tier["name"] not in tiers_dict:
                tiers_dict[tier["name"]] = tier["days"]
        
        # สร้าง tiers ใหม่ (จะมีแค่ 3 tiers ต่อ page)
        synced_tiers = []
        for tier_name, days in tiers_dict.items():
            new_tier = models.RetargetTierConfig(
                page_id=page_id,
                tier_name=tier_name,
                days_since_last_contact=days
            )
            db.add(new_tier)
            synced_tiers.append(new_tier)
            logger.info(f"Created tier: {tier_name} = {days} days for page {page_id}")
        
        db.commit()
        logger.info(f"✅ Successfully synced {len(synced_tiers)} tiers for page {page_id}")
        return synced_tiers
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error syncing retarget tiers: {e}")
        return []

# เพิ่มฟังก์ชันสำหรับ reset/cleanup ข้อมูลซ้ำ
def cleanup_duplicate_retarget_tiers(db: Session):
    """
    ลบข้อมูล retarget tiers ที่ซ้ำซ้อน เหลือแค่ 3 tiers ต่อ page
    """
    try:
        # ดึง pages ทั้งหมด
        pages = db.query(models.FacebookPage).all()
        
        for page in pages:
            # ดึง tiers ทั้งหมดของ page นี้
            all_tiers = db.query(models.RetargetTierConfig).filter(
                models.RetargetTierConfig.page_id == page.ID
            ).order_by(models.RetargetTierConfig.id).all()
            
            if len(all_tiers) > 3:
                logger.info(f"Page {page.ID} has {len(all_tiers)} tiers - cleaning up...")
                
                # เก็บไว้แค่ 3 tiers แรก (หรือ 3 tiers ที่มี tier_name ไม่ซ้ำ)
                seen_names = set()
                tiers_to_keep = []
                tiers_to_delete = []
                
                for tier in all_tiers:
                    if tier.tier_name not in seen_names and len(tiers_to_keep) < 3:
                        seen_names.add(tier.tier_name)
                        tiers_to_keep.append(tier)
                    else:
                        tiers_to_delete.append(tier)
                
                # ลบ tiers ที่ไม่ต้องการ
                for tier in tiers_to_delete:
                    db.delete(tier)
                
                logger.info(f"Deleted {len(tiers_to_delete)} duplicate tiers for page {page.ID}")
        
        db.commit()
        logger.info("✅ Cleanup completed")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error cleaning up duplicate tiers: {e}")

# เพิ่มฟังก์ชันสำหรับตรวจสอบและ sync เฉพาะ page ที่ยังไม่มีข้อมูล
def sync_missing_retarget_tiers(db: Session):
    """
    Sync retarget tiers เฉพาะ page ที่ยังไม่มีข้อมูล
    """
    try:
        # ดึง pages ทั้งหมด
        all_pages = db.query(models.FacebookPage).all()
        
        synced_count = 0
        skipped_count = 0
        
        for page in all_pages:
            # ตรวจสอบว่ามี tiers อยู่แล้วหรือไม่
            existing_tiers = db.query(models.RetargetTierConfig).filter(
                models.RetargetTierConfig.page_id == page.ID
            ).count()
            
            if existing_tiers == 0:
                # ยังไม่มี tiers - ทำการ sync
                synced_tiers = sync_retarget_tiers_from_knowledge(db, page.ID)
                if synced_tiers:
                    synced_count += 1
                    logger.info(f"✅ Synced tiers for page {page.page_name}")
            else:
                skipped_count += 1
                logger.debug(f"⏭️ Page {page.page_name} already has {existing_tiers} tiers - skipped")
        
        logger.info(f"✅ Sync completed: {synced_count} pages synced, {skipped_count} pages skipped")
        return {"synced": synced_count, "skipped": skipped_count}
        
    except Exception as e:
        logger.error(f"Error in sync_missing_retarget_tiers: {e}")
        return {"error": str(e)}
    
def get_page_db_id(db: Session, page_identifier):
    """
    Helper function to get the correct page ID
    page_identifier อาจเป็น:
    - int: database ID (ใช้ตรงๆ)
    - str: facebook page_id (ต้อง query หา)
    """
    if isinstance(page_identifier, int):
        # ถ้าเป็น int แล้ว คือ database ID
        return page_identifier
    elif isinstance(page_identifier, str):
        # ถ้าเป็น string คือ facebook page_id ต้อง query หา
        page = db.query(models.FacebookPage).filter(
            models.FacebookPage.page_id == page_identifier
        ).first()
        return page.ID if page else None
    return None

def get_custom_message_by_id(db: Session, message_id: int):
    return db.query(models.FBCustomMessage).filter(models.FBCustomMessage.id == message_id).first()