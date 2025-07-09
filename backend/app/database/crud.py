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
        
        db_customer = models.FbCustomer(
            page_id=page_id,
            customer_psid=customer_psid,
            name=customer_data.get('name', ''),
            customer_type_custom_id=customer_data.get('customer_type_custom_id'),
            customer_type_knowledge_id=customer_data.get('customer_type_knowledge_id'),
            first_interaction_at=first_interaction,  # ครั้งแรกที่ทักเข้ามา - ไม่เปลี่ยนแปลง
            last_interaction_at=last_interaction,    # ครั้งล่าสุดที่ทักเข้ามา
            source_type=customer_data.get('source_type', 'new')
            # created_at และ updated_at จะถูกตั้งค่าอัตโนมัติโดย database
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
    
    for customer_data in customers_data:
        try:
            psid = customer_data.get('customer_psid')
            if not psid:
                results["errors"] += 1
                continue
            
            existing = get_customer_by_psid(db, page_id, psid)
            if existing:
                results["updated"] += 1
            else:
                results["created"] += 1
            
            create_or_update_customer(db, page_id, psid, customer_data)
            
        except Exception as e:
            logger.error(f"Error processing customer {customer_data.get('customer_psid')}: {e}")
            results["errors"] += 1
    
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

# ========== CustomerTypeMessage CRUD Operations ==========

def create_customer_type_message(db: Session, page_id: int, message_data: dict):
    """สร้างข้อความสำหรับกลุ่มลูกค้า"""
    db_message = models.CustomerTypeMessage(
        page_id=page_id,
        customer_type_custom_id=message_data.get('customer_type_custom_id'),
        page_customer_type_knowledge_id=message_data.get('page_customer_type_knowledge_id'),
        message_type=message_data['message_type'],
        content=message_data['content'],
        dir=message_data.get('dir', ''),
        display_order=message_data['display_order']
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_customer_type_messages(db: Session, page_id: int, customer_type_custom_id: int = None):
    """ดึงข้อความของกลุ่มลูกค้า"""
    query = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.page_id == page_id
    )
    
    if customer_type_custom_id:
        query = query.filter(
            models.CustomerTypeMessage.customer_type_custom_id == customer_type_custom_id
        )
    
    return query.order_by(models.CustomerTypeMessage.display_order).all()

def update_customer_type_message(db: Session, message_id: int, update_data: dict):
    """อัพเดทข้อความของกลุ่มลูกค้า"""
    db_message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if not db_message:
        return None
    
    for key, value in update_data.items():
        if hasattr(db_message, key):
            setattr(db_message, key, value)
    
    db_message.updated_at = datetime.now()
    db.commit()
    db.refresh(db_message)
    return db_message

def delete_customer_type_message(db: Session, message_id: int):
    """ลบข้อความของกลุ่มลูกค้า"""
    db_message = db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.id == message_id
    ).first()
    
    if db_message:
        db.delete(db_message)
        db.commit()
        return True
    return False

def delete_customer_type_messages_by_group(db: Session, customer_type_custom_id: int):
    """ลบข้อความทั้งหมดของกลุ่มลูกค้า"""
    db.query(models.CustomerTypeMessage).filter(
        models.CustomerTypeMessage.customer_type_custom_id == customer_type_custom_id
    ).delete()
    db.commit()

def bulk_create_customer_type_messages(db: Session, page_id: int, customer_type_custom_id: int, messages: List[Dict]):
    """สร้างข้อความหลายรายการพร้อมกัน"""
    # ลบข้อความเดิมทั้งหมดก่อน
    delete_customer_type_messages_by_group(db, customer_type_custom_id)
    
    # สร้างข้อความใหม่
    db_messages = []
    for idx, msg in enumerate(messages):
        db_message = models.CustomerTypeMessage(
            page_id=page_id,
            customer_type_custom_id=customer_type_custom_id,
            message_type=msg['type'],
            content=msg['content'],
            dir=msg.get('dir', ''),
            display_order=msg.get('order', idx)
        )
        db_messages.append(db_message)
    
    db.add_all(db_messages)
    db.commit()
    
    return {"created": len(db_messages)}

# ========== MessageSchedule CRUD Operations ==========

def create_message_schedule(db: Session, schedule_data: dict):
    """สร้างตารางเวลาส่งข้อความ"""
    db_schedule = models.MessageSchedule(
        customer_type_message_id=schedule_data['customer_type_message_id'],
        send_type=schedule_data['send_type'],
        scheduled_at=schedule_data.get('scheduled_at'),
        send_after_inactive=schedule_data.get('send_after_inactive'),
        frequency=schedule_data.get('frequency', 'once')
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def get_message_schedules_by_page(db: Session, page_id: int):
    """ดึงตารางเวลาทั้งหมดของเพจ"""
    return db.query(models.MessageSchedule).join(
        models.CustomerTypeMessage,
        models.MessageSchedule.customer_type_message_id == models.CustomerTypeMessage.id
    ).filter(
        models.CustomerTypeMessage.page_id == page_id
    ).all()

def get_message_schedule(db: Session, schedule_id: int):
    """ดึงตารางเวลาตาม ID"""
    return db.query(models.MessageSchedule).filter(
        models.MessageSchedule.id == schedule_id
    ).first()

def update_message_schedule(db: Session, schedule_id: int, update_data: dict):
    """อัพเดทตารางเวลา"""
    db_schedule = get_message_schedule(db, schedule_id)
    if not db_schedule:
        return None
    
    for key, value in update_data.items():
        if hasattr(db_schedule, key):
            setattr(db_schedule, key, value)
    
    db_schedule.updated_at = datetime.now()
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def delete_message_schedule(db: Session, schedule_id: int):
    """ลบตารางเวลา"""
    db_schedule = get_message_schedule(db, schedule_id)
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
        return True
    return False

def create_schedule_with_messages(db: Session, page_id: int, group_id: int, schedule_data: dict):
    """สร้างตารางเวลาพร้อมข้อความ"""
    try:
        # สร้างข้อความก่อน
        messages = schedule_data.get('messages', [])
        message_schedules = []
        
        for idx, msg in enumerate(messages):
            # สร้างข้อความ
            db_message = models.CustomerTypeMessage(
                page_id=page_id,
                customer_type_custom_id=group_id,
                message_type=msg['type'],
                content=msg['content'],
                dir=msg.get('dir', ''),
                display_order=idx
            )
            db.add(db_message)
            db.flush()  # ให้ได้ ID ของข้อความ
            
            # สร้างตารางเวลาสำหรับข้อความนี้
            send_after_inactive = None
            if schedule_data['type'] == 'user-inactive':
                # แปลงเป็น timedelta
                period = int(schedule_data.get('inactivityPeriod', 1))
                unit = schedule_data.get('inactivityUnit', 'days')
                
                if unit == 'minutes':
                    send_after_inactive = timedelta(minutes=period)
                elif unit == 'hours':
                    send_after_inactive = timedelta(hours=period)
                elif unit == 'days':
                    send_after_inactive = timedelta(days=period)
                elif unit == 'weeks':
                    send_after_inactive = timedelta(weeks=period)
                elif unit == 'months':
                    send_after_inactive = timedelta(days=period * 30)
            
            scheduled_at = None
            if schedule_data['type'] == 'scheduled':
                scheduled_at = datetime.fromisoformat(f"{schedule_data['date']}T{schedule_data['time']}:00")
            
            db_schedule = models.MessageSchedule(
                customer_type_message_id=db_message.id,
                send_type=schedule_data['type'],
                scheduled_at=scheduled_at,
                send_after_inactive=send_after_inactive,
                frequency=schedule_data.get('repeat', {}).get('type', 'once')
            )
            db.add(db_schedule)
            message_schedules.append(db_schedule)
        
        db.commit()
        return {"success": True, "schedules_created": len(message_schedules)}
        
    except Exception as e:
        db.rollback()
        raise e

def get_schedules_with_details(db: Session, page_id: int):
    """ดึงตารางเวลาพร้อมรายละเอียดทั้งหมด"""
    schedules = db.query(
        models.MessageSchedule,
        models.CustomerTypeMessage,
        models.CustomerTypeCustom
    ).join(
        models.CustomerTypeMessage,
        models.MessageSchedule.customer_type_message_id == models.CustomerTypeMessage.id
    ).join(
        models.CustomerTypeCustom,
        models.CustomerTypeMessage.customer_type_custom_id == models.CustomerTypeCustom.id
    ).filter(
        models.CustomerTypeMessage.page_id == page_id
    ).order_by(
        models.CustomerTypeCustom.id,
        models.CustomerTypeMessage.display_order
    ).all()
    
    # จัดกลุ่มตาม customer group
    grouped_schedules = {}
    for schedule, message, group in schedules:
        group_key = f"{group.id}_{schedule.send_type}_{schedule.scheduled_at}_{schedule.send_after_inactive}"
        
        if group_key not in grouped_schedules:
            grouped_schedules[group_key] = {
                'id': f"schedule_{group.id}_{int(datetime.now().timestamp())}",
                'group_id': group.id,
                'group_name': group.type_name,
                'type': schedule.send_type,
                'scheduled_at': schedule.scheduled_at.isoformat() if schedule.scheduled_at else None,
                'send_after_inactive': str(schedule.send_after_inactive) if schedule.send_after_inactive else None,
                'frequency': schedule.frequency,
                'messages': [],
                'created_at': schedule.created_at.isoformat(),
                'updated_at': schedule.updated_at.isoformat()
            }
        
        grouped_schedules[group_key]['messages'].append({
            'id': message.id,
            'type': message.message_type,
            'content': message.content,
            'order': message.display_order
        })
    
    return list(grouped_schedules.values())