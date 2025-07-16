from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

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

    # 2. ดึง customer โดยใช้ internal page ID
    customers = db.query(FbCustomer).filter(FbCustomer.page_id == page.ID).all()
    print(f"✅ Found {len(customers)} customers for page_id {page_id} (internal ID: {page.ID})")
    return customers

