from fastapi import APIRouter, Query, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from app.database import crud
from app.database.database import get_db
from .customers import sync_facebook_customers_enhanced
from .auth import get_page_tokens
from .conversations import get_user_info_from_psid, get_name_from_messages
from .utils import fix_isoformat, build_historical_customer_data
import pytz

router = APIRouter()

bangkok_tz = pytz.timezone("Asia/Bangkok")

@router.get("/sync/facebook/imported_customers/{page_id}")
async def sync_imported_customers_by_years(
    page_id: str,
    years: int = Query(..., ge=1, le=10, description="จำนวนปีที่ต้องการดึงข้อมูลย้อนหลัง"),
    compare_to: str = Query("installed_at", regex="^(now|installed_at)$", description="เลือกจุดเปรียบเทียบ: now หรือ installed_at"),
    db: Session = Depends(get_db)
):

    print(f"🔁 เริ่ม sync ข้อมูลย้อนหลัง {years} ปี สำหรับ page_id: {page_id}")

    # ตรวจสอบเพจ
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=400,
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ กรุณาเชื่อมต่อเพจก่อน"}
        )

    # เตรียม installed_at เป็น timezone-aware
    now = datetime.now(bangkok_tz)
    compare_point = now if compare_to == "now" else page.created_at or now

    if compare_point.tzinfo is None:
        compare_point = bangkok_tz.localize(compare_point)
    else:
        compare_point = compare_point.astimezone(bangkok_tz)

    # คำนวณช่วงเวลาย้อนหลัง
    start_time = compare_point - timedelta(days=365 * years)
    end_time = compare_point - timedelta(seconds=1)

    # 🧼 ป้องกันกรณีที่ start_time > end_time
    if start_time > end_time:
        return JSONResponse(
            status_code=400,
            content={"error": "ช่วงเวลาที่เลือกไม่มีข้อมูลย้อนหลัง (start_time มากกว่า installed_at)"}
        )

    print(f"🕒 ดึงข้อมูลระหว่าง {start_time} ถึง {end_time} (เทียบกับ {compare_point})")

    # ดึง access token
    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    if not access_token:
        return JSONResponse(status_code=400, content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}"})

    try:
        start_time_naive = start_time.replace(tzinfo=None)
        end_time_naive = end_time.replace(tzinfo=None)

        # 🔧 เรียกฟังก์ชันหลัก พร้อมส่ง builder ฟังก์ชันใหม่
        return await sync_facebook_customers_enhanced(
            page_id=page_id,
            start_date=start_time_naive.isoformat(),
            end_date=end_time_naive.isoformat(),
            period=None,
            db=db,
            build_fn=build_historical_customer_data
        )


    except Exception as e:
        print(f"❌ Error in imported sync: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"เกิดข้อผิดพลาด: {str(e)}"}
        )