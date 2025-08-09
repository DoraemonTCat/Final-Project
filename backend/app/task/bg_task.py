from app.database.database import SessionLocal
import asyncio

# API สำหรับรัน background task เพื่อ sync ข้อมูลลูกค้า
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

def run_sync_customer_messages_background(page_id: str):
    db = SessionLocal()
    loop = None
    try:
        from app.routes.facebook.psids_sync import sync_messages_for_page

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            result = loop.run_until_complete(sync_messages_for_page(page_id, db=db))
        else:
            result = asyncio.run(sync_messages_for_page(page_id, db=db))

        print(f"✅ Background sync completed: {result}")

    except Exception as e:
        print(f"❌ Background sync failed: {e}")
    finally:
        db.close()