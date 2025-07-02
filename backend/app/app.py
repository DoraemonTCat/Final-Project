from fastapi import FastAPI
from dotenv import load_dotenv
from app.routes import pages, webhook, facebook, custom_messages
from fastapi.middleware.cors import CORSMiddleware
from app.database import crud, database, models, schemas
from app.database.database import SessionLocal, engine, Base
from app import config
import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import asyncio
import threading
from app.service.message_scheduler import message_scheduler
from app.service.websocket_service import socket_app, sio
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# โหลด .env ไฟล์
load_dotenv()

app = FastAPI()

image_dir = os.getenv("IMAGE_DIR")
if not image_dir:
    raise RuntimeError("IMAGE_DIR is not set in .env")
vid_dir = os.getenv("VID_DIR")
if not vid_dir:
    raise RuntimeError("VID_DIR is not set in .env")

# Mount WebSocket app first
app.mount("/ws", socket_app)

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
app.include_router(facebook.router)
app.include_router(custom_messages.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Facebook Bot API with FastAPI and WebSocket is running."}

# เพิ่มฟังก์ชันสำหรับ run scheduler
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

# Event handlers
@app.on_event("startup")
async def startup_event():
    """เริ่มต้นเมื่อ app เริ่มทำงาน"""
    logging.info("Starting FastAPI application...")
    
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logging.info("Message scheduler thread started")
    
    # Log WebSocket status
    logging.info("WebSocket server is ready at /ws/socket.io/")

@app.on_event("shutdown")
async def shutdown_event():
    """ปิดเมื่อ app หยุดทำงาน"""
    logging.info("Shutting down...")
    message_scheduler.stop()

# สำหรับรันแอป
if __name__ == "__main__":
    uvicorn.run("app.app:app", host="0.0.0.0", port=8000, reload=True)