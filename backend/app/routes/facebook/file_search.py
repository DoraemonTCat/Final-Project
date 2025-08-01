# ไว้ในการตรวจสอบและค้นหา customers จากรายชื่อในไฟล์ ใน database

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List
from pydantic import BaseModel
import logging

from app.database import crud
from app.database.database import get_db
from app.database.models import FbCustomer, FacebookPage

router = APIRouter()
logger = logging.getLogger(__name__)

class FileSearchRequest(BaseModel):
    page_id: str
    user_names: List[str]

# API สำหรับค้นหา customers จากรายชื่อในไฟล์
@router.post("/search-customers-by-file")
async def search_customers_by_file(
    request: FileSearchRequest,
    db: Session = Depends(get_db)
):
    """ค้นหา customers จากรายชื่อในไฟล์"""
    try:
        # ตรวจสอบ page
        page = crud.get_page_by_page_id(db, request.page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Normalize รายชื่อ
        normalized_names = [name.strip().lower() for name in request.user_names if name.strip()]
        
        logger.info(f"🔍 ค้นหา {len(normalized_names)} รายชื่อใน database")
        
        # ค้นหา customers ทั้งหมดของ page นี้
        all_customers = db.query(FbCustomer).filter(
            FbCustomer.page_id == page.ID
        ).all()
        
        found_customers = []
        found_names = set()
        
        # เปรียบเทียบชื่อ
        for customer in all_customers:
            customer_name_lower = (customer.name or "").strip().lower()
            
            for search_name in normalized_names:
                if (customer_name_lower == search_name or 
                    search_name in customer_name_lower or 
                    customer_name_lower in search_name):
                    found_customers.append(customer)
                    found_names.add(search_name)
                    break
        
        # หารายชื่อที่ไม่พบ
        not_found_names = [name for name in request.user_names 
                          if name.strip().lower() not in found_names]
        
        logger.info(f"✅ พบ {len(found_customers)} คน จากทั้งหมด {len(normalized_names)} คน")
        
        # Format ข้อมูล
        customers_data = []
        for idx, customer in enumerate(found_customers):
            customers_data.append({
                "id": idx + 1,
                "conversation_id": customer.customer_psid,
                "conversation_name": customer.name or f"User...{customer.customer_psid[-8:]}",
                "user_name": customer.name or f"User...{customer.customer_psid[-8:]}",
                "raw_psid": customer.customer_psid,
                "updated_time": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                "created_time": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                "last_user_message_time": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                "first_interaction_at": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                "source_type": customer.source_type,
                "from_file_search": True
            })
        
        return {
            "found_count": len(found_customers),
            "not_found_count": len(not_found_names),
            "customers": customers_data,
            "not_found_names": not_found_names[:10]
        }
        
    except Exception as e:
        logger.error(f"❌ Error searching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))