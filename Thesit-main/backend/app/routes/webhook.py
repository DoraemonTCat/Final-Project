from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from app.routes.facebook import send_message
import os

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == os.getenv("VERIFY_TOKEN"):
        return PlainTextResponse(content=params.get("hub.challenge"), status_code=200)
    return PlainTextResponse(content="Verification failed", status_code=403)

@router.post("/webhook")
async def webhook_post(request: Request):
    body = await request.json()
    for entry in body.get("entry", []):
        for msg_event in entry.get("messaging", []):
            sender = msg_event["sender"]["id"]
            if "message" in msg_event and "text" in msg_event["message"]:
                text = msg_event["message"]["text"]
                send_message(sender, f"คุณพิมพ์ว่า: {text}")
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)