from fastapi import APIRouter, Request, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from app.database import crud, models
from app.database.database import get_db
from sqlalchemy.orm import Session
from datetime import datetime
import os
from app.service.facebook_api import fb_get
import logging
import asyncio
from typing import Dict, List, Optional, Any

router = APIRouter()
logger = logging.getLogger(__name__)

# Cache for new user notifications
new_user_notifications: Dict[str, List[Dict[str, Any]]] = {}

# =============== Helper Functions ===============
def cleanup_old_notifications(page_id: str):
    """Remove notifications older than 24 hours"""
    if page_id not in new_user_notifications:
        return
    
    cutoff_time = datetime.now().timestamp() - (24 * 60 * 60)
    new_user_notifications[page_id] = [
        notif for notif in new_user_notifications[page_id]
        if datetime.fromisoformat(notif['timestamp']).timestamp() > cutoff_time
    ]

def add_notification(page_id: str, user_data: Dict[str, Any]):
    """Add new user notification"""
    if page_id not in new_user_notifications:
        new_user_notifications[page_id] = []
    
    new_user_notifications[page_id].append({
        'user_name': user_data.get('name', ''),
        'psid': user_data.get('psid', ''),
        'timestamp': datetime.now().isoformat(),
        'profile_pic': user_data.get('profile_pic', '')
    })
    
    cleanup_old_notifications(page_id)

async def sync_new_user_data(
    page_id: str,
    sender_id: str,
    page_db_id: int,
    db: Session
) -> Optional[models.FbCustomer]:
    """
    Sync new user data with optimized API calls
    User ที่เข้ามาทาง webhook = User ใหม่ = source_type='new'
    """
    try:
        from app.routes.facebook.auth import get_page_tokens
        
        page_tokens = get_page_tokens()
        access_token = page_tokens.get(page_id)
        
        if not access_token:
            logger.error(f"No access token for page {page_id}")
            return None
        
        # Fetch user profile
        user_fields = "id,name,first_name,last_name,profile_pic,gender,locale,timezone"
        user_info = fb_get(sender_id, {"fields": user_fields}, access_token)
        
        # Get user name
        user_name = user_info.get("name", "")
        if not user_name:
            user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
        
        # Get conversation data
        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(100){created_time,from}",
            "user_id": sender_id,
            "limit": 1
        }
        
        conversations = fb_get(endpoint, params, access_token)
        
        # Determine interaction times
        first_interaction = datetime.now()
        last_interaction = datetime.now()
        
        if conversations and "data" in conversations and conversations["data"]:
            conv = conversations["data"][0]
            
            # Find first user message
            if "messages" in conv and "data" in conv["messages"]:
                user_messages = [
                    msg for msg in conv["messages"]["data"]
                    if msg.get("from", {}).get("id") == sender_id
                ]
                
                if user_messages:
                    user_messages.sort(key=lambda x: x.get("created_time", ""))
                    
                    # Parse first message time
                    first_msg_time = user_messages[0].get("created_time")
                    if first_msg_time:
                        try:
                            first_interaction = datetime.fromisoformat(
                                first_msg_time.replace('Z', '+00:00')
                            )
                        except:
                            pass
                    
                    # Parse last message time
                    last_msg_time = user_messages[-1].get("created_time")
                    if last_msg_time:
                        try:
                            last_interaction = datetime.fromisoformat(
                                last_msg_time.replace('Z', '+00:00')
                            )
                        except:
                            pass
        
        # ✅ User ที่เข้ามาทาง webhook = User ใหม่ที่ทักหลังติดตั้งเว็บ
        # จึงกำหนด source_type='new' เสมอ
        customer_data = {
            'name': user_name or f"User...{sender_id[-8:]}",
            'first_interaction_at': first_interaction,
            'last_interaction_at': last_interaction,
            'source_type': 'new',  # ✅ User ใหม่เสมอ
            'profile_pic': user_info.get('profile_pic', ''),
        }
        
        # Save to database
        customer = crud.create_or_update_customer(db, page_db_id, sender_id, customer_data)
        
        logger.info(f"✅ Auto sync successful for NEW user: {user_name} ({sender_id})")
        
        # Add notification
        add_notification(page_id, {
            'name': user_name,
            'psid': sender_id,
            'profile_pic': user_info.get('profile_pic', '')
        })
        
        # Send SSE update
        await send_sse_update(page_id, sender_id, customer_data, 'new')
        
        return customer
        
    except Exception as e:
        logger.error(f"Error syncing new user data: {e}")
        return None

async def send_sse_update(
    page_id: str,
    sender_id: str,
    customer_data: Dict[str, Any],
    action: str
):
    """Send SSE update for customer changes"""
    try:
        from app.routes.facebook.sse import customer_type_update_queue
        
        update_data = {
            'page_id': page_id,
            'psid': sender_id,
            'name': customer_data.get('name', ''),
            'first_interaction': customer_data.get('first_interaction_at', '').isoformat() if isinstance(customer_data.get('first_interaction_at'), datetime) else None,
            'last_interaction': customer_data.get('last_interaction_at', '').isoformat() if isinstance(customer_data.get('last_interaction_at'), datetime) else None,
            'source_type': customer_data.get('source_type', 'new'),
            'action': action,
            'timestamp': datetime.now().isoformat()
        }
        
        await customer_type_update_queue.put(update_data)
        logger.info(f"📡 Sent SSE update for {action}: {sender_id}")
        
    except Exception as e:
        logger.error(f"Error sending SSE update: {e}")


# =============== API Endpoints ===============
@router.get("/webhook")
async def verify_webhook(request: Request):
    """Verify webhook endpoint for Facebook"""
    params = request.query_params
    if (params.get("hub.mode") == "subscribe" and 
        params.get("hub.verify_token") == os.getenv("VERIFY_TOKEN")):
        return PlainTextResponse(content=params.get("hub.challenge"), status_code=200)
    return PlainTextResponse(content="Verification failed", status_code=403)

@router.post("/webhook")
async def webhook_post(
    request: Request, 
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Handle webhook events from Facebook"""
    body = await request.json()
    
    for entry in body.get("entry", []):
        page_id = entry.get("id")
        
        if not page_id:
            continue
            
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            continue
        
        for msg_event in entry.get("messaging", []):
            sender_id = msg_event["sender"]["id"]
            
            # Skip if sender is the page itself
            if sender_id == page_id:
                continue
            
            try:
                existing_customer = crud.get_customer_by_psid(db, page.ID, sender_id)
                
                if not existing_customer:
                    # New user - sync in background
                    logger.info(f"🆕 New user detected: {sender_id} in page {page.page_name}")
                    background_tasks.add_task(
                        sync_new_user_data,
                        page_id,
                        sender_id,
                        page.ID,
                        db
                    )
                else:
                    # Existing user - update interaction
                    crud.update_customer_interaction(db, page.ID, sender_id)
                    logger.info(f"📝 Updated interaction for: {existing_customer.name}")
                    
                   
            
            except Exception as e:
                logger.error(f"Error processing webhook: {e}")
    
    return PlainTextResponse("EVENT_RECEIVED", status_code=200)

@router.get("/new-user-notifications/{page_id}")
async def get_new_user_notifications(page_id: str):
    """Get new user notifications for the last 24 hours"""
    cleanup_old_notifications(page_id)
    notifications = new_user_notifications.get(page_id, [])
    
    return {
        "page_id": page_id,
        "new_users": notifications,
        "count": len(notifications)
    }