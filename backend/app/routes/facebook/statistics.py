"""
API นี้คือ จุดศูนย์กลาง สำหรับ frontend/dashboard ในการขอดูสถิติของลูกค้า เช่น

- จำนวนลูกค้าทั้งหมด
- จำนวนลูกค้าใหม่วันนี้
- จำนวนลูกค้าที่ inactive
- การแบ่งกลุ่มลูกค้าตาม type/knowledge

"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import crud
from app.database.database import get_db
from datetime import datetime
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/customer-statistics/{page_id}")
async def get_customer_statistics(page_id: str, db: Session = Depends(get_db)):
    """ดึงสถิติลูกค้าของเพจ"""
    # ดึง page จาก page_id string
    page = crud.get_page_by_page_id(db, page_id)
    if not page:
        return JSONResponse(
            status_code=404,
            content={"error": f"ไม่พบเพจ {page_id} ในระบบ"}
        )
    
    # ใช้ page.ID (uppercase) เมื่อเรียก function
    stats = crud.get_customer_statistics(db, page.ID)
    
    return {
        "page_id": page_id,
        "page_name": page.page_name,
        "statistics": stats,
        "generated_at": datetime.now().isoformat()
    }