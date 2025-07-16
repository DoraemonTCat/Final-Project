from fastapi import APIRouter, BackgroundTasks
from app.task.bg_task import run_sync_customer_background

router = APIRouter()

@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_background, page_id)
    return {"message": f"✅ Triggered background sync for page_id: {page_id}"}