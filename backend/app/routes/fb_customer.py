from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from sqlalchemy import or_, and_
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
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"ไม่พบเพจ page_id: {page_id}")

    install_date = page.created_at

    # ✅ joinedload ใช้ relationship ของ FbCustomer
    customers_query = db.query(FbCustomer).options(
        joinedload(FbCustomer.classifications),
        joinedload(FbCustomer.custom_classifications),
        joinedload(FbCustomer.current_category)
    ).filter(FbCustomer.page_id == page.id)

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

    result = []
    for customer in customers:
        customer_data = {
            "id": customer.id,
            "page_id": customer.page_id,
            "customer_psid": customer.customer_psid,
            "name": customer.name,
            "first_interaction_at": customer.first_interaction_at,
            "last_interaction_at": customer.last_interaction_at,
            "created_at": customer.created_at,
            "updated_at": customer.updated_at,
            "source_type": customer.source_type,
            # เพิ่มชื่อกลุ่มจาก relationship
            "customer_type_knowledge_name": customer.current_category.type_name if customer.current_category else None,
            "classifications_count": len(customer.classifications),
            "custom_classifications_count": len(customer.custom_classifications)
        }
        result.append(customer_data)

    return result

# Debug endpoint
@router.get("/debug/customer-types/{page_id}")
def debug_customer_types(page_id: str, db: Session = Depends(get_db)):
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        return {"error": "Page not found"}

    customers = db.query(FbCustomer).options(
        joinedload(FbCustomer.custom_classifications),
        joinedload(FbCustomer.current_category)
    ).filter(FbCustomer.page_id == page.id).limit(10).all()

    result = []
    for customer in customers:
        result.append({
            "name": customer.name,
            "psid": customer.customer_psid,
            "knowledge_group": customer.current_category.type_name if customer.current_category else None,
            "custom_groups": [c.new_category_id for c in customer.custom_classifications]
        })

    return {
        "page_id": page_id,
        "customers_with_types": result,
        "total": len(result)
    }
