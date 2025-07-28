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
@router.get("/fb-customers/by-page/{page_id}")
def get_customers_by_page(page_id: str, db: Session = Depends(get_db)):
    # หา page record จาก Facebook page ID จริง
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()

    if not page:
        raise HTTPException(status_code=404, detail=f"ไม่พบเพจ page_id: {page_id}")

    # ดึงวันที่ติดตั้งระบบ
    install_date = page.created_at
    
    # ดึง customer พร้อม eager load customer_type_custom
    customers_query = db.query(FbCustomer).options(
        joinedload(FbCustomer.customer_type_custom)
    ).filter(FbCustomer.page_id == page.ID)
    
    # กรองตามเงื่อนไข
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
    
    # สร้าง response data พร้อม customer type name
    result = []
    for customer in customers:
        customer_data = {
            "id": customer.id,
            "page_id": customer.page_id,
            "customer_psid": customer.customer_psid,
            "name": customer.name,
            "customer_type_custom_id": customer.customer_type_custom_id,
            "customer_type_knowledge_id": customer.customer_type_knowledge_id,
            "first_interaction_at": customer.first_interaction_at,
            "last_interaction_at": customer.last_interaction_at,
            "created_at": customer.created_at,
            "updated_at": customer.updated_at,
            "source_type": customer.source_type,
            # เพิ่มชื่อกลุ่ม
            "customer_type_name": customer.customer_type_custom.type_name if customer.customer_type_custom else None
        }
        result.append(customer_data)
    
    print(f"✅ Found {len(customers)} active customers for page_id {page_id}")
    
    # Debug: แสดงข้อมูล customer type
    for idx, customer in enumerate(customers[:5]):  # แสดง 5 คนแรก
        print(f"Customer {idx+1}: {customer.name}")
        print(f"  - customer_type_custom_id: {customer.customer_type_custom_id}")
        if customer.customer_type_custom:
            print(f"  - customer_type_name: {customer.customer_type_custom.type_name}")
        else:
            print(f"  - customer_type_name: None")
    
    return result

# เพิ่ม endpoint สำหรับ debug
@router.get("/debug/customer-types/{page_id}")
def debug_customer_types(page_id: str, db: Session = Depends(get_db)):
    """Debug endpoint สำหรับตรวจสอบ customer types"""
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        return {"error": "Page not found"}
    
    # ดึง customers พร้อม type
    customers = db.query(FbCustomer).options(
        joinedload(FbCustomer.customer_type_custom)
    ).filter(
        FbCustomer.page_id == page.ID,
        FbCustomer.customer_type_custom_id.isnot(None)
    ).limit(10).all()
    
    result = []
    for customer in customers:
        result.append({
            "name": customer.name,
            "psid": customer.customer_psid,
            "customer_type_custom_id": customer.customer_type_custom_id,
            "customer_type_name": customer.customer_type_custom.type_name if customer.customer_type_custom else None
        })
    
    return {
        "page_id": page_id,
        "customers_with_types": result,
        "total": len(result)
    }