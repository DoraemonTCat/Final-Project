from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from sqlalchemy import or_, and_
from app.database.models import FbCustomer, FacebookPage , FBCustomerCustomClassification
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

    # ใช้ eager loading เพื่อโหลด relationships
    customers_query = db.query(FbCustomer).options(
        joinedload(FbCustomer.current_category),
        joinedload(FbCustomer.classifications),
        joinedload(FbCustomer.custom_classifications).joinedload(
            FBCustomerCustomClassification.new_category
        ),
        joinedload(FbCustomer.mining_statuses)  # เพิ่มบรรทัดนี้
    ).filter(FbCustomer.page_id == page.ID)

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
        # ดึงข้อมูล custom category ล่าสุด (ถ้ามี)
        latest_custom_classification = None
        if customer.custom_classifications:
            latest_custom_classification = sorted(
                customer.custom_classifications, 
                key=lambda x: x.classified_at, 
                reverse=True
            )[0] if customer.custom_classifications else None
        
        # ========== เพิ่มการดึงสถานะการขุดล่าสุด ==========
        latest_mining_status = None
        mining_status_value = "ยังไม่ขุด"  # ค่า default
        
        if customer.mining_statuses:
            # เรียงตาม created_at และเอาอันล่าสุด
            sorted_statuses = sorted(
                customer.mining_statuses,
                key=lambda x: x.created_at,
                reverse=True
            )
            if sorted_statuses:
                latest_mining_status = sorted_statuses[0]
                mining_status_value = latest_mining_status.status
        
        customer_data = {
            "id": customer.id,
            "page_id": customer.page_id,
            "customer_psid": customer.customer_psid,
            "name": customer.name,
            "first_interaction_at": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
            "last_interaction_at": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
            "source_type": customer.source_type,
            
            # ข้อมูล Knowledge Category (จาก current_category)
            "current_category_id": customer.current_category_id,
            "current_category_name": customer.current_category.type_name if customer.current_category else None,
            
            # ข้อมูล Custom Category (จาก classifications ล่าสุด)
            "custom_category_id": latest_custom_classification.new_category_id if latest_custom_classification else None,
            "custom_category_name": latest_custom_classification.new_category.type_name if (latest_custom_classification and latest_custom_classification.new_category) else None,
            
            # จำนวน classifications
            "classifications_count": len(customer.classifications),
            "custom_classifications_count": len(customer.custom_classifications),
            
            # ========== เพิ่มสถานะการขุด ==========
            "mining_status": mining_status_value,
            "mining_status_updated_at": latest_mining_status.created_at.isoformat() if latest_mining_status else None

        }
        result.append(customer_data)

    return result

# Debug endpoint
@router.get("/debug/customer-types/{page_id}")
def debug_customer_types(page_id: str, db: Session = Depends(get_db)):
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        return {"error": "Page not found"}

    # ✅ แก้ไข: ใช้ page.ID แทน page.id
    customers = db.query(FbCustomer).options(
        joinedload(FbCustomer.custom_classifications),
        joinedload(FbCustomer.current_category)
    ).filter(FbCustomer.page_id == page.ID).limit(10).all()  # ✅ เปลี่ยนจาก page.id เป็น page.ID

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