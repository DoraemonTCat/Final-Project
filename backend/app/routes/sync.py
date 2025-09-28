# backend/app/routes/sync.py
from fastapi import APIRouter, BackgroundTasks, Depends
from app.task.bg_task import run_sync_customer_background, run_sync_customer_messages_background
from app.database.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str, background_tasks: BackgroundTasks):
    """Trigger background customer sync"""
    background_tasks.add_task(run_sync_customer_background, page_id)
    return {"message": f"✅ Triggered background sync for page_id: {page_id}"}

@router.get("/trigger-messages-sync/{page_id}")
def trigger_messages_sync(page_id: str, background_tasks: BackgroundTasks):
    """Trigger background message sync"""
    background_tasks.add_task(run_sync_customer_messages_background, page_id)
    return {"message": f"✅ Triggered background message sync for page_id: {page_id}"}