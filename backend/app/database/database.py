# backend/app/database/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# เพิ่ม pool settings
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # ตรวจสอบ connection ก่อนใช้
    pool_recycle=3600,   # recycle connection ทุก 1 ชั่วโมง
    echo_pool=True       # debug pool connections
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()