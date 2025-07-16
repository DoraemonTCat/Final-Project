from app.routes.facebook import sync_facebook_customers_enhanced
from app.database.database import SessionLocal

def run_sync_customer_background(page_id: str):
    db = SessionLocal()
    try:
        import asyncio
        asyncio.run(sync_facebook_customers_enhanced(page_id, db=db))
    except Exception as e:
        print(f"❌ Background sync failed: {e}")
    finally:
        db.close()