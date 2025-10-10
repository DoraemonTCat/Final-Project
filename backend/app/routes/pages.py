# backend/app/routes/pages.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import schemas, crud
from app.database.database import get_db
from app.celery_task.page_tasks import (
    create_page_task,
    update_page_task,
    delete_page_task
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Helper Function ===============
def format_page_response(page) -> Dict[str, Any]:
    """จัดรูปแบบข้อมูลเพจให้อยู่ในรูปแบบที่ frontend ใช้ได้"""
    return {
        "ID": page.ID,
        "id": page.page_id,
        "page_id": page.page_id,
        "name": page.page_name,
        "page_name": page.page_name,
        "created_at": page.created_at.isoformat() if page.created_at else None
    }

# =============== API Endpoints ===============

@router.post("/pages/")
def create_page(page: schemas.FacebookPageCreate):
    """
    ✅ สร้างเพจใหม่ — ให้ Celery ทำงานเบื้องหลัง
    """
    task = create_page_task.delay(page.dict())
    return {
        "message": "📤 งานถูกส่งให้ Celery แล้ว",
        "task_id": task.id,
        "status": "queued"
    }


@router.get("/pages/")
def read_pages(db: Session = Depends(get_db)):
    """
    📄 ดึงข้อมูลเพจทั้งหมด (อ่านตรงจาก DB)
    """
    pages = crud.get_pages(db)
    return {"pages": [format_page_response(page) for page in pages]}


@router.get("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def read_page(page_id: str, db: Session = Depends(get_db)):
    """
    🔍 ดึงข้อมูลเพจเดี่ยวตาม page_id
    """
    page = crud.get_page(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.put("/pages/{page_id}")
def update_page(page_id: str, page: dict):
    """
    ♻️ อัปเดตข้อมูลเพจ — ให้ Celery ทำงานเบื้องหลัง
    """
    task = update_page_task.delay(page_id, page)
    return {
        "message": f"📤 งานอัปเดตเพจ {page_id} ถูกส่งให้ Celery แล้ว",
        "task_id": task.id,
        "status": "queued"
    }


@router.delete("/pages/{page_id}")
def delete_page(page_id: str):
    """
    🗑️ ลบเพจ — ให้ Celery ทำงานเบื้องหลัง
    """
    task = delete_page_task.delay(page_id)
    return {
        "message": f"📤 งานลบเพจ {page_id} ถูกส่งให้ Celery แล้ว",
        "task_id": task.id,
        "status": "queued"
    }
