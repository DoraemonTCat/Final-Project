from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.service.facebook_api import fb_get
from app.utils.redis_helper import get_page_token
from celery.exceptions import SoftTimeLimitExceeded
import logging

logger = logging.getLogger(__name__)

# Cache สำหรับเก็บข้อมูล admin
admin_cache = {}


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def fetch_page_admin_task(self, page_id: str):
    """
    Celery task สำหรับดึงข้อมูล Admin ของ Page
    """
    db = SessionLocal()
    try:
        logger.info(f"🔍 [Celery] Fetching admin data for page_id={page_id}")
        
        # ดึง access token จาก Redis
        access_token = get_page_token(page_id)
        
        if not access_token:
            logger.error(f"❌ No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        # ดึงข้อมูล Page roles (admins, editors, etc.)
        endpoint = f"{page_id}/roles"
        params = {
            "fields": "id,name,role,picture{url}",
            "limit": 100
        }
        
        result = fb_get(endpoint, params, access_token)
        
        if "error" in result:
            logger.warning(f"⚠️ Error getting page roles, trying fallback: {result['error']}")
            # Fallback: ดึงข้อมูล page owner
            return fetch_page_owner_fallback(page_id, access_token)
        
        # หา Admin หลัก (role = "ADMIN" หรือ "MANAGER")
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
            logger.warning(f"⚠️ No admin found, using fallback for page_id={page_id}")
            return fetch_page_owner_fallback(page_id, access_token)
        
        # ใช้ admin คนแรกเป็นหลัก
        primary_admin = admins[0]
        
        # ถ้าไม่มีชื่อ ลองดึงข้อมูลเพิ่มเติม
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
        
        admin_data = {
            "primary_admin": primary_admin,
            "all_admins": admins,
            "page_id": page_id,
            "status": "success"
        }
        
        # เก็บใน cache (ใช้ Redis ในอนาคต)
        admin_cache[page_id] = admin_data
        
        logger.info(f"✅ Successfully fetched admin data for page_id={page_id}")
        return admin_data
        
    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Timeout fetching admin for page_id={page_id}")
        return {"status": "timeout", "page_id": page_id}
    except Exception as e:
        logger.error(f"❌ Error fetching admin for page_id={page_id}: {e}")
        raise
    finally:
        db.close()


def fetch_page_owner_fallback(page_id: str, access_token: str):
    """
    Fallback: ดึงข้อมูล page owner จาก page info
    """
    try:
        logger.info(f"🔄 Using fallback method for page_id={page_id}")
        
        # ดึงข้อมูล Page
        page_info = fb_get(
            page_id,
            {"fields": "name,access_token,category,fan_count"},
            access_token
        )
        
        # ดึงข้อมูล me (user ที่ authorize app)
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
            
            admin_data = {
                "primary_admin": admin_info,
                "all_admins": [admin_info],
                "page_id": page_id,
                "page_name": page_info.get("name"),
                "status": "success"
            }
            
            admin_cache[page_id] = admin_data
            return admin_data
        
        # ถ้าดึงไม่ได้เลย ใช้ default
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
        logger.error(f"❌ Error in fallback admin info: {e}")
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


@celery_app.task(bind=True)
def refresh_all_page_admins_task(self):
    """
    Task หลัก: รีเฟรชข้อมูล admin ของทุกเพจ
    """
    from app.database import models
    
    db = SessionLocal()
    try:
        pages = db.query(models.FacebookPage).all()
        logger.info(f"🔄 Refreshing admin data for {len(pages)} pages")
        
        # รันแบบ parallel (fan-out)
        subtasks = []
        for page in pages:
            task = fetch_page_admin_task.apply_async(
                args=[page.page_id],
                soft_time_limit=60,
                time_limit=90
            )
            subtasks.append(task.id)
        
        logger.info(f"✅ Scheduled {len(subtasks)} admin refresh tasks")
        return {
            "status": "scheduled",
            "page_count": len(pages),
            "task_ids": subtasks
        }
        
    except Exception as e:
        logger.error(f"❌ Error scheduling admin refresh: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def clear_admin_cache_task(self):
    """
    Task สำหรับล้าง admin cache
    """
    try:
        global admin_cache
        cache_size = len(admin_cache)
        admin_cache = {}
        
        logger.info(f"🧹 Cleared admin cache ({cache_size} entries)")
        return {
            "status": "success",
            "cleared_entries": cache_size
        }
    except Exception as e:
        logger.error(f"❌ Error clearing admin cache: {e}")
        raise


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def update_page_admin_info_task(self, page_id: str, admin_data: dict):
    """
    Task สำหรับอัปเดตข้อมูล admin ในระบบ (ถ้ามีการเก็บใน DB)
    """
    db = SessionLocal()
    try:
        logger.info(f"📝 [Celery] Updating admin info for page_id={page_id}")
        
        # TODO: เพิ่มโค้ดบันทึกข้อมูล admin ลง DB ถ้าต้องการ
        # ตอนนี้แค่อัปเดต cache
        admin_cache[page_id] = admin_data
        
        logger.info(f"✅ Updated admin info for page_id={page_id}")
        return {
            "status": "success",
            "page_id": page_id
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating admin info: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def verify_page_admin_permissions_task(self, page_id: str):
    """
    Task สำหรับตรวจสอบสิทธิ์ของ admin
    """
    try:
        logger.info(f"🔐 [Celery] Verifying admin permissions for page_id={page_id}")
        
        access_token = get_page_token(page_id)
        
        if not access_token:
            return {
                "status": "error",
                "message": "No access token found"
            }
        
        # ตรวจสอบ permissions
        endpoint = f"{page_id}"
        params = {
            "fields": "access_token,tasks,perms"
        }
        
        result = fb_get(endpoint, params, access_token)
        
        if "error" in result:
            logger.error(f"❌ Error verifying permissions: {result['error']}")
            return {
                "status": "error",
                "error": result["error"]
            }
        
        permissions = {
            "page_id": page_id,
            "tasks": result.get("tasks", []),
            "perms": result.get("perms", []),
            "has_messaging": "MODERATE" in result.get("tasks", []),
            "status": "success"
        }
        
        logger.info(f"✅ Verified permissions for page_id={page_id}")
        return permissions
        
    except Exception as e:
        logger.error(f"❌ Error verifying permissions: {e}")
        raise