from typing import Dict, Any
import logging
from datetime import datetime, timedelta
from typing import Optional
import pytz

from .conversations import get_user_info_from_psid, get_name_from_messages

logger = logging.getLogger(__name__)

bangkok_tz = pytz.timezone("Asia/Bangkok")

def fix_isoformat(dt_str: str) -> str:
    """แก้ไข ISO format string ให้ถูกต้อง"""
    if dt_str[-5] in ['+', '-'] and dt_str[-3] != ':':
        dt_str = dt_str[:-2] + ':' + dt_str[-2:]
    return dt_str


def get_conversation_psids(conversations_data: list, page_id: str) -> list:
    """ดึง PSIDs จาก conversations data"""
    psids = []
    for conv in conversations_data:
        participants = conv.get('participants', {}).get('data', [])
        for participant in participants:
            pid = participant.get('id')
            if pid and pid != page_id:
                psids.append(pid)
    return psids


def format_customer_data(customer: Any) -> Dict[str, Any]:
    """Format customer data for API response"""
    return {
        "id": customer.id,
        "psid": customer.customer_psid,
        "name": customer.name or f"User...{customer.customer_psid[-8:]}",
        "first_interaction": customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
        "last_interaction": customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
        "customer_type": customer.customer_type_custom.type_name if customer.customer_type_custom else None,
        "source_type": customer.source_type
    }


def log_api_error(endpoint: str, error: Any):
    """Log API errors with context"""
    logger.error(f"API Error at {endpoint}: {str(error)}")
    if hasattr(error, 'response'):
        logger.error(f"Response: {error.response}")
    if hasattr(error, 'request'):
        logger.error(f"Request: {error.request}")


def validate_page_access(page_id: str, page_tokens: Dict[str, str]) -> tuple[bool, str]:
    """ตรวจสอบสิทธิ์การเข้าถึง page"""
    if not page_id:
        return False, "Page ID is required"
    
    if page_id not in page_tokens:
        return False, f"No access token for page {page_id}"
    
    return True, "OK"

# utils_facebook.py (หรือใน module เดียวกันก็ได้)
def calculate_filter_dates(period: Optional[str], start_date: Optional[str], end_date: Optional[str]):
    now = datetime.now(bangkok_tz)
    if period:
        periods = {
            "today": now.replace(hour=0, minute=0, second=0, microsecond=0),
            "week": now - timedelta(days=7),
            "month": now - timedelta(days=30),
            "3months": now - timedelta(days=90),
            "6months": now - timedelta(days=180),
            "year": now - timedelta(days=365),
        }
        return periods.get(period), now
    elif start_date and end_date:
        return (
            bangkok_tz.localize(datetime.fromisoformat(start_date)),
            bangkok_tz.localize(datetime.fromisoformat(end_date))
        )
    return None, None


def parse_iso_datetime(date_str: str) -> Optional[datetime]:
    try:
        fixed_str = fix_isoformat(date_str.replace("Z", "+00:00"))
        return datetime.fromisoformat(fixed_str).astimezone(bangkok_tz)
    except Exception as e:
        print(f"⚠️ แปลงเวลาไม่ได้: {date_str} - {e}")
        return None


def build_customer_data(participant_id, user_name, first_msg_time, last_msg_time, updated_time, installed_at, page_id, access_token, convo_id) -> Optional[dict]:
    first_interaction = parse_iso_datetime(first_msg_time) if first_msg_time else None
    last_interaction = parse_iso_datetime(last_msg_time) if last_msg_time else None

    if not first_interaction:
        first_interaction = parse_iso_datetime(updated_time)

    if not last_interaction:
        last_interaction = first_interaction

    one_year_ago = datetime.now(bangkok_tz) - timedelta(days=365)
    min_valid_date = max(one_year_ago, installed_at)

    if last_interaction and last_interaction < min_valid_date:
        print(f"⏳ ข้ามข้อมูลเก่า last_interaction: {last_interaction} < {min_valid_date}")
        return None

    if not user_name:
        user_info = get_user_info_from_psid(participant_id, access_token)
        user_name = user_info.get("name")

    if not user_name or user_name.startswith("User"):
        user_name = get_name_from_messages(convo_id, access_token, page_id) or f"User...{participant_id[-8:]}"

    source_type = "new" if first_interaction >= installed_at else "imported"

    return {
        'customer_psid': participant_id,
        'name': user_name,
        'first_interaction_at': first_interaction,
        'last_interaction_at': last_interaction,
        'source_type': source_type
    }

def build_historical_customer_data(
    participant_id: str,
    user_name: Optional[str],
    first_msg_time: Optional[str],
    last_msg_time: Optional[str],
    updated_time: str,
    installed_at: datetime,
    page_id: str,
    access_token: str,
    convo_id: str
) -> Optional[dict]:
    """สร้างข้อมูลลูกค้าที่มาจากการ sync ย้อนหลัง โดยไม่สนใจเวลาปัจจุบัน 1 ปี"""
    
    # แปลงเวลา
    first_interaction = parse_iso_datetime(first_msg_time) if first_msg_time else None
    last_interaction = parse_iso_datetime(last_msg_time) if last_msg_time else None

    if not first_interaction:
        first_interaction = parse_iso_datetime(updated_time)
    if not last_interaction:
        last_interaction = first_interaction

    # ดึงชื่อ ถ้ายังไม่มี
    if not user_name:
        user_info = get_user_info_from_psid(participant_id, access_token)
        user_name = user_info.get("name")

    if not user_name or user_name.startswith("User"):
        user_name = get_name_from_messages(convo_id, access_token, page_id) or f"User...{participant_id[-8:]}"
    
    # ตั้ง source_type เป็น 'imported' เสมอเพราะมาจากการย้อนหลัง
    return {
        'customer_psid': participant_id,
        'name': user_name,
        'first_interaction_at': first_interaction,
        'last_interaction_at': last_interaction,
        'source_type': 'imported'
    }