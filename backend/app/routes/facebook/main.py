# backend/app/routes/facebook/main.py
"""
Facebook Main Router
รวม routers ทั้งหมดและ export เป็น router หลัก
"""

from fastapi import APIRouter

# Import sub-routers
from .auth import router as auth_router
from .conversations import router as conversations_router
from .messages import router as messages_router
from .customers import router as customers_router
from .groups import router as groups_router
from .schedules import router as schedules_router

# สร้าง main router
router = APIRouter()

# Include all sub-routers
router.include_router(auth_router, tags=["Facebook Auth"])
router.include_router(conversations_router, tags=["Facebook Conversations"])
router.include_router(messages_router, tags=["Facebook Messages"])
router.include_router(customers_router, tags=["Facebook Customers"])
router.include_router(groups_router, tags=["Facebook Groups"])
router.include_router(schedules_router, tags=["Facebook Schedules"])

# Debug endpoints
@router.get("/debug/tokens")
async def debug_tokens():
    """ดู token ที่เก็บไว้ (สำหรับ debug)"""
    from .auth import get_page_tokens, get_page_names
    
    page_tokens = get_page_tokens()
    page_names = get_page_names()
    
    return {
        "page_tokens_count": len(page_tokens),
        "page_tokens": {k: f"{v[:20]}..." for k, v in page_tokens.items()},
        "page_names": page_names
    }


@router.get("/debug/conversations/{page_id}")
async def debug_conversations(page_id: str):
    """Debug conversations data"""
    from .auth import get_page_tokens
    from .conversations import get_conversations_with_participants
    
    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    
    if not access_token:
        return {"error": "Page token not found"}
    
    # ดึงข้อมูลดิบ
    raw_conversations = get_conversations_with_participants(page_id, access_token)
    
    return {
        "page_id": page_id,
        "has_token": bool(access_token),
        "token_preview": f"{access_token[:20]}..." if access_token else None,
        "raw_data": raw_conversations
    }