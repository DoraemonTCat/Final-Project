import requests
from urllib.parse import urlparse
import json
import os
from tempfile import NamedTemporaryFile

FB_API_URL = "https://graph.facebook.com/v14.0"

def fix_nested_image_url(bad_url: str) -> str:
    # ตัดเอาเฉพาะชื่อไฟล์ภาพ
    filename = bad_url.split("/")[-1]

    # ต่อกลับด้วยโดเมนจริง
    fixed_url = f"https://species-recognition-classification-offices.trycloudflare.com/images/{filename}"
    return fixed_url

bad_url = "https://species-recognition-classification-offices.trycloudflare.com/images/http://localhost:8000/images/http://localhost:8000/images/363047604_602577392060963_682296264272086191_n.jpg"
clean_url = fix_nested_image_url(bad_url)

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

def send_image_file_from_db(recipient_id: str, image_binary: bytes, filename: str, access_token: str):
    url = f"https://graph.facebook.com/v14.0/me/messages"
    params = {
        "access_token": access_token
    }
    data = {
        "recipient": '{"id":"%s"}' % recipient_id,
        "message": '{"attachment":{"type":"image", "payload":{}}}'
    }
    files = {
        'filedata': (filename, image_binary, 'image/jpeg')  # เปลี่ยน content type ตามไฟล์จริง
    }
    response = requests.post(url, params=params, data=data, files=files)
    print(f"Response Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.json()

def send_message(recipient_id: str, message_text: str, access_token: str = None):
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {"text": message_text},
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def send_image_binary(recipient_id: str, filepath: str, access_token: str):
    prefix = "http://localhost:8000/images/"
    # ตัด prefix ออกหมดเลย (ถ้ามีซ้ำๆก็หมด)
    filepath = filepath.replace(prefix, "")

    base_dir = "C:/Users/peemn/OneDrive/รูปภาพ/"
    full_path = os.path.join(base_dir, filepath)

    print("เปิดไฟล์จาก:", full_path)

    url = f"https://graph.facebook.com/v14.0/me/messages?access_token={access_token}"
    filename = os.path.basename(full_path)

    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "image",
                "payload": {}
            }
        },
        "messaging_type": "MESSAGE_TAG",
        "tag": "CONFIRMED_EVENT_UPDATE"
    }

    data = {
        'message': json.dumps(payload['message']),
        'recipient': json.dumps(payload['recipient']),
        'messaging_type': payload['messaging_type'],
        'tag': payload['tag'],
    }

    with open(full_path, 'rb') as f:
        files = {
            'filedata': (filename, f, 'image/jpeg')
        }
        response = requests.post(url, data=data, files=files)

    return response.json()

def send_image(recipient_id: str, filename: str, access_token: str):
    # ✅ แก้ให้ใช้ URL เดียว ไม่มีซ้ำ
    image_url = fix_nested_image_url(bad_url)
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "image",
                "payload": {
                    "url": image_url,
                    "is_reusable": True
                }
            }
        },
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def send_video_binary(recipient_id: str, filepath: str, access_token: str):
    prefix = "http://localhost:8000/videos/"
    # ตัด prefix ออกหมดเลย (ถ้ามี)
    filepath = filepath.replace(prefix, "")

    base_dir = "C:/Users/peemn/Videos/"
    full_path = os.path.join(base_dir, filepath)

    print("เปิดไฟล์จาก:", full_path)

    url = f"https://graph.facebook.com/v14.0/me/messages?access_token={access_token}"
    filename = os.path.basename(full_path)

    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "video",
                "payload": {}
            }
        },
        "messaging_type": "MESSAGE_TAG",
        "tag": "CONFIRMED_EVENT_UPDATE"
    }

    data = {
        'message': json.dumps(payload['message']),
        'recipient': json.dumps(payload['recipient']),
        'messaging_type': payload['messaging_type'],
        'tag': payload['tag'],
    }

    with open(full_path, 'rb') as f:
        files = {
            'filedata': (filename, f, 'video/mp4')  # MIME type video/mp4
        }
        response = requests.post(url, data=data, files=files)

    return response.json()

def send_video(recipient_id: str, video_url: str, access_token: str):
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "video",
                "payload": {
                    "url": str(video_url),  # ✅ เพิ่ม str() ตรงนี้เช่นกัน
                    "is_reusable": True
                }
            }
        },
        "tag": "CONFIRMED_EVENT_UPDATE"
    }
    return fb_post("me/messages", payload, access_token)

def send_media(recipient_id: str, media_type: str, media_url: str, access_token: str = None):
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