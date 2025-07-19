# backend/app/routes/facebook/auth.py
"""
Facebook Authentication Component
จัดการ:
- OAuth flow สำหรับเชื่อมต่อ Facebook Page
- การจัดการ Access Tokens
- การเชื่อมต่อและยกเลิกการเชื่อมต่อ Pages
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
import requests
from typing import Dict

from app.database import crud, schemas
from app.database.database import get_db
from app import config
from app.service.message_scheduler import message_scheduler
from app.service.auto_sync_service import auto_sync_service

router = APIRouter()

# Memory storage for page tokens
page_tokens: Dict[str, str] = {}
page_names: Dict[str, str] = {}


@router.get("/connect", response_class=HTMLResponse)
async def connect_facebook_page():
    """แสดงหน้าเชื่อมต่อ Facebook Page"""
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
    """จัดการ OAuth callback จาก Facebook"""
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
        
        # เก็บ tokens
        page_tokens[page_id] = access_token
        page_names[page_id] = page_name
        
        # ส่ง tokens ให้ services
        message_scheduler.set_page_tokens(page_tokens)
        auto_sync_service.set_page_tokens(page_tokens)

        # บันทึกลงฐานข้อมูล
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
    """ดึงรายการเพจที่เชื่อมต่อแล้ว"""
    pages_list = [{"id": k, "name": page_names.get(k, f"เพจ {k}")} for k in page_tokens.keys()]
    print(f"📋 รายการเพจที่เชื่อมต่อ: {len(pages_list)} เพจ")
    return {"pages": pages_list}


def get_page_tokens():
    """Helper function เพื่อให้ component อื่นเข้าถึง tokens"""
    return page_tokens


def get_page_names():
    """Helper function เพื่อให้ component อื่นเข้าถึงชื่อเพจ"""
    return page_names