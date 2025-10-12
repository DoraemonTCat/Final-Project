import logging
from app.service.facebook_api import send_message, send_image_binary, send_video_binary
from app.config import image_dir, vid_dir
from app.database import crud
import requests

logger = logging.getLogger(__name__)

def send_facebook_message(
    db,
    page_id: str,
    psid: str,
    message: str = None,
    msg_type: str = "text",
    image_binary: bytes = None,
    access_token: str = None,
    is_system_message: bool = False,
    message_tag: str = None
):
    """
    ส่งข้อความหรือรูปภาพผ่าน Facebook Messenger
    - msg_type: "text" หรือ "image"
    - image_binary: ถ้าเป็นรูป ให้ใส่ binary
    """
    url = f"https://graph.facebook.com/v14.0/me/messages?access_token={access_token}"
    
    if msg_type == "text":
        if not message:
            raise ValueError("ข้อความว่าง")
        data = {
            "recipient": {"id": psid},
            "message": {"text": message},
        }
        if message_tag:
            data["tag"] = message_tag
        resp = requests.post(url, json=data)
    
    elif msg_type == "image":
        if not image_binary:
            raise ValueError("ไม่มีรูปภาพให้ส่ง")
        # 🚀 multipart/form-data สำหรับไฟล์
        data = {
            "recipient": '{"id":"%s"}' % psid,
            "message": '{"attachment":{"type":"image","payload":{}}}'
        }
        files = {
            "filedata": ("image.jpg", image_binary, "image/jpeg")
        }
        if message_tag:
            data["tag"] = message_tag
        resp = requests.post(url, data=data, files=files)
    
    else:
        raise ValueError(f"Unsupported msg_type={msg_type}")

    result = resp.json()
    return result