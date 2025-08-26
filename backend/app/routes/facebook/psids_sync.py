from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import pytz
import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.service.facebook_api import fb_get
from .auth import get_page_tokens

"""
   -ใช้สำหรับดึงข้อมูลข้อความจาก Facebook มาเก็บในตาราง customer_messages
"""

router = APIRouter()
bangkok_tz = pytz.timezone("Asia/Bangkok")

import traceback


def parse_fb_time_to_dt(s: Optional[str]) -> Optional[datetime]:
    """
    Parse Facebook time like '2025-08-05T12:23:45+0000' or '...Z' to aware datetime (UTC).
    Returns datetime in UTC tzinfo.
    """
    if not s:
        return None
    try:
        s2 = s.replace("Z", "+00:00")
        # handle +0000 or -0700 -> +00:00 style
        if len(s2) >= 5 and (s2[-5] in ["+", "-"]) and (s2[-2] != ":"):
            s2 = s2[:-2] + ":" + s2[-2:]
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(pytz.utc)
    except Exception:
        try:
            return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z").astimezone(pytz.utc)
        except Exception:
            print(f"⚠️ parse_fb_time_to_dt failed for: {s}")
            return None

def to_bkk(dt_utc: Optional[datetime]) -> Optional[datetime]:
    if not dt_utc:
        return None
    if dt_utc.tzinfo is None:
        dt_utc = pytz.utc.localize(dt_utc)
    return dt_utc.astimezone(bangkok_tz)

def get_recent_conversations(page_id: str, access_token: str, since_iso: str) -> List[Dict[str, Any]]:
    """
    Return list of conversation dicts updated >= since_iso.
    Uses fb_get and follows basic paging.
    """
    endpoint = f"{page_id}/conversations"
    params = {
        "fields": "participants,updated_time,id",
        "limit": 100
    }

    try:
        page = fb_get(endpoint, params, access_token)
    except Exception as e:
        print("❌ fb_get failed for conversations:", e)
        return []

    if not page or "error" in page:
        print("❌ Error getting conversations:", page.get("error") if page else "no result")
        return []

    all_convos = []
    since_dt = parse_fb_time_to_dt(since_iso)

    # iterate pages
    while True:
        data = page.get("data", []) if isinstance(page, dict) else []
        for convo in data:
            ut = convo.get("updated_time")
            ut_dt = parse_fb_time_to_dt(ut)
            if ut_dt and since_dt and ut_dt >= since_dt:
                all_convos.append(convo)
        paging = page.get("paging", {}) if isinstance(page, dict) else {}
        next_url = paging.get("next")
        if not next_url:
            break
        # assume fb_get accepts full next-url
        page = fb_get(next_url, {}, access_token)
        if not page or "error" in page:
            print("❌ Error paging conversations:", page.get("error") if page else "no page")
            break

    print(f"✅ Found {len(all_convos)} conversations updated since {since_iso}")
    return all_convos

def fetch_all_messages_for_conversation(convo_id: str, access_token: str, since_dt_utc: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """
    Fetch messages for a conversation (paginate), but try to stop early when pages are older than since_dt_utc.
    - since_dt_utc should be an aware datetime in UTC (or None to fetch all)
    """
    messages: List[Dict[str, Any]] = []
    endpoint = f"{convo_id}/messages"
    params = {"fields": "created_time,from,message,attachments", "limit": 50}

    try:
        page = fb_get(endpoint, params, access_token)
    except Exception as e:
        print("❌ fb_get failed for messages:", e)
        return messages

    if not page or "error" in page:
        print("❌ Error fetching messages for convo", convo_id, page.get("error") if page else "no result")
        return messages

    while True:
        data = page.get("data", []) if isinstance(page, dict) else []
        if not data:
            break

        # Append items that are >= since_dt_utc (if provided)
        for item in data:
            created = parse_fb_time_to_dt(item.get("created_time"))
            # if no created time, keep it (or skip, your choice)
            if since_dt_utc and created and created < since_dt_utc:
                # skip this message (too old)
                continue
            messages.append(item)

        # If since_dt_utc is set, and the *oldest* message in this page is older than since_dt_utc,
        # and messages are returned newest-first, we can break early to avoid paging more.
        if since_dt_utc:
            # find the minimum created time in this page (ignore None)
            created_times = [parse_fb_time_to_dt(it.get("created_time")) for it in data if it.get("created_time")]
            if created_times:
                oldest_in_page = min(created_times)
                if oldest_in_page < since_dt_utc:
                    # it's possible some items in page were new and appended above;
                    # but further pages will be even older → safe to stop paging
                    break

        # Cursor-based paging (safer than using full next URL)
        paging = page.get("paging", {}) if isinstance(page, dict) else {}
        cursors = paging.get("cursors", {}) or {}
        after = cursors.get("after")
        if not after:
            break

        try:
            page = fb_get(endpoint, {**params, "after": after}, access_token)
        except Exception as e:
            print("❌ paging fallback failed:", e)
            break

        if not page or "error" in page:
            print("❌ Error paging messages:", page.get("error") if page else "no page")
            break

    return messages

def lookup_customer_id(db: Session, page_db_id: int, customer_psid: str) -> Optional[int]:
    """
    Lookup fb_customers.id by (page_id (DB PK), customer_psid).
    Returns None if not found.
    """
    sql = text(
        'SELECT id FROM fb_customers WHERE page_id = :page_db_id AND customer_psid = :psid LIMIT 1'
    )
    r = db.execute(sql, {"page_db_id": page_db_id, "psid": customer_psid}).fetchone()
    return int(r[0]) if r else None

def insert_customer_messages_from_conversations(
    db: Session,
    page_id_str: str,
    access_token: str,
    since_iso: str,
    batch_size: int = 200
) -> Dict[str, int]:

    page_row = db.execute(text('SELECT "ID", page_id FROM facebook_pages WHERE page_id = :pid LIMIT 1'), {"pid": page_id_str}).fetchone()
    if not page_row:
        raise RuntimeError(f"page_id {page_id_str} not found in facebook_pages")
    page_db_id = int(page_row[0])

    convos = get_recent_conversations(page_id_str, access_token, since_iso)
    if not convos:
        return {"inserted_messages": 0, "skipped_existing": 0, "conversations": 0}

    # convert once
    since_dt_utc = parse_fb_time_to_dt(since_iso)

    inserted_messages = 0
    skipped_existing = 0
    batch_values: List[Dict[str, Any]] = []

    for convo in convos:
        convo_id = convo.get("id")

        # pass since_dt_utc into fetch_all_messages_for_conversation so it only returns messages >= since_dt_utc
        msgs = fetch_all_messages_for_conversation(convo_id, access_token, since_dt_utc)
        if not msgs:
            continue

        # process chronologically (oldest first) so timeline insert order makes sense
        msgs_sorted = sorted(msgs, key=lambda m: m.get("created_time") or "")

        for m in msgs_sorted:
            created_raw = m.get("created_time")
            created_dt_utc = parse_fb_time_to_dt(created_raw)
            if not created_dt_utc:
                continue

            # final safety: skip messages older than since_dt_utc
            if since_dt_utc and created_dt_utc < since_dt_utc:
                continue

            created_bkk = to_bkk(created_dt_utc)

            sender = m.get("from") or {}
            sender_id = sender.get("id")
            sender_name = sender.get("name") or (f"User...{sender_id[-8:]}" if sender_id else "Unknown")

            message_text = get_message_content(m) or ""
            # determine message_type: text vs attachment vs unknown
            if m.get("message"):
                message_type = "text"
            elif message_text:
                message_type = "attachment"
            else:
                message_type = "unknown"

            customer_id = None
            if sender_id and sender_id != page_id_str:
                customer_id = lookup_customer_id(db, page_db_id, sender_id)

            # dedupe check: conversation_id + sender_id + created_at
            check_sql = text("""
                SELECT 1 FROM customer_messages
                WHERE conversation_id = :convo_id
                AND sender_id = :sender_id
                AND created_at = :created_at
                LIMIT 1
            """)
            exists = db.execute(check_sql, {
                "convo_id": convo_id,
                "sender_id": sender_id,
                "created_at": created_bkk
            }).fetchone()
            if exists:
                skipped_existing += 1
                continue

            batch_values.append({
                "customer_id": customer_id,
                "conversation_id": convo_id,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "message_text": message_text,
                "message_type": message_type,
                "created_at": created_bkk
            })

            if len(batch_values) >= batch_size:
                insert_sql = text("""
                    INSERT INTO customer_messages
                    (customer_id, conversation_id, sender_id, sender_name, message_text, message_type, created_at)
                    VALUES
                    (:customer_id, :conversation_id, :sender_id, :sender_name, :message_text, :message_type, :created_at)
                """)
                db.execute(insert_sql, batch_values)
                db.commit()
                inserted_messages += len(batch_values)
                batch_values = []

    # final flush
    if batch_values:
        insert_sql = text("""
            INSERT INTO customer_messages
            (customer_id, conversation_id, sender_id, sender_name, message_text, message_type, created_at)
            VALUES
            (:customer_id, :conversation_id, :sender_id, :sender_name, :message_text, :message_type, :created_at)
        """)
        db.execute(insert_sql, batch_values)
        db.commit()
        inserted_messages += len(batch_values)

    return {
        "inserted_messages": inserted_messages,
        "skipped_existing": skipped_existing,
        "conversations": len(convos)
    }

def get_message_content(message: Dict[str, Any]) -> Optional[str]:
    """Return text message or best-effort attachment info (URL(s) or JSON metadata)."""
    # prefer plain text
    if "message" in message and message["message"]:
        return message["message"]

    attachments = message.get("attachments")
    if not attachments:
        return None

    urls = []
    meta_items = []

    # normalize attachments into an iterable
    if isinstance(attachments, dict) and "data" in attachments:
        items = attachments["data"]
    elif isinstance(attachments, list):
        items = attachments
    elif isinstance(attachments, str):
        # sometimes API gives a direct url string (rare)
        urls.append(attachments)
        items = []
    else:
        items = [attachments]

    for att in items:
        if isinstance(att, dict):
            # common locations for url-like fields
            payload = att.get("payload") or {}
            # payload may contain 'url' or 'src' or nested media
            url = payload.get("url") or payload.get("src") or att.get("url")
            if not url:
                # look for image_data / video_data keys (store metadata)
                # try image_data -> maybe has 'uri' or 'preview' fields
                img = att.get("image_data") or att.get("video_data") or {}
                if isinstance(img, dict):
                    for k in ("url", "uri", "preview_url", "src"):
                        maybe = img.get(k)
                        if isinstance(maybe, str):
                            url = maybe
                            break
            if url:
                urls.append(url)
            else:
                # no direct url found — preserve whole attachment metadata
                meta_items.append(att)
        elif isinstance(att, str):
            urls.append(att)
        else:
            meta_items.append(att)

    if urls:
        return ", ".join(urls)
    if meta_items:
        # store JSON of metadata so you can inspect / replay later
        try:
            return json.dumps(meta_items, ensure_ascii=False)
        except Exception:
            return str(meta_items)
    return None

@router.get("/psids/{page_id}/sync-messages")
async def sync_messages_for_page(page_id: str, db: Session = Depends(get_db)):
    print(f"🔄 Start sync messages for page_id: {page_id}")

    page_tokens = get_page_tokens()
    access_token = page_tokens.get(page_id)
    if not access_token:
        return JSONResponse(status_code=400, content={"error": f"access_token not found for page_id {page_id}"})

    now_bkk = datetime.now(bangkok_tz)
    since_dt = now_bkk - timedelta(hours=72)
    since_utc = since_dt.astimezone(pytz.utc)
    since_iso = since_utc.isoformat()

    try:
        stats = insert_customer_messages_from_conversations(db, page_id, access_token, since_iso)
        return JSONResponse(content={"status": "ok", "stats": stats})
    except Exception as e:
        print("❌ sync error:", e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})