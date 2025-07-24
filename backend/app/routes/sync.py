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

@router.post("/force-sync/{page_id}")
async def force_sync(page_id: str, db: Session = Depends(get_db)):
    """Force sync ข้อมูลทันที"""
    try:
        # ดึง access token
        from app.routes.facebook.auth import get_page_tokens
        page_tokens = get_page_tokens()
        access_token = page_tokens.get(page_id)
        
        if not access_token:
            return {"status": "error", "message": "No access token found"}
            
        # เรียก sync โดยตรง
        await auto_sync_service.sync_page_conversations(page_id, access_token)
        
        return {"status": "success", "message": "Force sync completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}