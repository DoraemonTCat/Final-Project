from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import or_, and_
from sqlalchemy.orm import joinedload
from app.database.models import FbCustomer, FacebookPage
from app.database.database import get_db
from app.database.schemas import FbCustomerSchema

router = APIRouter()

# API สำหรับจัดการข้อมูลลูกค้า Facebook
@router.get("/fb-customers", response_model=List[FbCustomerSchema])
def get_all_customers(db: Session = Depends(get_db)):
    return db.query(FbCustomer).all()

# API สำหรับดึงข้อมูลลูกค้าตาม ID
@router.get("/fb-customers/{customer_id}", response_model=FbCustomerSchema)
def get_customer_by_id(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(FbCustomer).filter(FbCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

# API สำหรับดึงข้อมูลลูกค้าตาม Facebook page ID
@router.get("/fb-customers/by-page/{page_id}", response_model=List[FbCustomerSchema])
def get_customers_by_page(page_id: str, db: Session = Depends(get_db)):
    # หา page record จาก Facebook page ID จริง
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()

    if not page:
        raise HTTPException(status_code=404, detail=f"ไม่พบเพจ page_id: {page_id}")

    # ดึงวันที่ติดตั้งระบบ (created_at ของ page)
    install_date = page.created_at
    
    # ดึง customer พร้อม eager load customer_type_custom
    customers_query = db.query(FbCustomer).options(
        joinedload(FbCustomer.customer_type_custom)
    ).filter(FbCustomer.page_id == page.ID)
    
    # กรองตามเงื่อนไข (โค้ดเดิม)
    customers = customers_query.filter(
        and_(
            FbCustomer.first_interaction_at.isnot(None),
            FbCustomer.last_interaction_at.isnot(None),
            or_(
                FbCustomer.source_type == 'new',
                and_(
                    FbCustomer.source_type == 'imported',
                    FbCustomer.last_interaction_at > install_date
                )
            )
        )
    ).order_by(FbCustomer.last_interaction_at.desc()).all()
    
    print(f"✅ Found {len(customers)} active customers for page_id {page_id}")
    
    return customers