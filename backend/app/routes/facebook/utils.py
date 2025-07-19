# backend/app/routes/facebook/utils.py
"""
Facebook Utils Component
Helper functions ที่ใช้ร่วมกันระหว่าง components:
- การแปลงเวลา
- Debug functions
- Helper utilities
"""

from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


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