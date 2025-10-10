"""
Facebook Admin Component
จัดการ:
- ดึงข้อมูล Admin/Owner ของ Page
- Cache ข้อมูล Admin
- เชื่อมกับ Celery tasks
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Optional
import logging

from app.database.database import get_db
from app.service.facebook_api import fb_get
from app.utils.redis_helper import get_page_token

router = APIRouter()
logger = logging.getLogger(__name__)

# Cache สำหรับเก็บข้อมูล admin (shared with Celery)
admin_cache: Dict[str, Dict] = {}


@router.get("/admin/{page_id}")
async def get_page_admin(
    page_id: str,
    force_refresh: bool = False,
    db: Session = Depends(get_db)
):
    """
    ดึงข้อมูล Admin ของ Page
    - ถ้ามี cache จะใช้ cache
    - ถ้า force_refresh=true จะดึงใหม่
    """
    try:
        # ตรวจสอบ cache ก่อน (ถ้าไม่ force refresh)
        if not force_refresh and page_id in admin_cache:
            logger.info(f"✅ Returning cached admin data for page {page_id}")
            return admin_cache[page_id]
        
        # ดึง access token
        access_token = get_page_token(page_id)
        
        if not access_token:
            return JSONResponse(
                status_code=400,
                content={"error": f"ไม่พบ access token สำหรับ page {page_id}"}
            )
        
        # ดึงข้อมูลแบบ sync
        admin_data = fetch_admin_data_sync(page_id, access_token)
        
        # เก็บใน cache
        admin_cache[page_id] = admin_data
        
        return admin_data
        
    except Exception as e:
        logger.error(f"❌ Error getting page admin: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.post("/admin/{page_id}/refresh")
async def refresh_page_admin(
    page_id: str,
    background_tasks: BackgroundTasks,
    use_celery: bool = True,
    db: Session = Depends(get_db)
):
    """
    รีเฟรชข้อมูล Admin ของ Page
    - use_celery=true: รันใน background ด้วย Celery (แนะนำ)
    - use_celery=false: รันทันที
    """
    try:
        if use_celery:
            # ใช้ Celery task (แนะนำ)
            from app.celery_task.pages_admin import fetch_page_admin_task
            
            task = fetch_page_admin_task.apply_async(args=[page_id])
            
            return {
                "status": "queued",
                "message": f"Admin refresh queued for page {page_id}",
                "task_id": task.id,
                "page_id": page_id
            }
        else:
            # รันทันที (ใช้สำหรับ testing)
            access_token = get_page_token(page_id)
            
            if not access_token:
                return JSONResponse(
                    status_code=400,
                    content={"error": f"ไม่พบ access token สำหรับ page {page_id}"}
                )
            
            admin_data = fetch_admin_data_sync(page_id, access_token)
            admin_cache[page_id] = admin_data
            
            return {
                "status": "success",
                "data": admin_data
            }
        
    except Exception as e:
        logger.error(f"❌ Error refreshing admin: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.post("/admin/refresh-all")
async def refresh_all_admins(use_celery: bool = True):
    """
    รีเฟรชข้อมูล Admin ของทุกเพจ
    """
    try:
        if use_celery:
            from app.celery_task.pages_admin import refresh_all_page_admins_task
            
            task = refresh_all_page_admins_task.apply_async()
            
            return {
                "status": "queued",
                "message": "Admin refresh queued for all pages",
                "task_id": task.id
            }
        else:
            # รันทันที (ไม่แนะนำสำหรับเพจเยอะ)
            from app.database import models
            from app.database.database import SessionLocal
            
            db = SessionLocal()
            try:
                pages = db.query(models.FacebookPage).all()
                refreshed = []
                
                for page in pages:
                    access_token = get_page_token(page.page_id)
                    if access_token:
                        admin_data = fetch_admin_data_sync(page.page_id, access_token)
                        admin_cache[page.page_id] = admin_data
                        refreshed.append(page.page_id)
                
                return {
                    "status": "success",
                    "refreshed_count": len(refreshed),
                    "page_ids": refreshed
                }
            finally:
                db.close()
        
    except Exception as e:
        logger.error(f"❌ Error refreshing all admins: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.post("/admin/clear-cache")
async def clear_admin_cache(use_celery: bool = False):
    """
    Clear admin cache
    """
    try:
        if use_celery:
            from app.celery_task.pages_admin import clear_admin_cache_task
            
            task = clear_admin_cache_task.apply_async()
            
            return {
                "status": "queued",
                "message": "Cache clear queued",
                "task_id": task.id
            }
        else:
            global admin_cache
            cache_size = len(admin_cache)
            admin_cache = {}
            
            return {
                "status": "success",
                "message": "Admin cache cleared",
                "cleared_entries": cache_size
            }
        
    except Exception as e:
        logger.error(f"❌ Error clearing cache: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.get("/admin/{page_id}/permissions")
async def verify_admin_permissions(
    page_id: str,
    use_celery: bool = False
):
    """
    ตรวจสอบสิทธิ์ของ admin
    """
    try:
        if use_celery:
            from app.celery_task.pages_admin import verify_page_admin_permissions_task
            
            task = verify_page_admin_permissions_task.apply_async(args=[page_id])
            
            return {
                "status": "queued",
                "message": f"Permission check queued for page {page_id}",
                "task_id": task.id
            }
        else:
            access_token = get_page_token(page_id)
            
            if not access_token:
                return JSONResponse(
                    status_code=400,
                    content={"error": f"ไม่พบ access token สำหรับ page {page_id}"}
                )
            
            # ตรวจสอบ permissions
            endpoint = f"{page_id}"
            params = {
                "fields": "access_token,tasks,perms"
            }
            
            result = fb_get(endpoint, params, access_token)
            
            if "error" in result:
                return JSONResponse(
                    status_code=400,
                    content={"error": result["error"]}
                )
            
            return {
                "status": "success",
                "page_id": page_id,
                "tasks": result.get("tasks", []),
                "perms": result.get("perms", []),
                "has_messaging": "MODERATE" in result.get("tasks", [])
            }
        
    except Exception as e:
        logger.error(f"❌ Error verifying permissions: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


# ==================== Helper Functions ====================

def fetch_admin_data_sync(page_id: str, access_token: str) -> Dict:
    """
    ดึงข้อมูล Admin แบบ sync (ใช้ใน route และ Celery)
    """
    try:
        # ดึงข้อมูล Page roles
        endpoint = f"{page_id}/roles"
        params = {
            "fields": "id,name,role,picture{url}",
            "limit": 100
        }
        
        result = fb_get(endpoint, params, access_token)
        
        if "error" in result:
            logger.warning(f"⚠️ Error getting page roles, using fallback: {result['error']}")
            return get_page_owner_info_sync(page_id, access_token)
        
        # หา Admin หลัก
        admins = []
        for role_data in result.get("data", []):
            if role_data.get("role") in ["ADMIN", "MANAGER"]:
                admin_info = {
                    "id": role_data.get("id"),
                    "name": role_data.get("name", "Admin"),
                    "role": role_data.get("role"),
                    "picture": role_data.get("picture", {}).get("data", {}).get("url")
                }
                admins.append(admin_info)
        
        if not admins:
            return get_page_owner_info_sync(page_id, access_token)
        
        primary_admin = admins[0]
        
        # ดึงข้อมูลเพิ่มเติมถ้าจำเป็น
        if not primary_admin.get("name") or primary_admin["name"] == "Admin":
            user_info = fb_get(
                primary_admin["id"],
                {"fields": "name,first_name,last_name,picture"},
                access_token
            )
            
            if not user_info.get("error"):
                primary_admin["name"] = user_info.get("name", "Admin")
                primary_admin["first_name"] = user_info.get("first_name")
                primary_admin["last_name"] = user_info.get("last_name")
                if user_info.get("picture"):
                    primary_admin["picture"] = user_info["picture"]["data"]["url"]
        
        return {
            "primary_admin": primary_admin,
            "all_admins": admins,
            "page_id": page_id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching admin data: {e}")
        raise


def get_page_owner_info_sync(page_id: str, access_token: str) -> Dict:
    """
    Fallback: ดึงข้อมูล page owner
    """
    try:
        logger.info(f"🔄 Using fallback for page {page_id}")
        
        page_info = fb_get(
            page_id,
            {"fields": "name,access_token,category,fan_count"},
            access_token
        )
        
        me_info = fb_get(
            "me",
            {"fields": "id,name,picture"},
            access_token
        )
        
        if not me_info.get("error"):
            admin_info = {
                "id": me_info.get("id"),
                "name": me_info.get("name", "Page Admin"),
                "role": "ADMIN",
                "picture": me_info.get("picture", {}).get("data", {}).get("url")
            }
            
            return {
                "primary_admin": admin_info,
                "all_admins": [admin_info],
                "page_id": page_id,
                "page_name": page_info.get("name"),
                "status": "success"
            }
        
        # Default fallback
        default_admin = {
            "id": "unknown",
            "name": "Page Admin",
            "role": "ADMIN",
            "picture": None
        }
        
        return {
            "primary_admin": default_admin,
            "all_admins": [default_admin],
            "page_id": page_id,
            "status": "fallback"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in fallback: {e}")
        return {
            "primary_admin": {
                "id": "unknown",
                "name": "Page Admin",
                "role": "ADMIN",
                "picture": None
            },
            "all_admins": [],
            "page_id": page_id,
            "status": "error",
            "error": str(e)
        }