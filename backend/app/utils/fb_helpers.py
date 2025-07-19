from datetime import datetime
import pytz

from backend.app.routes.facebook.facebook import get_user_info_from_psid, get_name_from_messages
from app.service.facebook_api import fb_get

bangkok_tz = pytz.timezone("Asia/Bangkok")


def fix_isoformat(dt_str: str) -> str:
    if dt_str[-5] in ['+', '-'] and dt_str[-3] != ':':
        dt_str = dt_str[:-2] + ':' + dt_str[-2:]
    return dt_str


def parse_datetime_bangkok(dt_str: str) -> datetime:
    """แปลง ISO 8601 string เป็น datetime ที่เป็น timezone Asia/Bangkok"""
    try:
        fixed_str = fix_isoformat(dt_str.replace("Z", "+00:00"))
        return datetime.fromisoformat(fixed_str).astimezone(bangkok_tz)
    except Exception as e:
        print(f"⚠️ Error parsing datetime: {dt_str} - {e}")
        return None


def process_conversation(convo, page_id, access_token, filter_start_date=None, filter_end_date=None):
    try:
        convo_id = convo.get("id")
        updated_time_str = convo.get("updated_time")
        participants = convo.get("participants", {}).get("data", [])
        messages = convo.get("messages", {}).get("data", [])

        if filter_start_date and updated_time_str:
            convo_time = parse_datetime_bangkok(updated_time_str)
            if convo_time is None or convo_time < filter_start_date or convo_time > filter_end_date:
                return {"skip": True}

        for participant in participants:
            participant_id = participant.get("id")
            if participant_id and participant_id != page_id:
                # ตรวจสอบข้อความของ user
                if not messages:
                    print(f"⚠️ ไม่มี messages ใน conversation {convo_id}")
                    return {"skip": True}

                user_messages = [m for m in messages if m.get("from", {}).get("id") == participant_id]
                sorted_messages = sorted(messages, key=lambda x: x.get("created_time") or "")

                first_msg_time = last_msg_time = updated_time_str
                if user_messages:
                    user_messages.sort(key=lambda x: x.get("created_time") or "")
                    first_msg_time = user_messages[0].get("created_time")
                    last_msg_time = user_messages[-1].get("created_time")
                elif sorted_messages:
                    first_msg_time = sorted_messages[0].get("created_time")
                    last_msg_time = sorted_messages[-1].get("created_time")

                # แปลงเวลา
                first_interaction = parse_datetime_bangkok(first_msg_time)
                last_interaction = parse_datetime_bangkok(last_msg_time)

                if not first_interaction:
                    first_interaction = parse_datetime_bangkok(updated_time_str) or datetime.now(bangkok_tz)
                if not last_interaction:
                    last_interaction = first_interaction

                # ดึงชื่อ
                user_name = participant.get("name")
                if not user_name:
                    user_info = get_user_info_from_psid(participant_id, access_token)
                    user_name = user_info.get("name")

                if not user_name or user_name.startswith("User"):
                    name_from_msg = get_name_from_messages(convo_id, access_token, page_id)
                    if name_from_msg:
                        user_name = name_from_msg

                if not user_name:
                    user_name = f"User...{participant_id[-8:]}"  # fallback

                return {
                    "data": {
                        "customer_psid": participant_id,
                        "name": user_name,
                        "first_interaction_at": first_interaction,
                        "last_interaction_at": last_interaction,
                    }
                }
        return {"skip": True}
    except Exception as e:
        print(f"❌ Error processing conversation {convo.get('id')}: {e}")
        return {"error": True}
