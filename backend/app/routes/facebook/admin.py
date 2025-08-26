"""
Facebook Admin Component
จัดการ:
- ดึงข้อมูล Admin/Owner ของ Page
- Cache ข้อมูล Admin
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Optional
import logging

from app.database.database import get_db
from app.service.facebook_api import fb_get
from .auth import get_page_tokens

router = APIRouter()
logger = logging.getLogger(__name__)

# Cache สำหรับเก็บข้อมูล admin
admin_cache: Dict[str, Dict] = {}

@router.get("/admin/{page_id}")
async def get_page_admin(
    page_id: str,
    db: Session = Depends(get_db)
):
    """ดึงข้อมูล Admin ของ Page"""
    try:
        # ตรวจสอบ cache ก่อน
        if page_id in admin_cache:
            logger.info(f"Returning cached admin data for page {page_id}")
            return admin_cache[page_id]
        
        # ดึง access token
        page_tokens = get_page_tokens()
        access_token = page_tokens.get(page_id)
        
        if not access_token:
            return JSONResponse(
                status_code=400,
                content={"error": f"ไม่พบ access token สำหรับ page {page_id}"}
            )
        
        # ดึงข้อมูล Page roles (admins, editors, etc.)
        endpoint = f"{page_id}/roles"
        params = {
            "fields": "id,name,role,picture{url}",
            "limit": 100
        }
        
        result = fb_get(endpoint, params, access_token)
        
        if "error" in result:
            logger.error(f"Error getting page roles: {result['error']}")
            # Fallback: ดึงข้อมูล page owner จาก page info
            return await get_page_owner_info(page_id, access_token)
        
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
        
        # ถ้าไม่พบ admin ใช้วิธี fallback
        if not admins:
            return await get_page_owner_info(page_id, access_token)
        
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
        
        # เก็บใน cache
        admin_data = {
            "primary_admin": primary_admin,
            "all_admins": admins,
            "page_id": page_id
        }
        
        admin_cache[page_id] = admin_data
        
        return admin_data
        
    except Exception as e:
        logger.error(f"Error getting page admin: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

async def get_page_owner_info(page_id: str, access_token: str) -> Dict:
    """Fallback: ดึงข้อมูล page owner จาก page info"""
    try:
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
                "page_name": page_info.get("name")
            }
            
            # เก็บใน cache
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
            "page_id": page_id
        }
        
    except Exception as e:
        logger.error(f"Error in fallback admin info: {e}")
        return {
            "primary_admin": {
                "id": "unknown",
                "name": "Page Admin",
                "role": "ADMIN",
                "picture": None
            },
            "all_admins": [],
            "page_id": page_id
        }

@router.post("/admin/clear-cache")
async def clear_admin_cache():
    """Clear admin cache"""
    global admin_cache
    admin_cache = {}
    return {"status": "success", "message": "Admin cache cleared"}
