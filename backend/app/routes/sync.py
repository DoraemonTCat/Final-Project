from fastapi import APIRouter, BackgroundTasks, Depends
from app.task.bg_task import run_sync_customer_background
from app.database.database import get_db
from sqlalchemy.orm import Session
from app.service.auto_sync_service import auto_sync_service

router = APIRouter()

@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_background, page_id)
    return {"message": f"✅ Triggered background sync for page_id: {page_id}"}

