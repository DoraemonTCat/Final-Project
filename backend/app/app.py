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

# โหลด .env ไฟล์
load_dotenv()

app = FastAPI()

image_dir = os.getenv("IMAGE_DIR")
if not image_dir:
    raise RuntimeError("IMAGE_DIR is not set in .env")
vid_dir = os.getenv("VID_DIR")
if not vid_dir:
    raise RuntimeError("VID_DIR is not set in .env")

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
    return {"message": "Facebook Bot API with FastAPI is running."}

# สำหรับรันแอป
if __name__ == "__main__":
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)