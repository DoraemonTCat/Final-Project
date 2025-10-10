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
import logging

from app.database import crud, schemas
from app.database.database import get_db
from app import config
from app.service.message_scheduler import message_scheduler
from app.service.auto_sync_service import auto_sync_service
from app.utils.redis_helper import store_page_token

router = APIRouter()

logger = logging.getLogger(__name__)

# Memory storage for page tokens
page_tokens: Dict[str, str] = {}
page_names: Dict[str, str] = {}

# API สำหรับเชื่อมต่อ Facebook Page
@router.get("/connect", response_class=HTMLResponse)
async def connect_facebook_page():
    """แสดงหน้าเชื่อมต่อ Facebook Page"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <title>เชื่อมต่อ Facebook Page - ระบบจัดการข้อความอัตโนมัติ</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            
            .container {{
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 100%;
                padding: 60px 40px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }}
            
            .container::before {{
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 5px;
                background: linear-gradient(90deg, #4267B2 0%, #365899 100%);
            }}
            
            .logo {{
                width: 80px;
                height: 80px;
                margin: 0 auto 30px;
                background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 10px 30px rgba(66, 103, 178, 0.3);
            }}
            
            .logo svg {{
                width: 50px;
                height: 50px;
                fill: white;
            }}
            
            h1 {{
                color: #1a1a1a;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 15px;
                line-height: 1.3;
            }}
            
            .subtitle {{
                color: #666;
                font-size: 16px;
                margin-bottom: 40px;
                line-height: 1.6;
            }}
            
            .features {{
                background: #f8f9fa;
                border-radius: 12px;
                padding: 25px;
                margin-bottom: 40px;
                text-align: left;
            }}
            
            .features-title {{
                font-size: 14px;
                font-weight: 600;
                color: #333;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 15px;
                text-align: center;
            }}
            
            .feature-item {{
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                color: #555;
                font-size: 14px;
            }}
            
            .feature-item:last-child {{
                margin-bottom: 0;
            }}
            
            .feature-icon {{
                width: 20px;
                height: 20px;
                margin-right: 12px;
                background: #4267B2;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }}
            
            .feature-icon::after {{
                content: '✓';
                color: white;
                font-size: 12px;
                font-weight: bold;
            }}
            
            .connect-button {{
                background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                color: white;
                padding: 18px 40px;
                text-decoration: none;
                font-size: 16px;
                font-weight: 600;
                border-radius: 12px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                transition: all 0.3s ease;
                box-shadow: 0 10px 30px rgba(66, 103, 178, 0.3);
                position: relative;
                overflow: hidden;
            }}
            
            .connect-button::before {{
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s ease;
            }}
            
            .connect-button:hover {{
                transform: translateY(-2px);
                box-shadow: 0 15px 40px rgba(66, 103, 178, 0.4);
            }}
            
            .connect-button:hover::before {{
                left: 100%;
            }}
            
            .connect-button svg {{
                width: 24px;
                height: 24px;
                fill: white;
            }}
            
            .security-note {{
                margin-top: 30px;
                padding-top: 30px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                align-items: start;
                gap: 12px;
                text-align: left;
            }}
            
            .security-icon {{
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                margin-top: 2px;
            }}
            
            .security-icon svg {{
                width: 100%;
                height: 100%;
                fill: #28a745;
            }}
            
            .security-text {{
                font-size: 13px;
                color: #666;
                line-height: 1.5;
            }}
            
            @media (max-width: 480px) {{
                .container {{
                    padding: 40px 25px;
                }}
                
                h1 {{
                    font-size: 24px;
                }}
                
                .subtitle {{
                    font-size: 14px;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <svg viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
            </div>
            
            <h1>เชื่อมต่อ Facebook Page</h1>
            <p class="subtitle">
                เชื่อมต่อเพจของคุณเพื่อใช้งานระบบจัดการข้อความอัตโนมัติอย่างเต็มประสิทธิภาพ
            </p>
            
            <div class="features">
                <div class="features-title">คุณสมบัติที่พร้อมใช้งาน</div>
                <div class="feature-item">
                    <div class="feature-icon"></div>
                    <span>ตอบกลับข้อความอัตโนมัติตามเงื่อนไขที่กำหนด</span>
                </div>
                <div class="feature-item">
                    <div class="feature-icon"></div>
                    <span>จัดเก็บข้อมูลลูกค้าและประวัติการสนทนา</span>
                </div>
                <div class="feature-item">
                    <div class="feature-icon"></div>
                    <span>วิเคราะห์และรายงานผลการใช้งาน</span>
                </div>
                <div class="feature-item">
                    <div class="feature-icon"></div>
                    <span>ซิงค์ข้อมูลแบบเรียลไทม์</span>
                </div>
            </div>
            
            <a href="{config.OAUTH_LINK}" class="connect-button">
                <svg viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                เชื่อมต่อกับ Facebook
            </a>
            
            <div class="security-note">
                <div class="security-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                    </svg>
                </div>
                <div class="security-text">
                    <strong>การเชื่อมต่อปลอดภัย</strong><br>
                    ข้อมูลของคุณได้รับการเข้ารหัสและปกป้องตามมาตรฐาน OAuth 2.0
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# API สำหรับจัดการ OAuth callback จาก Facebook
@router.get("/facebook/callback")
def facebook_callback(code: str, db: Session = Depends(get_db)):
    """จัดการ OAuth callback จาก Facebook"""
    print(f"🔗 Facebook callback received with code: {code[:20]}...")

    # 1️⃣ ดึง user access token
    token_url = "https://graph.facebook.com/v14.0/oauth/access_token"
    params = {
        "client_id": config.FB_APP_ID,
        "redirect_uri": config.REDIRECT_URI,
        "client_secret": config.FB_APP_SECRET,
        "code": code,
    }

    print("🔍 กำลังขอ access token...")
    res = requests.get(token_url, params=params)
    token_data = res.json()

    if "error" in token_data:
        print(f"❌ Error getting access token: {token_data['error']}")
        return JSONResponse(status_code=400, content={"error": token_data["error"]})

    user_token = token_data.get("access_token")
    print("✅ ได้รับ user access token แล้ว")

    # 2️⃣ ดึงเพจทั้งหมดที่ user เป็นแอดมิน
    pages_url = "https://graph.facebook.com/me/accounts"
    print("🔍 กำลังดึงรายการเพจ...")
    pages_res = requests.get(pages_url, params={"access_token": user_token})
    pages = pages_res.json()

    if "error" in pages:
        print(f"❌ Error getting pages: {pages['error']}")
        return JSONResponse(status_code=400, content={"error": pages["error"]})

    connected_pages = []
    page_tokens = {}

    # 3️⃣ วนลูปบันทึกข้อมูลเพจ
    for page in pages.get("data", []):
        page_id = page["id"]
        access_token = page["access_token"]
        page_name = page.get("name", f"เพจ {page_id}")

        # ✅ เก็บ token ลง Redis
        store_page_token(page_id, access_token)
        print(f"✅ Stored token in Redis for page {page_name} ({page_id})")

        # ✅ เก็บใน memory (optional)
        page_tokens[page_id] = access_token

        # ✅ อัปเดตให้ background services รู้จัก
        message_scheduler.set_page_tokens(page_tokens)
        auto_sync_service.set_page_tokens(page_tokens)

        # ✅ บันทึกลงฐานข้อมูล
        existing = crud.get_page_by_page_id(db, page_id)
        if not existing:
            new_page = schemas.FacebookPageCreate(page_id=page_id, page_name=page_name)
            crud.create_page(db, new_page)

        # ✅ Auto sync tiers
        try:
            page_record = existing if existing else crud.get_page_by_page_id(db, page_id)
            if page_record:
                synced_tiers = crud.sync_retarget_tiers_from_knowledge(db, page_record.ID)
                logger.info(f"✅ Auto-synced {len(synced_tiers)} tiers for {page_name}")
        except Exception as e:
            logger.error(f"❌ Failed to sync tiers for {page_name}: {e}")

        connected_pages.append({"id": page_id, "name": page_name})
        print(f"✅ เชื่อมต่อเพจสำเร็จ: {page_name} (ID: {page_id})")

    print(f"✅ เชื่อมต่อเพจทั้งหมด {len(connected_pages)} เพจ")

    # 4️⃣ redirect ไป frontend
    if connected_pages:
        first_page = connected_pages[0]["id"]
        return RedirectResponse(url=f"http://localhost:3000/?page_id={first_page}")
    else:
        return RedirectResponse(url="http://localhost:3000/?error=no_pages")
    
# API สำหรับยกเลิกการเชื่อมต่อ Facebook Page
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