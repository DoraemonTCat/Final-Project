from sqlalchemy.orm import Session
from app.database.models import FacebookPage
from app.database.schemas import FacebookPageCreate, FacebookPageUpdate
from sqlalchemy.exc import IntegrityError
import app.database.models as models, app.database.schemas as schemas
from sqlalchemy import or_, func
from datetime import datetime


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
        # อัพเดทข้อมูล
        if customer_data.get('name'):
            existing_customer.name = customer_data['name']
        if customer_data.get('last_interaction_at'):
            existing_customer.last_interaction_at = customer_data['last_interaction_at']
        
        existing_customer.updated_at = datetime.now()
        db.commit()
        db.refresh(existing_customer)
        return existing_customer
    else:
        # สร้างใหม่
        db_customer = models.FbCustomer(
            page_id=page_id,
            customer_psid=customer_psid,
            name=customer_data.get('name', ''),
            first_interaction_at=customer_data.get('first_interaction_at', datetime.now()),
            last_interaction_at=customer_data.get('last_interaction_at', datetime.now())
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

def update_customer_interaction(db: Session, page_id: int, customer_psid: str):
    """อัพเดทเวลาล่าสุดที่มีการติดต่อ"""
    customer = get_customer_by_psid(db, page_id, customer_psid)
    
    if customer:
        current_time = datetime.now()
        
        # ถ้ายังไม่มี first_interaction_at ให้ set ด้วย
        if not customer.first_interaction_at:
            customer.first_interaction_at = current_time
            
        customer.last_interaction_at = current_time
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
            "last_user_message_time": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None
        })
    
    return result