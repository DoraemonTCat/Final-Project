import requests

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
    payload = {
        "messaging_type": "MESSAGE_TAG",
        "recipient": {"id": recipient_id},
        "message": {"text": message_text},
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
