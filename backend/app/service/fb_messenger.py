import logging
from app.service.facebook_api import send_image_binary_from_db
from app.config import image_dir, vid_dir
from app.database import crud
import requests
import json
import io

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
    message_tag: str = "CONFIRMED_EVENT_UPDATE"
):
    """
    ส่งข้อความหรือรูป (binary) ไปยัง Facebook Messenger API
    """
    url = f"https://graph.facebook.com/v14.0/me/messages?access_token={access_token}"

    if msg_type == "image":
        # ✅ ส่งรูปแบบ binary โดยตรง
        if not image_binary:
            return {"error": "⚠️ No image binary data provided"}

        data = {
            "recipient": json.dumps({"id": psid}),
            "message": json.dumps({
                "attachment": {"type": "image", "payload": {}}
            }),
            "messaging_type": "MESSAGE_TAG",
            "tag": message_tag
        }

        files = {
            "filedata": ("image.jpg", io.BytesIO(image_binary), "image/jpeg")
        }

        logger.info(f"🖼 Sending image ({len(image_binary)} bytes) to PSID={psid}")
        response = requests.post(url, data=data, files=files)

    else:
        # ✅ ส่งข้อความธรรมดา
        payload = {
            "recipient": {"id": psid},
            "message": {"text": message},
            "messaging_type": "MESSAGE_TAG",
            "tag": message_tag
        }
        logger.info(f"💬 Sending text: '{message}' to PSID={psid}")
        response = requests.post(url, json=payload)

    result = response.json()
    logger.info(f"📩 Facebook response: {result}")
    return result