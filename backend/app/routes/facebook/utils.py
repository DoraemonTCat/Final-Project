from typing import Dict, Any
import logging
from datetime import datetime, timedelta
from typing import Optional
import pytz

from .conversations import get_user_info_from_psid, get_name_from_messages

logger = logging.getLogger(__name__)

bangkok_tz = pytz.timezone("Asia/Bangkok")

# แก้ไข ISO format ให้ถูกต้อง
def fix_isoformat(dt_str: str) -> str:
    """แก้ไข ISO format string ให้ถูกต้อง"""
    if dt_str[-5] in ['+', '-'] and dt_str[-3] != ':':
        dt_str = dt_str[:-2] + ':' + dt_str[-2:]
    return dt_str

# ดึง PSIDs จาก conversations data
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

# ฟอร์แมตข้อมูลลูกค้าให้เหมาะสมสำหรับ API response
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

# Log API errors with context
def log_api_error(endpoint: str, error: Any):
    """Log API errors with context"""
    logger.error(f"API Error at {endpoint}: {str(error)}")
    if hasattr(error, 'response'):
        logger.error(f"Response: {error.response}")
    if hasattr(error, 'request'):
        logger.error(f"Request: {error.request}")

# API สำหรับตรวจสอบสิทธิ์การเข้าถึง page
def validate_page_access(page_id: str, page_tokens: Dict[str, str]) -> tuple[bool, str]:
    """ตรวจสอบสิทธิ์การเข้าถึง page"""
    if not page_id:
        return False, "Page ID is required"
    
    if page_id not in page_tokens:
        return False, f"No access token for page {page_id}"
    
    return True, "OK"

# API สำหรับคำนวณวันที่เริ่มต้นและสิ้นสุดตามช่วงเวลา
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

# API สำหรับแปลง ISO datetime string เป็น datetime object
def parse_iso_datetime(date_str: str) -> Optional[datetime]:
    try:
        fixed_str = fix_isoformat(date_str.replace("Z", "+00:00"))
        return datetime.fromisoformat(fixed_str).astimezone(bangkok_tz)
    except Exception as e:
        print(f"⚠️ แปลงเวลาไม่ได้: {date_str} - {e}")
        return None

# API สำหรับสร้างข้อมูลลูกค้า
def build_customer_data(participant_id, user_name, first_msg_time, last_msg_time, 
                       updated_time, installed_at, page_id, access_token, convo_id) -> Optional[dict]:
    """
    สร้างข้อมูลลูกค้าพร้อมกำหนด source_type
    ✅ ไม่กรอง user เก่าออก - เก็บทุกคน
    """
    first_interaction = parse_iso_datetime(first_msg_time) if first_msg_time else None
    last_interaction = parse_iso_datetime(last_msg_time) if last_msg_time else None

    if not first_interaction:
        first_interaction = parse_iso_datetime(updated_time)

    if not last_interaction:
        last_interaction = first_interaction

    # ✅ เอาการกรองออก - เก็บข้อมูลทุกคน
    # ถ้าต้องการกรองให้ทำที่ frontend แทน

    # ดึงชื่อ User
    if not user_name:
        user_info = get_user_info_from_psid(participant_id, access_token)
        user_name = user_info.get("name")

    if not user_name or user_name.startswith("User"):
        user_name = get_name_from_messages(convo_id, access_token, page_id) or f"User...{participant_id[-8:]}"

    # ✅ แก้ไข: ตรวจสอบ timezone ให้ชัดเจน
    if installed_at.tzinfo is None:
        installed_at = bangkok_tz.localize(installed_at)
    
    if first_interaction and first_interaction.tzinfo is None:
        first_interaction = bangkok_tz.localize(first_interaction)

    # ✅ เปรียบเทียบ timezone ที่ตรงกัน
    source_type = "new" if (first_interaction and first_interaction >= installed_at) else "imported"

    return {
        'customer_psid': participant_id,
        'name': user_name,
        'first_interaction_at': first_interaction,
        'last_interaction_at': last_interaction,
        'source_type': source_type
    }

# API สำหรับสร้างข้อมูลลูกค้าในกรณี sync ย้อนหลัง
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
    """
    สร้างข้อมูลลูกค้าที่มาจากการ sync ย้อนหลัง
    - ไม่สนใจเวลาปัจจุบัน 1 ปี (เพราะเป็นการ sync ย้อนหลังเฉพาะเจาะจง)
    - กำหนด source_type ตามเวลาติดตั้งเว็บ
    """
    
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
    
    # ✅ กำหนด source_type ตามเวลาติดตั้งเว็บ
    # สำหรับการ sync ย้อนหลัง ถ้า first_interaction < installed_at = imported
    source_type = "new" if first_interaction >= installed_at else "imported"
    
    return {
        'customer_psid': participant_id,
        'name': user_name,
        'first_interaction_at': first_interaction,
        'last_interaction_at': last_interaction,
        'source_type': source_type
    }