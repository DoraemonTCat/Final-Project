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
from .utils import fix_isoformat

router = APIRouter()

bangkok_tz = pytz.timezone("Asia/Bangkok")


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


@router.post("/sync-customers/{page_id}")
async def sync_facebook_customers_enhanced(
    page_id: str, 
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Sync ข้อมูลลูกค้าจาก Facebook มาเก็บใน database พร้อมข้อมูลเวลาที่ถูกต้อง"""
    print(f"🔄 เริ่ม sync ข้อมูลลูกค้าสำหรับ page_id: {page_id}")
    print(f"📅 ช่วงเวลา: period={period}, start={start_date}, end={end_date}")

    # ตรวจสอบว่ามี page ใน database หรือไม่
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ กรุณาเชื่อมต่อเพจก่อน"}
        )
    
    # ดึง access token
    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    
    if not access_token:
        return JSONResponse(status_code=400, content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}"})
    
    try:
        # คำนวณช่วงเวลาที่ต้องการดึงข้อมูล
        filter_start_date = None
        filter_end_date = None
        
        if period:
            now = datetime.now(bangkok_tz)
            if period == 'today':
                filter_start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'week':
                filter_start_date = now - timedelta(days=7)
            elif period == 'month':
                filter_start_date = now - timedelta(days=30)
            elif period == '3months':
                filter_start_date = now - timedelta(days=90)
            elif period == '6months':
                filter_start_date = now - timedelta(days=180)
            elif period == 'year':
                filter_start_date = now - timedelta(days=365)
            
            filter_end_date = now
        
        elif start_date and end_date:
            filter_start_date = bangkok_tz.localize(datetime.fromisoformat(start_date))
            filter_end_date = bangkok_tz.localize(datetime.fromisoformat(end_date + 'T23:59:59'))
        
        print(f"🕒 กรองข้อมูลตั้งแต่: {filter_start_date} ถึง {filter_end_date}")
        
        # ดึง conversations จาก Facebook พร้อมข้อความ
        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(100){created_time,from,message}",
            "limit": 100
        }
        
        conversations = fb_get(endpoint, params, access_token)
        if "error" in conversations:
            logger.error(f"Error getting conversations: {conversations['error']}")
            return JSONResponse(
                status_code=500,
                content={"error": "ไม่สามารถดึง conversations ได้"}
            )
        
        sync_count = 0
        error_count = 0
        filtered_count = 0
        customers_to_sync = []
        
        # วนลูปผ่านแต่ละ conversation
        for convo in conversations.get("data", []):
            convo_id = convo.get("id")
            updated_time = convo.get("updated_time")
            participants = convo.get("participants", {}).get("data", [])
            messages = convo.get("messages", {}).get("data", [])
            
            # ตรวจสอบช่วงเวลาถ้ามีการกำหนด
            if filter_start_date and updated_time:
                try:
                    convo_time = datetime.fromisoformat(updated_time.replace('Z', '+00:00')).astimezone(bangkok_tz)
                    if convo_time < filter_start_date or convo_time > filter_end_date:
                        filtered_count += 1
                        continue
                except:
                    pass
            
            # หา user participants (ไม่ใช่ page)
            for participant in participants:
                participant_id = participant.get("id")
                if participant_id and participant_id != page_id:
                    try:
                        # หาข้อความแรกและล่าสุดของ user
                        if not messages:
                            print(f"⚠️ ไม่มี messages ใน conversation {convo_id}")
                            continue

                        # ดึงข้อความทั้งหมดของฝั่ง user
                        user_messages = [
                            msg for msg in messages 
                            if msg.get("from", {}).get("id") == participant_id
                        ]
                                    
                        # fallback: ถ้าไม่มีข้อความฝั่ง user ให้ใช้ข้อความแรกใน conversation แทน
                        sorted_messages = sorted(messages, key=lambda x: x.get("created_time", ""))
                        first_msg_time = None
                        last_msg_time = None

                        if user_messages:
                            user_messages.sort(key=lambda x: x.get("created_time") or "")
                            first_msg_time = user_messages[0].get("created_time")
                            last_msg_time = user_messages[-1].get("created_time")
                        elif messages:
                            sorted_messages = sorted(messages, key=lambda x: x.get("created_time") or "")
                            first_msg_time = sorted_messages[0].get("created_time")
                            last_msg_time = sorted_messages[-1].get("created_time")
                        else:
                            first_msg_time = last_msg_time = updated_time

                        # แปลงเวลาถ้ามี
                        first_interaction = None
                        last_interaction = None
                        
                        if first_msg_time:
                            try:
                                fixed_str = fix_isoformat(first_msg_time.replace("Z", "+00:00"))
                                first_interaction = datetime.fromisoformat(fixed_str).astimezone(bangkok_tz)
                            except Exception as e:
                                print(f"⚠️ ไม่สามารถแปลง first_msg_time: {first_msg_time} - {e}")
                                first_interaction = None

                        if last_msg_time:
                            try:
                                fixed_str = fix_isoformat(last_msg_time.replace("Z", "+00:00"))
                                last_interaction = datetime.fromisoformat(fixed_str).astimezone(bangkok_tz)
                            except Exception as e:
                                print(f"⚠️ ไม่สามารถแปลง last_msg_time: {last_msg_time} - {e}")
                                last_interaction = first_interaction

                        print(f"🕓 first_msg_time: {first_msg_time}, last_msg_time: {last_msg_time}")
                        print(f"➡️ first_interaction: {first_interaction}, last_interaction: {last_interaction}")
                        
                        # ถ้าไม่มีข้อความของ user ใช้เวลาของ conversation
                        if not first_interaction:
                            try:
                                first_interaction = datetime.fromisoformat(updated_time.replace('Z', '+00:00')).astimezone(bangkok_tz)
                            except Exception as e:
                                print(f"⚠️ ไม่สามารถแปลง updated_time: {updated_time} - {e}")
                                first_interaction = None

                        if not last_interaction:
                            last_interaction = first_interaction

                        # ดึงข้อมูล user
                        user_name = participant.get("name")
                        
                        if not user_name:
                            user_info = get_user_info_from_psid(participant_id, access_token)
                            user_name = user_info.get("name")
                        
                        if not user_name or user_name.startswith("User"):
                            message_name = get_name_from_messages(convo_id, access_token, page_id)
                            if message_name:
                                user_name = message_name
                        
                        if not user_name:
                            user_name = f"User...{participant_id[-8:]}"
                        
                        # เตรียมข้อมูลสำหรับ sync
                        customer_data = {
                            'customer_psid': participant_id,
                            'name': user_name,
                            'first_interaction_at': first_interaction,
                            'last_interaction_at': last_interaction,
                        }
                        
                        customers_to_sync.append(customer_data)
                        
                    except Exception as e:
                        print(f"❌ Error processing customer {participant_id}: {e}")
                        error_count += 1
                    
        # คำนวณ source_type
        installed_at = page.created_at
        if installed_at is None:
            installed_at = datetime.now(bangkok_tz)
        elif installed_at.tzinfo is None:
            installed_at = bangkok_tz.localize(installed_at)
        else:
            installed_at = installed_at.astimezone(bangkok_tz)

        for customer_data in customers_to_sync:
            first = customer_data.get("first_interaction_at")
    
            if isinstance(first, str):
                first = datetime.fromisoformat(first.replace("Z", "+00:00")).astimezone(bangkok_tz)
    
            if not first:
                first = datetime.now(bangkok_tz)
            elif first.tzinfo is None:
                first = bangkok_tz.localize(first)
            else:
                first = first.astimezone(bangkok_tz)
                
            # กำหนด source_type: 'new' ถ้า first_interaction >= installed_at, 'imported' ถ้าก่อนหน้านั้น
            source_type = "new" if first >= installed_at else "imported"
            customer_data["first_interaction_at"] = first
            customer_data["source_type"] = source_type
        
        # Bulk sync ข้อมูลลง database
        sync_results = {"created": 0, "updated": 0, "errors": 0}

        if customers_to_sync:
            sync_results = crud.bulk_create_or_update_customers(db, page.ID, customers_to_sync)
            sync_count = sync_results["created"] + sync_results["updated"]
            error_count += sync_results["errors"]

            print(f"✅ Sync เสร็จสิ้น: สร้างใหม่ {sync_results['created']} คน, อัพเดท {sync_results['updated']} คน")
        else:
            sync_count = 0
        
        return {
            "status": "success",
            "synced": sync_count,
            "errors": error_count,
            "filtered": filtered_count,
            "message": f"Sync ข้อมูลลูกค้าสำเร็จ {sync_count} คน" + 
                      (f" (กรองออก {filtered_count} conversations)" if filtered_count > 0 else ""),
            "details": {
                "created": sync_results.get("created", 0),
                "updated": sync_results.get("updated", 0)
            }
        }
        
    except Exception as e:
        print(f"❌ Error during sync: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"เกิดข้อผิดพลาดในการ sync: {str(e)}"}
        )


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
    
    stats = crud.get_customer_statistics(db, page.ID)
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "statistics": stats,
        "generated_at": datetime.now().isoformat()
    }