import logging
from app.service.facebook_api import send_message, send_image_binary, send_video_binary
from app.config import image_dir, vid_dir
from app.database import crud

logger = logging.getLogger(__name__)

def send_facebook_message(
    db,
    page_id: str,
    psid: str,
    message: str,
    msg_type: str,
    access_token: str,
    is_system_message: bool = False
):
    """
    ส่งข้อความไปยังผู้ใช้ผ่าน Facebook Messenger API
    ใช้ได้ทั้งใน route และ Celery
    """
    try:
        logger.info(f"📤 Sending {msg_type} message to PSID={psid}")

        # ตรวจสอบ token
        if not access_token:
            raise ValueError("Page token not found")

        # ตรวจสอบ PSID
        if not psid or len(psid) < 5:
            raise ValueError("Invalid PSID")

        # ส่งข้อความตามประเภท
        if msg_type == "image":
            image_path = f"{image_dir}/{message}"
            result = send_image_binary(psid, image_path, access_token)
        elif msg_type == "video":
            video_path = f"{vid_dir}/{message}"
            result = send_video_binary(psid, video_path, access_token)
        else:
            result = send_message(psid, message, access_token)

        # ตรวจสอบผลลัพธ์จาก Facebook API
        if "error" in result:
            logger.error(f"❌ FB API Error: {result['error']}")
            return {"error": result["error"], "details": result}

        # ✅ อัปเดต interaction ถ้าไม่ใช่ system message
        if not is_system_message:
            page = crud.get_page_by_page_id(db, page_id)
            if page:
                crud.update_customer_interaction(db, page.ID, psid)
                logger.info(f"📝 Updated interaction for PSID={psid}")

        logger.info(f"✅ Message sent successfully to {psid}")
        return {"success": True, "result": result}

    except Exception as e:
        logger.error(f"❌ Error sending message: {e}")
        return {"error": str(e)}