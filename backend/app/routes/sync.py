# backend/app/routes/sync.py
from fastapi import APIRouter, BackgroundTasks, Depends
from app.database.database import get_db
from app.celery_task.customers import sync_customers_task
from app.celery_task.messages import sync_customer_messages_task
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str):
    task = sync_customers_task.delay(page_id)
    return {"message": f"Triggered Celery sync for page_id={page_id}", "task_id": task.id}

@router.get("/trigger-messages-sync/{page_id}")
def trigger_messages_sync(page_id: str):
    """Trigger Celery message sync"""
    task = sync_customer_messages_task.delay(page_id)
    return {
        "message": f"✅ Triggered Celery message sync for page_id: {page_id}",
        "task_id": task.id
    }