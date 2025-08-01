# backend/app/routes/facebook/conversations.py
"""
Facebook Conversations Component
จัดการ:
- ดึงข้อมูล conversations จาก Facebook
- ดึง PSIDs และข้อมูลผู้ใช้
- จัดการข้อมูล participants
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.service.facebook_api import fb_get
from .auth import get_page_tokens

router = APIRouter()

# API สำหรับดึงข้อมูล conversations พร้อม PSIDs
@router.get("/psids")
async def get_user_psids(page_id: str):
    """ดึง PSID ทั้งหมดของผู้ใช้"""
    print(f"🔍 กำลังดึง PSID สำหรับ page_id: {page_id}")
    
    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        print(f"🔍 Available page_tokens: {list(page_tokens.keys())}")
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}. กรุณาเชื่อมต่อเพจก่อน"}
        )
    
    print(f"✅ พบ access_token สำหรับ page_id: {page_id}")
    
    conversations = get_conversations_with_participants(page_id, access_token)
    if conversations:
        data = extract_psids_with_conversation_id(conversations, access_token, page_id)
        print(f"✅ ส่งข้อมูล conversations จำนวน: {len(data)}")
        return JSONResponse(content={"conversations": data, "total": len(data)})
    else:
        print("❌ ไม่สามารถดึงข้อมูล conversations ได้")
        return JSONResponse(
            status_code=500, 
            content={"error": "ไม่สามารถดึงข้อมูล conversation ได้"}
        )

# API สำหรับดึงข้อมูล conversations พร้อม participants
def get_conversations_with_participants(page_id, access_token: str = None):
    """ดึงข้อมูล conversations พร้อม participants"""
    endpoint = f"{page_id}/conversations"
    params = {
        "fields": "participants,updated_time,id",
        "limit": 100
    }
    print(f"🔍 กำลังดึงข้อมูล conversations สำหรับ page_id: {page_id}")
    result = fb_get(endpoint, params, access_token)
    if "error" in result:
        print(f"❌ Error getting conversations: {result['error']}")
        return None
    print(f"✅ พบ conversations จำนวน: {len(result.get('data', []))}")
    return result

# API สำหรับดึงข้อมูลผู้ใช้จาก PSID
def get_user_info_from_psid(psid, access_token):
    """ดึงข้อมูลผู้ใช้จาก PSID"""
    methods = [
        {
            "endpoint": f"{psid}",
            "params": {"fields": "name,first_name,last_name,profile_pic"}
        },
        {
            "endpoint": f"me",
            "params": {
                "fields": f"{psid}.name,{psid}.first_name,{psid}.last_name",
                "ids": psid
            }
        }
    ]

    for method in methods:
        try:
            result = fb_get(method["endpoint"], method["params"], access_token)
            if "error" not in result:
                name = result.get("name") or result.get("first_name", "")
                if name:
                    return {
                        "name": name,
                        "first_name": result.get("first_name", ""),
                        "last_name": result.get("last_name", ""),
                        "profile_pic": result.get("profile_pic", "")
                    }
        except Exception as e:
            print(f"⚠️ Method failed: {e}")
            continue

    fallback_name = f"User...{psid[-8:]}" if len(psid) > 8 else f"User {psid}"
    return {
        "name": fallback_name,
        "first_name": "Unknown",
        "last_name": "",
        "profile_pic": ""
    }

# API สำหรับดึงชื่อจากข้อความใน conversation
def get_name_from_messages(conversation_id, access_token, page_id):
    """ดึงชื่อผู้ใช้จากข้อความใน conversation"""
    try:
        endpoint = f"{conversation_id}/messages"
        params = {
            "fields": "from,message",
            "limit": 10
        }
        result = fb_get(endpoint, params, access_token)
        if "data" in result:
            for message in result["data"]:
                sender = message.get("from", {})
                sender_name = sender.get("name")
                sender_id = sender.get("id")
                if sender_id != page_id and sender_name:
                    return sender_name
        return None
    except Exception as e:
        print(f"❌ Error getting name from messages: {e}")
        return None

# API สำหรับดึงเวลาของข้อความแรกใน conversation
def get_first_message_time(conversation_id, access_token):
    """ดึงเวลาของข้อความแรกใน conversation"""
    endpoint = f"{conversation_id}/messages"
    params = {
        "fields": "created_time",
        "limit": 1,
        "order": "chronological"
    }
    result = fb_get(endpoint, params, access_token)
    if "data" in result and result["data"]:
        return result["data"][0].get("created_time")
    return None

# API สำหรับแปลงข้อมูล conversations เป็นรูปแบบที่ frontend ต้องการ
def extract_psids_with_conversation_id(conversations_data, access_token, page_id):
    """แปลงข้อมูล conversations เป็นรูปแบบที่ frontend ต้องการ"""
    result = []
    if not conversations_data or "data" not in conversations_data:
        print("❌ ไม่มีข้อมูล conversations")
        return result

    for convo in conversations_data.get("data", []):
        convo_id = convo.get("id")
        updated_time = convo.get("updated_time")
        participants = convo.get("participants", {}).get("data", [])
        created_time = get_first_message_time(convo_id, access_token)
        user_psids = []
        user_names = []

        for participant in participants:
            participant_id = participant.get("id")
            if participant_id and participant_id != page_id:
                user_psids.append(participant_id)
                user_name = participant.get("name") or None

                if not user_name:
                    user_info = get_user_info_from_psid(participant_id, access_token)
                    user_name = user_info.get("name")

                if not user_name or user_name.startswith("User"):
                    message_name = get_name_from_messages(convo_id, access_token, page_id)
                    if message_name:
                        user_name = message_name

                if not user_name:
                    user_name = f"User...{participant_id[-8:]}"
                user_names.append(user_name)

        if user_psids:
            result.append({
                "conversation_id": convo_id,
                "psids": user_psids,
                "names": user_names,
                "updated_time": updated_time,
                "created_time": created_time
            })
    return result