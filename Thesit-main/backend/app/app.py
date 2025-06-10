from fastapi import FastAPI
from dotenv import load_dotenv
from app.routes import pages, webhook, facebook, custom_messages
from fastapi.middleware.cors import CORSMiddleware
from app.database import crud, database, models, schemas
from app.database.database import SessionLocal, engine, Base
from app import config
import uvicorn
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.gzip import GZipMiddleware

# โหลด .env ไฟล์
load_dotenv()

app = FastAPI()

# เพิ่ม GZip middleware สำหรับ compress response
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Setup directories
image_dir = os.getenv("IMAGE_DIR", "./uploads/images")
vid_dir = os.getenv("VID_DIR", "./uploads/videos")
upload_dir = os.getenv("UPLOAD_DIR", "./uploads")

# สร้าง directories ถ้ายังไม่มี
os.makedirs(image_dir, exist_ok=True)
os.makedirs(vid_dir, exist_ok=True)
os.makedirs(upload_dir, exist_ok=True)

# Mount static files
app.mount("/images", StaticFiles(directory=image_dir), name="images")
app.mount("/videos", StaticFiles(directory=vid_dir), name="videos")
app.mount("/media", StaticFiles(directory=upload_dir), name="media")

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
    return {"message": "Facebook Bot API with FastAPI is running."}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Facebook Bot API",
        "version": "1.0.0"
    }

# สำหรับรันแอป
if __name__ == "__main__":
    uvicorn.run("app.app:app", host="0.0.0.0", port=8000, reload=True)