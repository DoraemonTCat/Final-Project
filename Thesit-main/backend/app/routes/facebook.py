from app.service.facebook_api import fb_get, send_message, send_media, send_media_from_base64, async_fb_get, batch_fb_requests
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from datetime import datetime, timedelta
import requests
from fastapi import APIRouter, Response, Request, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import crud, schemas, database, models
from app.database.database import get_db
from app import config
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import aiohttp
from collections import defaultdict
import time
import json

router = APIRouter()

# ================================
# 🔧 Memory Storage และ Caching
# ================================
page_tokens = {}  # key = page_id, value = PAGE_ACCESS_TOKEN
page_names = {}   # key = page_id, value = page_name

# Cache storage
conversation_cache = {}  # key = page_id, value = {"data": conversations, "timestamp": time}
CACHE_DURATION = 60  # Cache duration in seconds

class SendMessageRequest(BaseModel):
    message: str
    type: Optional[str] = "text"  # "text", "image", or "video"
    media_data: Optional[str] = None  # base64 encoded media
    filename: Optional[str] = None

class BatchSendRequest(BaseModel):
    psids: List[str]
    messages: List[Dict[str, str]]  # [{"type": "text", "content": "...", "media_data": "..."}]

@router.get("/connect", response_class=HTMLResponse)
async def connect_facebook_page():
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>เชื่อมต่อ Facebook Page</title>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                text-align: center;
                margin-top: 100px;
                background-color: #f0f2f5;
            }}
            a.button {{
                background-color: #4267B2;
                color: white;
                padding: 14px 24px;
                text-decoration: none;
                font-size: 18px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            a.button:hover {{
                background-color: #365899;
            }}
        </style>
    </head>
    <body>
        <h1>เชื่อมต่อ Facebook Page ของคุณ</h1>
        <p>คลิกปุ่มด้านล่างเพื่อเริ่มต้นการเชื่อมต่อ</p>
        <a href="{config.OAUTH_LINK}" class="button">🔗 เชื่อมต่อ Facebook</a>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/facebook/callback")
def facebook_callback(code: str, db: Session = Depends(get_db)):
    print(f"🔗 Facebook callback received with code: {code[:20]}...")
    
    # ดึง access token
    token_url = "https://graph.facebook.com/v14.0/oauth/access_token"
    params = {
        "client_id": config.FB_APP_ID,
        "redirect_uri": config.REDIRECT_URI,
        "client_secret": config.FB_APP_SECRET,
        "code": code
    }

    print("🔍 กำลังขอ access token...")
    res = requests.get(token_url, params=params)
    token_data = res.json()

    if "error" in token_data:
        print(f"❌ Error getting access token: {token_data['error']}")
        return JSONResponse(status_code=400, content={"error": token_data['error']})

    user_token = token_data.get("access_token")
    print("✅ ได้รับ user access token แล้ว")

    # ดึงเพจ
    pages_url = "https://graph.facebook.com/me/accounts"
    print("🔍 กำลังดึงรายการเพจ...")
    pages_res = requests.get(pages_url, params={"access_token": user_token})
    pages = pages_res.json()

    if "error" in pages:
        print(f"❌ Error getting pages: {pages['error']}")
        return JSONResponse(status_code=400, content={"error": pages['error']})

    connected_pages = []
    for page in pages.get("data", []):
        page_id = page["id"]
        access_token = page["access_token"]
        page_name = page.get("name", f"เพจ {page_id}")

        # เก็บใน local dictionary
        page_tokens[page_id] = access_token
        page_names[page_id] = page_name

        # เก็บลงฐานข้อมูลด้วย
        existing = crud.get_page_by_page_id(db, page_id)
        if not existing:
            new_page = schemas.FacebookPageCreate(page_id=page_id, page_name=page_name)
            crud.create_page(db, new_page)

        connected_pages.append({"id": page_id, "name": page_name})
        print(f"✅ เชื่อมต่อเพจสำเร็จ: {page_name} (ID: {page_id})")

    print(f"✅ เชื่อมต่อเพจทั้งหมด {len(connected_pages)} เพจ")

    if connected_pages:
        return RedirectResponse(url=f"http://localhost:3000/?page_id={connected_pages[0]['id']}")
    else:
        return RedirectResponse(url="http://localhost:3000/?error=no_pages")

@router.get("/pages")
async def get_connected_pages():
    pages_list = [{"id": k, "name": page_names.get(k, f"เพจ {k}")} for k in page_tokens.keys()]
    print(f"📋 รายการเพจที่เชื่อมต่อ: {len(pages_list)} เพจ")
    return {"pages": pages_list}

# ฟังก์ชันตรวจสอบ cache
def get_cached_conversations(page_id: str):
    """ดึงข้อมูลจาก cache ถ้ายังไม่หมดอายุ"""
    if page_id in conversation_cache:
        cache_data = conversation_cache[page_id]
        if time.time() - cache_data["timestamp"] < CACHE_DURATION:
            print(f"✅ ใช้ข้อมูลจาก cache สำหรับ page_id: {page_id}")
            return cache_data["data"]
    return None

def set_cached_conversations(page_id: str, data: list):
    """บันทึกข้อมูลลง cache"""
    conversation_cache[page_id] = {
        "data": data,
        "timestamp": time.time()
    }

@router.get("/psids")
async def get_user_psids(page_id: str):
    """ดึง PSID ทั้งหมดของผู้ใช้ (ใช้ cache)"""
    print(f"🔍 กำลังดึง PSID สำหรับ page_id: {page_id}")
    
    # ตรวจสอบ cache ก่อน
    cached_data = get_cached_conversations(page_id)
    if cached_data:
        return JSONResponse(content={"conversations": cached_data, "total": len(cached_data), "cached": True})
    
    access_token = page_tokens.get(page_id)
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}. กรุณาเชื่อมต่อเพจก่อน"}
        )
    
    print(f"✅ พบ access_token สำหรับ page_id: {page_id}")
    
    conversations = await get_conversations_with_participants_async(page_id, access_token)
    if conversations:
        data = await extract_psids_with_conversation_id_async(conversations, access_token, page_id)
        set_cached_conversations(page_id, data)  # บันทึกลง cache
        print(f"✅ ส่งข้อมูล conversations จำนวน: {len(data)}")
        return JSONResponse(content={"conversations": data, "total": len(data), "cached": False})
    else:
        print("❌ ไม่สามารถดึงข้อมูล conversations ได้")
        return JSONResponse(
            status_code=500, 
            content={"error": "ไม่สามารถดึงข้อมูล conversation ได้"}
        )

async def get_conversations_with_participants_async(page_id, access_token: str):
    """ดึง conversations แบบ async"""
    endpoint = f"{page_id}/conversations"
    params = {
        "fields": "participants,updated_time,id",
        "limit": 100
    }
    
    async with aiohttp.ClientSession() as session:
        result = await async_fb_get(session, endpoint, params, access_token)
        if "error" in result:
            print(f"❌ Error getting conversations: {result['error']}")
            return None
        print(f"✅ พบ conversations จำนวน: {len(result.get('data', []))}")
        return result

async def extract_psids_with_conversation_id_async(conversations_data, access_token, page_id):
    """ประมวลผลข้อมูล conversations แบบ async"""
    result = []
    if not conversations_data or "data" not in conversations_data:
        print("❌ ไม่มีข้อมูล conversations")
        return result

    # ใช้ asyncio.gather เพื่อดึงข้อมูลพร้อมกัน
    tasks = []
    async with aiohttp.ClientSession() as session:
        for convo in conversations_data.get("data", []):
            task = process_single_conversation(session, convo, access_token, page_id)
            tasks.append(task)
        
        processed_conversations = await asyncio.gather(*tasks)
    
    # กรองเฉพาะที่มี user_psids
    result = [conv for conv in processed_conversations if conv["user_psids"]]
    return result

async def process_single_conversation(session, convo, access_token, page_id):
    """ประมวลผล conversation เดียว"""
    convo_id = convo.get("id")
    updated_time = convo.get("updated_time")
    participants = convo.get("participants", {}).get("data", [])
    
    # ดึงข้อมูลข้อความ
    messages_data = await get_conversation_messages_async(session, convo_id, access_token)
    
    created_time = None
    last_user_message_time = None
    if messages_data and "data" in messages_data:
        messages = messages_data["data"]
        if messages:
            created_time = messages[-1].get("created_time")
            
            # หาข้อความล่าสุดของ user
            for message in messages:
                sender_id = message.get("from", {}).get("id")
                if sender_id and sender_id != page_id:
                    last_user_message_time = message.get("created_time")
                    break
    
    user_psids = []
    user_names = []
    
    for participant in participants:
        participant_id = participant.get("id")
        if participant_id and participant_id != page_id:
            user_psids.append(participant_id)
            user_name = participant.get("name") or f"User...{participant_id[-8:]}"
            user_names.append(user_name)
    
    return {
        "conversation_id": convo_id,
        "psids": user_psids,
        "names": user_names,
        "updated_time": updated_time,
        "created_time": created_time,
        "last_user_message_time": last_user_message_time,
        "user_psids": user_psids  # ใช้สำหรับกรอง
    }

async def get_conversation_messages_async(session, conversation_id, access_token):
    """ดึงข้อความใน conversation แบบ async"""
    endpoint = f"{conversation_id}/messages"
    params = {
        "fields": "from,created_time",
        "limit": 10
    }
    return await async_fb_get(session, endpoint, params, access_token)

@router.post("/send/{page_id}/{psid}")
async def send_user_message_by_psid(page_id: str, psid: str, req: SendMessageRequest):
    """ส่งข้อความหรือสื่อไปยังผู้ใช้ผ่าน PSID"""
    print(f"📤 กำลังส่ง {req.type} ไปยัง PSID: {psid}")
    
    access_token = page_tokens.get(page_id)
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        return {"error": "Page token not found. Please connect via /connect first."}

    # ตรวจสอบ PSID
    if not psid or len(psid) < 10:
        print(f"❌ PSID ไม่ถูกต้อง: {psid}")
        return {"error": "Invalid PSID"}
    
    try:
        if req.type == "text":
            # ส่งข้อความธรรมดา
            result = send_message(psid, req.message, access_token)
        elif req.type in ["image", "video"]:
            # ส่งรูปภาพหรือวิดีโอ
            if req.media_data and req.filename:
                # ส่งจาก base64 data
                result = send_media_from_base64(
                    psid, 
                    req.type, 
                    req.media_data, 
                    req.filename, 
                    access_token
                )
            else:
                # ถ้าเป็น URL
                result = send_media(psid, req.type, req.message, access_token)
        else:
            return {"error": "Invalid message type"}
        
        if "error" in result:
            print(f"❌ เกิดข้อผิดพลาดในการส่ง {req.type}: {result['error']}")
            return {"error": result["error"], "details": result}
        else:
            print(f"✅ ส่ง {req.type} สำเร็จ")
            # ล้าง cache เมื่อส่งข้อความสำเร็จ
            if page_id in conversation_cache:
                del conversation_cache[page_id]
            return {"success": True, "result": result}
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return {"error": str(e)}

@router.post("/send-batch/{page_id}")
async def send_batch_messages(page_id: str, req: BatchSendRequest, background_tasks: BackgroundTasks):
    """ส่งข้อความแบบ batch ไปยังหลาย PSID"""
    access_token = page_tokens.get(page_id)
    if not access_token:
        return {"error": "Page token not found"}
    
    # เพิ่ม background task สำหรับส่งข้อความ
    background_tasks.add_task(
        send_messages_in_background,
        page_id,
        req.psids,
        req.messages,
        access_token
    )
    
    return {
        "status": "Processing",
        "message": f"กำลังส่งข้อความไปยัง {len(req.psids)} คน",
        "total_messages": len(req.psids) * len(req.messages)
    }

async def send_messages_in_background(page_id: str, psids: List[str], messages: List[Dict], access_token: str):
    """ส่งข้อความใน background"""
    for psid in psids:
        for msg in messages:
            try:
                if msg["type"] == "text":
                    send_message(psid, msg["content"], access_token)
                elif msg["type"] in ["image", "video"] and msg.get("media_data"):
                    send_media_from_base64(
                        psid,
                        msg["type"],
                        msg["media_data"],
                        msg.get("filename", "media"),
                        access_token
                    )
                # Delay เพื่อไม่ให้ถูก rate limit
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"❌ Error sending to {psid}: {e}")

# Optimized endpoint with pagination
@router.get("/conversations-with-last-message/{page_id}")
async def get_conversations_with_last_message(
    page_id: str, 
    limit: int = 50, 
    offset: int = 0,
    use_cache: bool = True
):
    """ดึง conversations พร้อมข้อความล่าสุดในครั้งเดียว - มี pagination และ cache"""
    print(f"🚀 เริ่มดึงข้อมูล conversations สำหรับ page_id: {page_id} (limit: {limit}, offset: {offset})")
    
    # ตรวจสอบ cache ถ้า use_cache = True
    if use_cache:
        cached_data = get_cached_conversations(f"{page_id}_full")
        if cached_data:
            # Apply pagination to cached data
            paginated_data = cached_data[offset:offset + limit]
            return {
                "conversations": paginated_data,
                "total": len(cached_data),
                "limit": limit,
                "offset": offset,
                "cached": True,
                "optimization": "Used cached data with pagination"
            }
    
    # ตรวจสอบ access token
    access_token = page_tokens.get(page_id)
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}. กรุณาเชื่อมต่อเพจก่อน"}
        )
    
    try:
        # ใช้ async function เพื่อประสิทธิภาพ
        async with aiohttp.ClientSession() as session:
            # Step 1: ดึง conversations
            conversations_endpoint = f"{page_id}/conversations"
            conversations_params = {
                "fields": "participants,updated_time,id",
                "limit": 100  # ดึงทั้งหมดก่อน แล้วค่อย paginate
            }
            
            conversations_result = await async_fb_get(
                session, 
                conversations_endpoint, 
                conversations_params, 
                access_token
            )
            
            if "error" in conversations_result:
                return JSONResponse(status_code=400, content={"error": conversations_result["error"]})
            
            conversations_data = conversations_result.get("data", [])
            print(f"✅ พบ conversations จำนวน: {len(conversations_data)}")
            
            if not conversations_data:
                return {"conversations": [], "total": 0}
            
            # Step 2: สร้าง batch requests
            batch_requests = []
            for i, conv in enumerate(conversations_data):
                conversation_id = conv.get("id")
                batch_requests.append({
                    "method": "GET",
                    "relative_url": f"{conversation_id}/messages?fields=message,from,created_time&limit=10"
                })
            
            # Step 3: ส่ง batch request
            print(f"🚀 กำลังส่ง batch request สำหรับ {len(batch_requests)} conversations...")
            
            batch_results = await batch_fb_requests(batch_requests, access_token)
            
            print(f"✅ ได้รับผลลัพธ์ batch request: {len(batch_results)} รายการ")
            
            # Step 4: ประมวลผลข้อมูลทั้งหมด
            result_conversations = []
            for i, conv in enumerate(conversations_data):
                conversation_id = conv.get("id")
                updated_time = conv.get("updated_time")
                participants = conv.get("participants", {}).get("data", [])
                
                # หา user participants
                user_psids = []
                user_names = []
                
                for participant in participants:
                    participant_id = participant.get("id")
                    if participant_id and participant_id != page_id:
                        user_psids.append(participant_id)
                        user_name = participant.get("name")
                        
                        if not user_name:
                            user_name = f"User...{participant_id[-8:]}" if len(participant_id) > 8 else f"User {participant_id}"
                        
                        user_names.append(user_name)
                
                # ดึงข้อมูลข้อความจาก batch result
                last_user_message_time = None
                first_created_time = None
                
                if i < len(batch_results) and batch_results[i].get("code") == 200:
                    try:
                        messages_data = json.loads(batch_results[i]["body"])
                        messages = messages_data.get("data", [])
                        
                        if messages:
                            first_created_time = messages[-1].get("created_time")
                            
                            # หาข้อความล่าสุดของ user
                            for message in messages:
                                sender_id = message.get("from", {}).get("id")
                                if sender_id and sender_id != page_id:
                                    last_user_message_time = message.get("created_time")
                                    break
                                    
                    except Exception as e:
                        print(f"⚠️ Error parsing messages for conversation {conversation_id}: {e}")
                
                # เพิ่มข้อมูลลงใน result
                if user_psids:
                    user_name = user_names[0] if user_names else "ไม่ทราบชื่อ"
                    
                    result_conversations.append({
                        "id": len(result_conversations) + 1,
                        "conversation_id": conversation_id,
                        "conversation_name": f" {user_name}",
                        "user_name": user_name,
                        "psids": user_psids,
                        "names": user_names,
                        "raw_psid": user_psids[0],
                        "updated_time": updated_time,
                        "created_time": first_created_time,
                        "last_user_message_time": last_user_message_time
                    })
            
            # บันทึกลง cache
            set_cached_conversations(f"{page_id}_full", result_conversations)
            
            # Apply pagination
            paginated_conversations = result_conversations[offset:offset + limit]
            
            print(f"✅ ประมวลผลเสร็จสิ้น: {len(result_conversations)} conversations (แสดง {len(paginated_conversations)})")
            
            return {
                "conversations": paginated_conversations, 
                "total": len(result_conversations),
                "limit": limit,
                "offset": offset,
                "cached": False,
                "optimization": "Used batch API with pagination"
            }
            
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"เกิดข้อผิดพลาดในการดึงข้อมูล: {str(e)}"}
        )

# Clear cache endpoint
@router.post("/clear-cache/{page_id}")
async def clear_cache(page_id: str):
    """ล้าง cache สำหรับ page ที่ระบุ"""
    keys_to_remove = [key for key in conversation_cache.keys() if key.startswith(page_id)]
    for key in keys_to_remove:
        del conversation_cache[key]
    
    return {"message": f"Cleared cache for page {page_id}", "removed_keys": len(keys_to_remove)}

# Health check with cache info
@router.get("/cache-info")
async def get_cache_info():
    """แสดงข้อมูล cache ปัจจุบัน"""
    cache_info = {}
    for key, value in conversation_cache.items():
        age = time.time() - value["timestamp"]
        cache_info[key] = {
            "data_count": len(value["data"]),
            "age_seconds": round(age, 2),
            "expired": age > CACHE_DURATION
        }
    
    return {
        "cache_duration": CACHE_DURATION,
        "cached_pages": len(cache_info),
        "details": cache_info
    }

@router.get("/debug/tokens")
async def debug_tokens():
    """ดู token ที่เก็บไว้"""
    return {
        "page_tokens_count": len(page_tokens),
        "page_tokens": {k: f"{v[:20]}..." for k, v in page_tokens.items()},
        "page_names": page_names
    }

@router.get("/debug/conversations/{page_id}")
async def debug_conversations(page_id: str):
    """Debug conversations data"""
    access_token = page_tokens.get(page_id)
    if not access_token:
        return {"error": "Page token not found"}
    
    # ดึงข้อมูลดิบ
    raw_conversations = await get_conversations_with_participants_async(page_id, access_token)
    
    return {
        "page_id": page_id,
        "has_token": bool(access_token),
        "token_preview": f"{access_token[:20]}..." if access_token else None,
        "raw_data": raw_conversations
    }