import asyncio
from celery import group
from datetime import datetime
from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.database import crud, models
from app.service.facebook_api import fb_get
from app.service.auto_sync_service import auto_sync_service
from app.celery_task.customer_tasks import handle_new_customer_task, handle_existing_customer_task
from app.utils.redis_helper import get_page_token
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def sync_all_pages_task(self, page_id: str):
    """
    Task หลัก: ดึงข้อมูลทุกเพจ (เรียก subtask สำหรับแต่ละเพจ)
    """
    db = SessionLocal()
    try:
        pages = db.query(models.FacebookPage).all()
        logger.info(f"🚀 Celery started syncing {len(pages)} pages")

        print(f"🔍 Step 1: Fetching token from Redis for page_id={page_id}")
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")

        for page in pages:
            token_entry = auto_sync_service.page_tokens.get(page.page_id)
            if not token_entry:
                logger.warning(f"⚠️ No token found for page_id={page.page_id}")
                continue

            sync_page_conversations_task.delay(page.page_id, token_entry)

        return {"status": "scheduled", "page_count": len(pages)}
    finally:
        db.close()


@celery_app.task(bind=True)
def sync_page_conversations_task(self, page_id: str, access_token: str):
    """
    Task: ดึง conversations ของเพจเดียว แล้วส่งไป process_conversation_task
    """
    db = SessionLocal()
    try:
        logger.info(f"🔁 Syncing page {page_id}")

        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"Page not found: {page_id}"}

        endpoint = f"{page_id}/conversations"
        params = {
            "fields": "participants,updated_time,id,messages.limit(10){created_time,from,message,id}",
            "limit": 100
        }

        print(f"🔍 Step 1: Fetching token from Redis for page_id={page_id}")
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")


        result = fb_get(endpoint, params, access_token)
        if "error" in result:
            return {"error": result["error"]}

        conversations = result.get("data", [])
        logger.info(f"📨 Found {len(conversations)} conversations for page {page_id}")

        job_group = group(
            process_conversation_task.s(convo, page_id, access_token)
            for convo in conversations
        )
        result_group = job_group.apply_async()

        return {"status": "queued", "page_id": page_id, "conversation_count": len(conversations)}

    except Exception as e:
        logger.error(f"❌ Error syncing page {page_id}: {e}")
        raise
    finally:
        db.close()

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def process_participant_task(self, participant_data, page_id, convo_id, access_token):
    """
    ประมวลผลลูกค้าแต่ละคน (participant)
    """
    db = SessionLocal()
    try:
        participant_id = participant_data.get("id")
        name = participant_data.get("name")

        logger.info(f"👤 [Participant] Processing {name} ({participant_id})")

        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"page_id {page_id} not found"}
        
        print(f"🔍 Step 1: Fetching token from Redis for page_id={page_id}")
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")


        existing = crud.get_customer_by_psid(db, page.ID, participant_id)
        if existing:
            # ✅ ลูกค้าเก่า → ให้ Celery จัดการอัปเดต
            msg_time = datetime.now().isoformat()
            handle_existing_customer_task.delay(page_id, participant_id, msg_time)
            logger.info(f"📝 Queued existing customer update for {participant_id}")
        else:
            # 🆕 ลูกค้าใหม่ → ให้ Celery จัดการสร้าง
            handle_new_customer_task.delay(page_id, participant_id, name, convo_id, access_token)
            logger.info(f"🆕 Queued new customer creation for {participant_id}")

        return {"status": "queued", "participant": participant_id}

    except Exception as e:
        logger.error(f"❌ Error processing participant {participant_data}: {e}")
        raise
    finally:
        db.close()

# ✅ Task ระดับ conversation
@celery_app.task(bind=True)
def process_conversation_task(self, convo_data, page_id, access_token):
    """
    ประมวลผลแต่ละ conversation (เรียก task ลูกค้าแต่ละคน)
    """
    try:
        print(f"🔍 Step 1: Fetching token from Redis for page_id={page_id}")
        access_token = get_page_token(page_id)

        if not access_token:
            print(f"❌ Step 1 Failed: No access_token found for page_id={page_id}")
            return {"status": "error", "message": f"No access_token for page_id={page_id}"}
        
        print(f"✅ Step 1 Success: Token found for page_id={page_id}")

        convo_id = convo_data.get("id")
        participants = convo_data.get("participants", {}).get("data", [])

        logger.info(f"💬 [Conversation] Processing {convo_id} ({len(participants)} participants)")

        from celery import group

        job_group = group(
            process_participant_task.s(participant, page_id, convo_id, access_token)
            for participant in participants
            if participant.get("id") and participant.get("id") != page_id
        )

        result = job_group.apply_async()
        logger.info(f"📤 Dispatched {len(participants)} participant tasks for convo={convo_id}")

        return {"status": "queued", "convo_id": convo_id, "participants": len(participants)}
    except Exception as e:
        logger.error(f"❌ Error processing conversation {convo_data}: {e}")
        raise