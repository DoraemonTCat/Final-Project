# backend/app/task/bg_task.py
from app.database.database import SessionLocal
import asyncio

def run_sync_customer_background(page_id: str):
    """รัน sync ใน background"""
    db = SessionLocal()
    try:
        # Import แบบ lazy loading เพื่อหลีกเลี่ง circular import
        from app.routes.facebook.customers import sync_facebook_customers_enhanced
        
        # สร้าง async loop สำหรับรันฟังก์ชัน async
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # รันฟังก์ชัน async
        result = loop.run_until_complete(
            sync_facebook_customers_enhanced(page_id, db=db)
        )
        
        print(f"✅ Background sync completed: {result}")
        
    except Exception as e:
        print(f"❌ Background sync failed: {e}")
    finally:
        db.close()
        if loop:
            loop.close()