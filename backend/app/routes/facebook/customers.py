# backend/app/routes/facebook/customers.py
"""
Facebook Customers Component
จัดการ:
- CRUD operations สำหรับลูกค้า
- Sync ข้อมูลจาก Facebook
- สถิติลูกค้า
- ค้นหาและกรองข้อมูล
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import pytz

from app.database import crud
from app.database.database import get_db
from app.service.facebook_api import fb_get
from .auth import get_page_tokens
from .conversations import get_user_info_from_psid, get_name_from_messages
from .utils import fix_isoformat,calculate_filter_dates, parse_iso_datetime, build_customer_data

router = APIRouter()

bangkok_tz = pytz.timezone("Asia/Bangkok")

# API สำหรับจัดการข้อมูลลูกค้า Facebook
@router.get("/customers/{page_id}")
async def get_customers(
    page_id: str, 
    skip: int = 0, 
    limit: int = 100,
    search: str = None,
    db: Session = Depends(get_db)
):
    """ดึงรายชื่อลูกค้าทั้งหมดของเพจจาก database"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ"}
        )
    
    if search:
        customers = crud.search_customers(db, page.ID, search)
    else:
        customers = crud.get_customers_by_page(db, page.ID, skip, limit)
    
    # แปลง format
    result = []
    for customer in customers:
        result.append({
            "id": customer.id,
            "psid": customer.customer_psid,
            "name": customer.name or f"User...{customer.customer_psid[-8:]}",
            "first_interaction": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
            "last_interaction": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
            "customer_type": customer.customer_type_custom.type_name if customer.customer_type_custom else None
        })
    
    return {
        "customers": result,
        "total": len(result),
        "page_id": page_id
    }

# API สำหรับดึงข้อมูลลูกค้ารายคน
@router.get("/customer/{page_id}/{psid}")
async def get_customer_detail(
    page_id: str, 
    psid: str,
    db: Session = Depends(get_db)
):
    """ดึงข้อมูลลูกค้ารายคน"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ"}
        )
    
    customer = crud.get_customer_by_psid(db, page.ID, psid)
    if not customer:
        return JSONResponse(
            status_code=404, 
            content={"error": "ไม่พบข้อมูลลูกค้า"}
        )
    
    return {
        "id": customer.id,
        "psid": customer.customer_psid,
        "name": customer.name,
        "first_interaction": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
        "last_interaction": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
        "customer_type_custom": customer.customer_type_custom.type_name if customer.customer_type_custom else None,
        "customer_type_knowledge": customer.customer_type_knowledge.type_name if customer.customer_type_knowledge else None,
        "created_at": customer.created_at.isoformat(),
        "updated_at": customer.updated_at.isoformat()
    }

# API สำหรับดึงข้อมูลลูกค้าตามช่วงเวลา
@router.put("/customer/{page_id}/{psid}")
async def update_customer(
    page_id: str, 
    psid: str,
    customer_data: dict,
    db: Session = Depends(get_db)
):
    """อัพเดทข้อมูลลูกค้า"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ"}
        )
    
    customer = crud.get_customer_by_psid(db, page.ID, psid)
    if not customer:
        return JSONResponse(
            status_code=404, 
            content={"error": "ไม่พบข้อมูลลูกค้า"}
        )
    
    # อัพเดทข้อมูล
    if "name" in customer_data:
        customer.name = customer_data["name"]
    if "customer_type_custom_id" in customer_data:
        customer.customer_type_custom_id = customer_data["customer_type_custom_id"]
    if "customer_type_knowledge_id" in customer_data:
        customer.customer_type_knowledge_id = customer_data["customer_type_knowledge_id"]
    
    customer.updated_at = datetime.now()
    db.commit()
    db.refresh(customer)
    
    return {"status": "success", "message": "อัพเดทข้อมูลสำเร็จ"}

# API สำหรับซิงค์ข้อมูลลูกค้าจาก Facebook
@router.post("/sync-customers/{page_id}")
async def sync_facebook_customers_enhanced(
    page_id: str, 
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    build_fn=build_customer_data
):
    print(f"🔄 เริ่ม sync ข้อมูลลูกค้าสำหรับ page_id: {page_id}")
    
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(status_code=400, content={"error": f"ไม่พบเพจ {page_id} ในระบบ กรุณาเชื่อมต่อเพจก่อน"})

    access_token = get_page_tokens().get(page_id)
    if not access_token:
        return JSONResponse(status_code=400, content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}"})

    try:
        filter_start_date, filter_end_date = calculate_filter_dates(period, start_date, end_date)
        print(f"🕒 ช่วงเวลา: {filter_start_date} - {filter_end_date}")

        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(100){created_time,from,message}",
            "limit": 100
        }
        
        conversations = fb_get(endpoint, params, access_token)
        if "error" in conversations:
            return JSONResponse(status_code=500, content={"error": "ไม่สามารถดึง conversations ได้"})

        installed_at = page.created_at or datetime.now(bangkok_tz)
        installed_at = installed_at if installed_at.tzinfo else bangkok_tz.localize(installed_at)

        customers_to_sync = []
        filtered_count, error_count = 0, 0

        for convo in conversations.get("data", []):
            updated_time = convo.get("updated_time")
            convo_time = parse_iso_datetime(updated_time)

            if filter_start_date and convo_time and (convo_time < filter_start_date or convo_time > filter_end_date):
                filtered_count += 1
                continue

            for participant in convo.get("participants", {}).get("data", []):
                participant_id = participant.get("id")
                if not participant_id or participant_id == page_id:
                    continue

                messages = convo.get("messages", {}).get("data", [])
                user_messages = [m for m in messages if m.get("from", {}).get("id") == participant_id]

                if user_messages:
                    user_messages.sort(key=lambda x: x.get("created_time"))
                    first_msg_time = user_messages[0].get("created_time")
                    last_msg_time = user_messages[-1].get("created_time")
                elif messages:
                    messages.sort(key=lambda x: x.get("created_time"))
                    first_msg_time = messages[0].get("created_time")
                    last_msg_time = messages[-1].get("created_time")
                else:
                    continue
                
                customer_data = build_fn(
                    participant_id=participant_id,
                    user_name=participant.get("name"),
                    first_msg_time=first_msg_time,
                    last_msg_time=last_msg_time,
                    updated_time=updated_time,
                    installed_at=installed_at,
                    page_id=page_id,
                    access_token=access_token,
                    convo_id=convo.get("id")
                )

                if customer_data:
                    customers_to_sync.append(customer_data)
                else:
                    filtered_count += 1

        sync_results = crud.bulk_create_or_update_customers(db, page.ID, customers_to_sync) if customers_to_sync else {}
        return {
            "status": "success",
            "synced": sync_results.get("created", 0) + sync_results.get("updated", 0),
            "errors": error_count + sync_results.get("errors", 0),
            "filtered": filtered_count,
            "details": sync_results
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"เกิดข้อผิดพลาด: {str(e)}"})

# API สำหรับดึงสถิติลูกค้าของเพจ
@router.get("/customer-statistics/{page_id}")
async def get_customer_statistics(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึงสถิติลูกค้าของเพจ"""
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ"}
        )
    
    # เปลี่ยนจาก page.id เป็น page.ID (uppercase)
    stats = crud.get_customer_statistics(db, page.ID)  # ✅ แก้ไขตรงนี้
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "statistics": stats,
        "generated_at": datetime.now().isoformat()
    }