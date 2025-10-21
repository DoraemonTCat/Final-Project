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
from app.utils.redis_helper import get_page_token
import pytz

router = APIRouter()

bangkok_tz = pytz.timezone("Asia/Bangkok")

# API สำหรับดึงข้อมูลลูกค้าที่ถูกนำเข้ามาจาก Facebook
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
    access_token = None
    try:
        # ถ้ามีฟังก์ชัน get_page_tokens มาจาก .auth (map ของ tokens)
        page_tokens = None
        try:
            page_tokens = get_page_tokens()
            print(f"🔍 get_page_tokens returned type={type(page_tokens)}")
        except Exception as e:
            print(f"⚠️ get_page_tokens() raised: {e}")
            page_tokens = None

        # ถ้าได้ dict ให้พยายามหา (เช็กทั้ง str/int keys)
        if isinstance(page_tokens, dict):
            access_token = page_tokens.get(page_id)
            if access_token is None:
                # ลองเช็ก key อื่นๆ เช่น int key
                try:
                    access_token = page_tokens.get(int(page_id))
                except Exception:
                    pass

            print(f"🔑 access_token from get_page_tokens(): {bool(access_token)}")

        # ถ้าไม่มี token ให้ fallback ไปเรียก redis helper
        if not access_token:
            try:
                access_token = get_page_token(page_id)
                print(f"🔁 fallback get_page_token({page_id}) -> {bool(access_token)}")
            except Exception as e:
                print(f"⚠️ get_page_token() error: {e}")

    except Exception as e:
        print(f"❌ Error while fetching page token: {e}")
        access_token = None