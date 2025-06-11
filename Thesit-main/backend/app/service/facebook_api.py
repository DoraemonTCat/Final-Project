import requests
import os
import base64
from typing import Optional
import aiohttp
import asyncio

FB_API_URL = "https://graph.facebook.com/v14.0"

def fb_post(endpoint: str, payload: dict, access_token: str = None):
    url = f"{FB_API_URL}/{endpoint}"
    params = {"access_token": access_token}
    print(f"🔍 POST to: {url}")
    print(f"🔍 Payload: {payload}")
    response = requests.post(url, params=params, json=payload)
    print(f"🔍 Response Status: {response.status_code}")
    print(f"🔍 Response: {response.text}")
    return response.json()

def fb_get(endpoint: str, params: dict = {}, access_token: str = None):
    params["access_token"] = access_token
    url = f"{FB_API_URL}/{endpoint}"
    print(f"🔍 GET from: {url}")
    print(f"🔍 Params: {params}")
    response = requests.get(url, params=params)
    print(f"🔍 Response Status: {response.status_code}")
    print(f"🔍 Response: {response.text}")
    return response.json()

def send_message(recipient_id: str, message_text: str, access_token: str = None):
    # ตรวจสอบว่าเป็น URL ของ media หรือไม่
    if message_text.startswith('http://') and ('/media/' in message_text):
        # ส่งเป็น media
        if any(ext in message_text for ext in ['.jpg', '.png', '.gif', '.webp']):
            return send_media(recipient_id, 'image', message_text, access_token)
        elif any(ext in message_text for ext in ['.mp4', '.mov', '.avi']):
            return send_media(recipient_id, 'video', message_text, access_token)
    
    # ส่งเป็นข้อความธรรมดา
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {"text": message_text},
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def send_media(recipient_id: str, media_type: str, media_url: str, access_token: str = None):
    """ส่งรูปภาพหรือวิดีโอผ่าน URL"""
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": media_type,
                "payload": {"url": media_url, "is_reusable": True}
            }
        },
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def upload_media_to_facebook(file_path: str, media_type: str, access_token: str):
    """อัพโหลดไฟล์ไปยัง Facebook และรับ attachment_id"""
    url = f"{FB_API_URL}/me/message_attachments"
    
    # กำหนด mime type ตาม media type
    if media_type == "image":
        mime_type = "image/jpeg"  # หรือตรวจสอบจากนามสกุลไฟล์
    else:
        mime_type = "video/mp4"
    
    # Payload สำหรับอัพโหลด
    payload = {
        "message": {
            "attachment": {
                "type": media_type,
                "payload": {
                    "is_reusable": True
                }
            }
        }
    }
    
    # อ่านไฟล์และส่ง
    with open(file_path, 'rb') as f:
        files = {
            'filedata': (os.path.basename(file_path), f, mime_type)
        }
        
        response = requests.post(
            url,
            params={"access_token": access_token},
            data={"message": str(payload)},
            files=files
        )
    
    result = response.json()
    if "attachment_id" in result:
        return result["attachment_id"]
    else:
        print(f"❌ Upload failed: {result}")
        return None

def send_media_with_attachment_id(recipient_id: str, attachment_id: str, access_token: str = None):
    """ส่งสื่อโดยใช้ attachment_id ที่อัพโหลดไว้แล้ว"""
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "media",
                    "elements": [{
                        "media_type": "image",  # หรือ "video"
                        "attachment_id": attachment_id
                    }]
                }
            }
        },
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def send_media_from_base64(recipient_id: str, media_type: str, base64_data: str, filename: str, access_token: str = None):
    """ส่งรูปภาพหรือวิดีโอจาก base64 data"""
    import tempfile
    
    # แปลง base64 เป็นไฟล์ชั่วคราว
    base64_data = base64_data.split(',')[1] if ',' in base64_data else base64_data
    file_data = base64.b64decode(base64_data)
    
    # สร้างไฟล์ชั่วคราว
    suffix = os.path.splitext(filename)[1] or ('.jpg' if media_type == 'image' else '.mp4')
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(file_data)
        tmp_file_path = tmp_file.name
    
    try:
        # อัพโหลดไฟล์และรับ attachment_id
        attachment_id = upload_media_to_facebook(tmp_file_path, media_type, access_token)
        
        if attachment_id:
            # ส่งสื่อโดยใช้ attachment_id
            return send_media_with_attachment_id(recipient_id, attachment_id, access_token)
        else:
            # ถ้าอัพโหลดไม่สำเร็จ ลองส่งเป็น URL โดยตรง
            # ต้องมี URL ที่เข้าถึงได้จากภายนอก
            return {"error": "ไม่สามารถอัพโหลดไฟล์ได้"}
    finally:
        # ลบไฟล์ชั่วคราว
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)

def send_quick_reply(recipient_id: str, access_token: str = None):
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {
            "text": "คุณอยากทำอะไรต่อ?",
            "quick_replies": [
                {"content_type": "text", "title": "ดูสินค้า", "payload": "VIEW_PRODUCTS"},
                {"content_type": "text", "title": "ติดต่อแอดมิน", "payload": "CONTACT_ADMIN"}
            ]
        },
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

# Async versions for better performance
async def async_fb_get(session: aiohttp.ClientSession, endpoint: str, params: dict = {}, access_token: str = None):
    """Async version of fb_get for better performance"""
    params["access_token"] = access_token
    url = f"{FB_API_URL}/{endpoint}"
    
    async with session.get(url, params=params) as response:
        return await response.json()

async def batch_fb_requests(requests_data: list, access_token: str):
    """ส่ง batch requests เพื่อประสิทธิภาพที่ดีขึ้น"""
    batch_url = f"{FB_API_URL}/"
    
    batch_params = {
        "access_token": access_token,
        "batch": str(requests_data).replace("'", '"')
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(batch_url, data=batch_params) as response:
            return await response.json()

# เพิ่มฟังก์ชันนี้ใน facebook_api.py

def send_local_media_file(recipient_id: str, file_path: str, media_type: str, access_token: str):
    """ส่งไฟล์ media จาก local path โดยอัพโหลดไปที่ Facebook ก่อน"""
    try:
        # อัพโหลดไฟล์และรับ attachment_id
        attachment_id = upload_media_to_facebook(file_path, media_type, access_token)
        
        if attachment_id:
            # ส่งโดยใช้ attachment_id
            payload = {
                "messaging_type": "MESSAGE_TAG", 
                "recipient": {"id": recipient_id},
                "message": {
                    "attachment": {
                        "type": media_type,
                        "payload": {
                            "attachment_id": attachment_id
                        }
                    }
                },
                "tag": "CONFIRMED_EVENT_UPDATE"
            }
            return fb_post("me/messages", payload, access_token)
        else:
            return {"error": "Failed to upload media to Facebook"}
            
    except Exception as e:
        print(f"❌ Error in send_local_media_file: {e}")
        return {"error": str(e)}