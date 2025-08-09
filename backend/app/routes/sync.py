from fastapi import APIRouter, BackgroundTasks, Depends
from app.task.bg_task import run_sync_customer_background, run_sync_customer_messages_background
from app.database.database import get_db
from sqlalchemy.orm import Session
from app.service.auto_sync_service import auto_sync_service

router = APIRouter()

# API สำหรับเริ่มต้นการ sync ข้อมูลลูกค้า
@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_background, page_id)
    return {"message": f"✅ Triggered background sync for page_id: {page_id}"}

# API สำหรับเริ่มต้นการ sync ข้อความลูกค้า
@router.get("/trigger-messages-sync/{page_id}")
def trigger_messages_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_messages_background, page_id)
    return {"message": f"✅ Triggered background message sync for page_id: {page_id}"}