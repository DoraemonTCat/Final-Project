from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import or_, and_
from sqlalchemy.orm import joinedload
from app.database.models import FbCustomer, FacebookPage
from app.database.database import get_db
from app.database.schemas import FbCustomerSchema
from pydantic import BaseModel
from app.database import crud

router = APIRouter()

# ========== Mining Status Models ==========
class UpdateMiningStatusRequest(BaseModel):
    psids: List[str]
    status: str  # 'not_mined', 'mined', 'responded'

class SingleMiningStatusRequest(BaseModel):
    psid: str
    status: str

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
    
    # ดึง customer พร้อม eager load ทั้ง customer_type_custom และ customer_type_knowledge
    customers_query = db.query(FbCustomer).options(
        joinedload(FbCustomer.customer_type_custom),
        joinedload(FbCustomer.customer_type_knowledge)
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
    
    # สร้าง response data พร้อมทั้ง user group, knowledge group และ mining status
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
            # เพิ่มชื่อกลุ่มทั้ง 2 ประเภท
            "customer_type_name": customer.customer_type_custom.type_name if customer.customer_type_custom else None,
            "customer_type_knowledge_name": customer.customer_type_knowledge.type_name if customer.customer_type_knowledge else None,
            # 🔥 เพิ่ม mining status และ current tier
            "mining_status": customer.mining_status if hasattr(customer, 'mining_status') else 'not_mined',
            "current_tier": customer.current_tier if hasattr(customer, 'current_tier') else None
        }
        result.append(customer_data)
    
    print(f"✅ Found {len(customers)} active customers for page_id {page_id}")
    
    # Debug: แสดงข้อมูล customer type และ mining status
    for idx, customer in enumerate(customers[:5]):  # แสดง 5 คนแรก
        print(f"Customer {idx+1}: {customer.name}")
        print(f"  - User Group: {customer.customer_type_custom.type_name if customer.customer_type_custom else 'None'}")
        print(f"  - Knowledge Group: {customer.customer_type_knowledge.type_name if customer.customer_type_knowledge else 'None'}")
        print(f"  - Mining Status: {customer.mining_status if hasattr(customer, 'mining_status') else 'not_mined'}")
    
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
    
# ========== Mining Status Endpoints ==========

@router.post("/fb-customers/{page_id}/mining-status/update")
async def update_mining_status(
    page_id: str,
    request: UpdateMiningStatusRequest,
    db: Session = Depends(get_db)
):
    """อัพเดทสถานะการขุดแบบหลายคน"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Validate status
    valid_statuses = ['not_mined', 'mined', 'responded']
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    updated_count = crud.bulk_update_mining_status(
        db, 
        page.ID, 
        request.psids, 
        request.status
    )
    
    return {
        "status": "success",
        "updated_count": updated_count,
        "mining_status": request.status,
        "message": f"Updated {updated_count} customers to {request.status}"
    }

@router.put("/fb-customers/{page_id}/{psid}/mining-status")
async def update_single_mining_status(
    page_id: str,
    psid: str,
    request: SingleMiningStatusRequest,
    db: Session = Depends(get_db)
):
    """อัพเดทสถานะการขุดของลูกค้าคนเดียว"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    customer = crud.update_customer_mining_status(
        db, 
        page.ID, 
        psid, 
        request.status
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {
        "status": "success",
        "customer_psid": psid,
        "mining_status": request.status
    }

@router.get("/fb-customers/{page_id}/mining-statistics")
async def get_mining_statistics(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึงสถิติการขุดของเพจ"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    stats = crud.get_mining_statistics(db, page.ID)
    
    return {
        "page_id": page_id,
        "statistics": stats,
        "generated_at": datetime.now().isoformat()
    }

@router.get("/fb-customers/{page_id}/by-mining-status/{status}")
async def get_customers_by_mining_status(
    page_id: str,
    status: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """ดึงลูกค้าตามสถานะการขุด"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Validate status
    valid_statuses = ['not_mined', 'mined', 'responded']
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    customers = crud.get_customers_by_mining_status(
        db, 
        page.ID, 
        status, 
        skip, 
        limit
    )
    
    return {
        "status": status,
        "count": len(customers),
        "customers": [
            {
                "id": c.id,
                "psid": c.customer_psid,
                "name": c.name,
                "mining_status": c.mining_status,
                "last_interaction": c.last_interaction_at.isoformat() if c.last_interaction_at else None
            }
            for c in customers
        ]
    }