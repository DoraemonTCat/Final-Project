from app.routes.facebook.customers import sync_facebook_customers_enhanced
from app.database.database import SessionLocal
from app.celery_worker import celery_app
from app.database import crud
from app.utils.redis_helper import get_page_token
from fastapi.responses import JSONResponse
import asyncio

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_customers_task(self, page_id: str):
    """
    Celery task สำหรับ sync ลูกค้า (โหลด access_token จาก Redis)
    """
    print(f"🚀 [Task Start] Sync customers for page_id={page_id}")
    db = SessionLocal()
    
    try:
        # Step 1: ตรวจสอบ token จาก Redis
        print(f"🔍 Step 1: Fetching token from Redis for page_id={page_id}")
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")

        # Step 2: เรียก async sync function
        print(f"🔍 Step 2: Running async sync for page_id={page_id}")
        result = asyncio.run(sync_facebook_customers_enhanced(page_id, db=db, access_token=access_token))

        # Step 3: ป้องกัน Celery encode error
        if isinstance(result, JSONResponse):
            result = {
                "status_code": result.status_code,
                "body": result.body.decode("utf-8")
            }
            
        db.commit()
        print(f"✅ Step 2 & 3 Success: Sync completed for page_id={page_id}")
        return result

    except Exception as e:
        print(f"❌ [Task Error] Exception for page_id={page_id}: {e}")
        raise
    finally:
        db.close()
        print(f"🛑 [Task End] DB session closed for page_id={page_id}")