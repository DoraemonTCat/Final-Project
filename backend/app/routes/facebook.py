from app.service.facebook_api import fb_get, send_message, send_image_binary, send_video_binary
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from datetime import datetime
import requests
from fastapi import APIRouter, Response, Request, Depends
from sqlalchemy.orm import Session
from app.database import crud, schemas, database, models
from app.database.database import get_db
from app import config  # ✅ ใช้ config แทน app.app
from pydantic import BaseModel
from typing import Optional
from app.config import image_dir,vid_dir

router = APIRouter()

# ================================
# 🔧 เพิ่ม Memory Storage สำหรับ Page Tokens
# ================================
# เพิ่มตัวแปรเหล่านี้ใน facebook.py เพื่อให้ตรงกับ paste.txt
page_tokens = {}  # key = page_id, value = PAGE_ACCESS_TOKEN
page_names = {}   # key = page_id, value = page_name

class SendMessageRequest(BaseModel):
    message: str
    type: Optional[str] = "text"  # "text", "image", or "video"

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

        # ✅ เก็บใน local dictionary แทน config
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
    # ✅ ใช้ local dictionary แทน config
    pages_list = [{"id": k, "name": page_names.get(k, f"เพจ {k}")} for k in page_tokens.keys()]
    print(f"📋 รายการเพจที่เชื่อมต่อ: {len(pages_list)} เพจ")
    return {"pages": pages_list}

@router.get("/psids")
async def get_user_psids(page_id: str):
    """ดึง PSID ทั้งหมดของผู้ใช้"""
    print(f"🔍 กำลังดึง PSID สำหรับ page_id: {page_id}")
    
    # ✅ ใช้ local dictionary แทน config
    access_token = page_tokens.get(page_id)
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        print(f"🔍 Available page_tokens: {list(page_tokens.keys())}")  # Debug line
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

def get_conversations_with_participants(page_id, access_token: str = None):
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

def get_user_info_from_psid(psid, access_token):
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

def get_name_from_messages(conversation_id, access_token, page_id):
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

def get_first_message_time(conversation_id, access_token):
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

def extract_psids_with_conversation_id(conversations_data, access_token, page_id):
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

@router.post("/send/{page_id}/{psid}")
async def send_user_message_by_psid(
    page_id: str,
    psid: str,
    req: SendMessageRequest,
    request: Request
):
    print(f"📤 กำลังส่งข้อความไปยัง PSID: {psid}")
    print(f"📤 ข้อความ: {req.message}")

    access_token = page_tokens.get(page_id)
    if not access_token:
        return {"error": "Page token not found. Please connect via /connect first."}

    if not psid or len(psid) < 10:
        return {"error": "Invalid PSID"}

    if req.type == "image":
        # สร้าง path ไฟล์ local เต็ม
        image_path = f"{image_dir}/{req.message}"
        result = send_image_binary(psid, image_path, access_token)

    elif req.type == "video":
        video_path = f"{vid_dir}/{req.message}"
        result = send_video_binary(psid, video_path, access_token)  # ต้องเขียนฟังก์ชันนี้ด้วย

    else:
        result = send_message(psid, req.message, access_token)

    if "error" in result:
        return {"error": result["error"], "details": result}
    else:
        return {"success": True, "result": result}
# ================================
# 🧪 Debug Routes - เพิ่มเพื่อช่วย Debug
# ================================

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
    raw_conversations = get_conversations_with_participants(page_id, access_token)
    
    return {
        "page_id": page_id,
        "has_token": bool(access_token),
        "token_preview": f"{access_token[:20]}..." if access_token else None,
        "raw_data": raw_conversations
    }

# เพิ่ม endpoint ใหม่ใน facebook.py
@router.get("/conversations-with-last-message/{page_id}")
async def get_conversations_with_last_message(page_id: str):
    """ดึง conversations พร้อมข้อความล่าสุดในครั้งเดียว - เพื่อลดการเรียก API"""
    print(f"🚀 เริ่มดึงข้อมูล conversations พร้อมข้อความล่าสุดสำหรับ page_id: {page_id}")
    
    # ตรวจสอบ access token
    access_token = page_tokens.get(page_id)
    if not access_token:
        print(f"❌ ไม่พบ access_token สำหรับ page_id: {page_id}")
        return JSONResponse(
            status_code=400, 
            content={"error": f"ไม่พบ access_token สำหรับ page_id: {page_id}. กรุณาเชื่อมต่อเพจก่อน"}
        )
    
    try:
        # 🔥 Step 1: ดึง conversations พร้อม participants ในครั้งเดียว
        conversations_endpoint = f"{page_id}/conversations"
        conversations_params = {
            "fields": "participants,updated_time,id",
            "limit": 100
        }
        
        print("🔍 กำลังดึงข้อมูล conversations...")
        conversations_result = fb_get(conversations_endpoint, conversations_params, access_token)
        
        if "error" in conversations_result:
            print(f"❌ Error getting conversations: {conversations_result['error']}")
            return JSONResponse(status_code=400, content={"error": conversations_result["error"]})
        
        conversations_data = conversations_result.get("data", [])
        print(f"✅ พบ conversations จำนวน: {len(conversations_data)}")
        
        if not conversations_data:
            return {"conversations": [], "total": 0}
        
        # 🔥 Step 2: ดึงข้อความล่าสุดพร้อมกันแบบ batch
        result_conversations = []
        
        # สร้าง batch requests สำหรับดึงข้อความล่าสุด
        batch_requests = []
        for i, conv in enumerate(conversations_data):
            conversation_id = conv.get("id")
            batch_requests.append({
                "method": "GET",
                "relative_url": f"{conversation_id}/messages?fields=message,from,created_time&limit=10"
            })
        
        # 🚀 ส่ง batch request เพื่อดึงข้อความทั้งหมดในครั้งเดียว
        print(f"🚀 กำลังส่ง batch request สำหรับ {len(batch_requests)} conversations...")
        
        # Facebook Graph API Batch Request
        batch_url = "https://graph.facebook.com/v14.0/"
        batch_params = {
            "access_token": access_token,
            "batch": str(batch_requests).replace("'", '"')  # แปลงเป็น JSON string
        }
        
        import requests
        batch_response = requests.post(batch_url, data=batch_params)
        batch_results = batch_response.json()
        
        print(f"✅ ได้รับผลลัพธ์ batch request: {len(batch_results)} รายการ")
        
        # 🔥 Step 3: ประมวลผลข้อมูลทั้งหมด
        for i, conv in enumerate(conversations_data):
            conversation_id = conv.get("id")
            updated_time = conv.get("updated_time")
            participants = conv.get("participants", {}).get("data", [])
            
            # หา user participants (ไม่ใช่ page)
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
                    import json
                    messages_data = json.loads(batch_results[i]["body"])
                    messages = messages_data.get("data", [])
                    
                    # หาข้อความล่าสุดของ user และข้อความแรกสุด
                    if messages:
                        first_created_time = messages[-1].get("created_time")  # ข้อความแรกสุด
                        
                        # หาข้อความล่าสุดของ user (ไม่ใช่ page)
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
                    "id": i + 1,
                    "conversation_id": conversation_id,
                    "conversation_name": f" {user_name}",
                    "user_name": user_name,
                    "psids": user_psids,
                    "names": user_names,
                    "raw_psid": user_psids[0],
                    "updated_time": updated_time,
                    "created_time": first_created_time,
                    "last_user_message_time": last_user_message_time  # 🔥 เวลาข้อความล่าสุดของ user
                })
        
        print(f"✅ ประมวลผลเสร็จสิ้น: {len(result_conversations)} conversations พร้อมข้อมูลข้อความล่าสุด")
        
        return {
            "conversations": result_conversations, 
            "total": len(result_conversations),
            "optimization": "Used batch API to reduce requests"
        }
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"เกิดข้อผิดพลาดในการดึงข้อมูล: {str(e)}"}
        )

@router.post("/schedule/activate")
async def activate_schedule(request: Request):
    """เปิดใช้งาน schedule"""
    data = await request.json()
    page_id = data.get('page_id')
    schedule = data.get('schedule')
    
    # เพิ่ม schedule เข้าระบบ
    message_scheduler.add_schedule(page_id, schedule)
    
    # ถ้าเป็นแบบส่งทันที
    if schedule.get('type') == 'immediate':
        await message_scheduler.process_schedule(page_id, schedule)
    
    return {"status": "success", "message": "Schedule activated"}

@router.post("/schedule/deactivate")
async def deactivate_schedule(request: Request):
    """ปิดใช้งาน schedule"""
    data = await request.json()
    page_id = data.get('page_id')
    schedule_id = data.get('schedule_id')
    
    message_scheduler.remove_schedule(page_id, schedule_id)
    
    return {"status": "success", "message": "Schedule deactivated"}

@router.get("/schedule/test-inactivity/{page_id}")
async def test_user_inactivity(page_id: str):
    """ทดสอบระบบตรวจสอบ user ที่หายไป"""
    # Mock schedule for testing
    test_schedule = {
        "id": 999,
        "type": "user-inactive",
        "inactivityPeriod": "1",
        "inactivityUnit": "hours",
        "groups": [1],
        "messages": [
            {
                "type": "text",
                "content": "สวัสดีค่ะ คุณหายไปนานเลยนะคะ 😊",
                "order": 0
            },
            {
                "type": "text", 
                "content": "มีโปรโมชั่นพิเศษสำหรับคุณ!",
                "order": 1
            }
        ]
    }
    
    await message_scheduler.check_user_inactivity(page_id, test_schedule)
    
    return {"status": "success", "message": "Inactivity check completed"}