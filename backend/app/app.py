# backend/app/app.py
from fastapi import FastAPI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import asyncio
import threading
import logging
import uvicorn

# Import routes - ใช้ relative imports
from app.routes import pages, webhook, custom_messages, fb_customer, sync, group_messages
from app.routes import facebook  # ถ้ายังใช้ facebook.py เดิม

# หรือถ้าใช้ refactored version
# from app.routes.facebook import router as facebook_router

# Import database
from app.database import crud, database, models, schemas
from app.database.database import SessionLocal, engine, Base

# Import services
from app.service.message_scheduler import message_scheduler
from app.service.auto_sync_service import auto_sync_service

# Import task
from app.task.scheduler import start_scheduler

# Import config
from app import config

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# โหลด .env ไฟล์
load_dotenv()

app = FastAPI()

# Setup directories
image_dir = os.getenv("IMAGE_DIR")
if not image_dir:
    raise RuntimeError("IMAGE_DIR is not set in .env")
vid_dir = os.getenv("VID_DIR")
if not vid_dir:
    raise RuntimeError("VID_DIR is not set in .env")

# Mount static files
app.mount("/images", StaticFiles(directory=image_dir), name="images")
app.mount("/videos", StaticFiles(directory=vid_dir), name="videos")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/robots.txt")
def robots():
    return FileResponse("static/robots.txt", media_type="text/plain")

# สร้างตารางในฐานข้อมูล
Base.metadata.create_all(bind=engine)

# เพิ่ม CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# รวม router จากแต่ละโมดูล
app.include_router(pages.router)
app.include_router(webhook.router)
app.include_router(facebook.router)  # ถ้ายังใช้ facebook.py เดิม
# app.include_router(facebook_router)  # ถ้าใช้ refactored version
app.include_router(custom_messages.router)
app.include_router(fb_customer.router)
app.include_router(sync.router)
app.include_router(group_messages.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Facebook Bot API with FastAPI is running."}

# ฟังก์ชันสำหรับ run scheduler
def run_scheduler():
    """รัน scheduler ใน thread แยก"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        logging.info("Starting message scheduler...")
        loop.run_until_complete(message_scheduler.start_schedule_monitoring())
    except Exception as e:
        logging.error(f"Scheduler error: {e}")
    finally:
        loop.close()

# ฟังก์ชันสำหรับ run auto sync
def run_auto_sync():
    """รัน auto sync ใน thread แยก"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        logging.info("Starting auto sync service...")
        loop.run_until_complete(auto_sync_service.start_auto_sync())
    except Exception as e:
        logging.error(f"Auto sync error: {e}")
    finally:
        loop.close()

# Event handlers
@app.on_event("startup")
async def startup_event():
    """เริ่มต้นเมื่อ app เริ่มทำงาน"""
    logging.info("Starting FastAPI application...")
    
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logging.info("Message scheduler thread started")
    
    # Start auto sync service
    auto_sync_thread = threading.Thread(target=run_auto_sync, daemon=True)
    auto_sync_thread.start()
    logging.info("Auto sync thread started - จะดึงข้อมูลจาก Facebook ทุก 10 วินาที")
    
    # Start task scheduler
    start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    """ปิดเมื่อ app หยุดทำงาน"""
    logging.info("Shutting down...")
    message_scheduler.stop()
    auto_sync_service.stop()

# สำหรับรันแอป
if __name__ == "__main__":
    uvicorn.run("app.app:app", host="0.0.0.0", port=8000, reload=True)