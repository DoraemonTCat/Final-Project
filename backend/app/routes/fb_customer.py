# backend/app/routes/fb_customer.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional
from sqlalchemy import or_, and_
from app.database.models import FbCustomer, FacebookPage, FBCustomerCustomClassification
from app.database.database import get_db
from app.database.schemas import FbCustomerSchema
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Helper Functions ===============
def get_customer_data(customer: FbCustomer) -> dict:
    """Format customer data for response"""
    # Get latest custom classification
    latest_custom = None
    if customer.custom_classifications:
        latest_custom = max(
            customer.custom_classifications,
            key=lambda x: x.classified_at,
            default=None
        )
    
    # Get latest mining status
    mining_status = "ยังไม่ขุด"
    mining_updated_at = None
    
    if customer.mining_statuses:
        latest_mining = max(
            customer.mining_statuses,
            key=lambda x: x.created_at,
            default=None
        )
        if latest_mining:
            mining_status = latest_mining.status
            mining_updated_at = latest_mining.created_at.isoformat()
    
    return {
        "id": customer.id,
        "page_id": customer.page_id,
        "customer_psid": customer.customer_psid,
        "name": customer.name,
        "first_interaction_at": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
        "last_interaction_at": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
        "source_type": customer.source_type,
        
        # Knowledge Category
        "current_category_id": customer.current_category_id,
        "current_category_name": customer.current_category.type_name if customer.current_category else None,
        
        # Custom Category
        "custom_category_id": latest_custom.new_category_id if latest_custom else None,
        "custom_category_name": (
            latest_custom.new_category.type_name 
            if latest_custom and latest_custom.new_category 
            else None
        ),
        
        # Classifications count
        "classifications_count": len(customer.classifications),
        "custom_classifications_count": len(customer.custom_classifications),
        
        # Mining status
        "mining_status": mining_status,
        "mining_status_updated_at": mining_updated_at
    }

def build_customer_query(db: Session, page_id: int):
    """Build optimized query with eager loading"""
    return db.query(FbCustomer).options(
        joinedload(FbCustomer.current_category),
        joinedload(FbCustomer.classifications),
        joinedload(FbCustomer.custom_classifications).joinedload(
            FBCustomerCustomClassification.new_category
        ),
        joinedload(FbCustomer.mining_statuses)
    ).filter(FbCustomer.page_id == page_id)

# =============== API Endpoints ===============
@router.get("/fb-customers", response_model=List[FbCustomerSchema])
def get_all_customers(db: Session = Depends(get_db)):
    """Get all customers"""
    return db.query(FbCustomer).all()

@router.get("/fb-customers/{customer_id}", response_model=FbCustomerSchema)
def get_customer_by_id(customer_id: int, db: Session = Depends(get_db)):
    """Get customer by ID"""
    customer = db.query(FbCustomer).filter(FbCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.get("/fb-customers/by-page/{page_id}")
def get_customers_by_page(page_id: str, db: Session = Depends(get_db)):
    """Get customers by Facebook page with optimized query"""
    # Get page
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"Page not found: {page_id}")

    install_date = page.created_at

    # Build optimized query with eager loading
    customers_query = build_customer_query(db, page.ID)
    
    # Apply filters
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

    # Format response using helper function
    return [get_customer_data(customer) for customer in customers]

@router.get("/debug/customer-types/{page_id}")
def debug_customer_types(page_id: str, db: Session = Depends(get_db)):
    """Debug endpoint for customer types"""
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        return {"error": "Page not found"}

    # Use optimized query with limit for debug
    customers = db.query(FbCustomer).options(
        joinedload(FbCustomer.custom_classifications),
        joinedload(FbCustomer.current_category)
    ).filter(FbCustomer.page_id == page.ID).limit(10).all()

    result = [
        {
            "name": customer.name,
            "psid": customer.customer_psid,
            "knowledge_group": customer.current_category.type_name if customer.current_category else None,
            "custom_groups": [c.new_category_id for c in customer.custom_classifications]
        }
        for customer in customers
    ]

    return {
        "page_id": page_id,
        "customers_with_types": result,
        "total": len(result)
    }