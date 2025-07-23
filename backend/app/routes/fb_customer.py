from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import or_, and_

from app.database.models import FbCustomer, FacebookPage
from app.database.database import get_db
from app.database.schemas import FbCustomerSchema

router = APIRouter()

@router.get("/fb-customers", response_model=List[FbCustomerSchema])
def get_all_customers(db: Session = Depends(get_db)):
    return db.query(FbCustomer).all()


@router.get("/fb-customers/{customer_id}", response_model=FbCustomerSchema)
def get_customer_by_id(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(FbCustomer).filter(FbCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/fb-customers/by-page/{page_id}", response_model=List[FbCustomerSchema])
def get_customers_by_page(page_id: str, db: Session = Depends(get_db)):
    # 1. หา page record จาก Facebook page ID จริง
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()

    if not page:
        raise HTTPException(status_code=404, detail=f"ไม่พบเพจ page_id: {page_id}")

    # 2. ดึงวันที่ติดตั้งระบบ (created_at ของ page)
    install_date = page.created_at
    
    # 3. ดึง customer โดยใช้การกรองตามเงื่อนไข
    customers_query = db.query(FbCustomer).filter(FbCustomer.page_id == page.ID)
    
    # 4. กรองตามเงื่อนไข:
    # - ต้องมีทั้ง first_interaction_at และ last_interaction_at (หมายถึงเคยมีการทักมาแล้ว)
    # - source_type = 'new': แสดงทุกคนที่มีการ interaction
    # - source_type = 'imported': แสดงเฉพาะที่ last_interaction > install_date
    customers = customers_query.filter(
        and_(
            # ต้องมีทั้ง first และ last interaction (ยืนยันว่าเคยคุยกันจริง)
            FbCustomer.first_interaction_at.isnot(None),
            FbCustomer.last_interaction_at.isnot(None),
            or_(
                # กรณี source_type = 'new' - แสดงทุกคน
                FbCustomer.source_type == 'new',
                # กรณี source_type = 'imported' - แสดงเฉพาะที่ last_interaction > install_date
                and_(
                    FbCustomer.source_type == 'imported',
                    FbCustomer.last_interaction_at > install_date
                )
            )
        )
    ).order_by(FbCustomer.last_interaction_at.desc()).all()
    
    print(f"✅ Found {len(customers)} active customers for page_id {page_id}")
    print(f"📅 Install date: {install_date}")
    print(f"🔍 Filter conditions applied:")
    print(f"   - Must have both first_interaction_at AND last_interaction_at")
    print(f"   - NEW customers: Show all who have interacted")
    print(f"   - IMPORTED customers: Show only if last interaction > install date")
    
    # Debug: แสดงตัวอย่างข้อมูล
    for idx, customer in enumerate(customers[:3]):  # แสดง 3 คนแรก
        print(f"\n👤 Customer {idx+1}:")
        print(f"   - Name: {customer.name}")
        print(f"   - Source: {customer.source_type}")
        print(f"   - First interaction: {customer.first_interaction_at}")
        print(f"   - Last interaction: {customer.last_interaction_at}")
        print(f"   - Shows in table: {'✅ Yes' if customer.last_interaction_at else '❌ No'}")
    
    return customers