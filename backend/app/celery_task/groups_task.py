from app.celery_worker import celery_app
from app.database.database import SessionLocal
from app.database import models
from app.database import crud
import logging
from datetime import datetime
import asyncio
from app.service.message_scheduler import message_scheduler

logger = logging.getLogger(__name__)

@celery_app.task(name="app.tasks.customer_tasks.get_customer_groups_task")
def get_customer_groups_task(page_id: int, include_inactive: bool = False):
    """Task สำหรับดึงกลุ่มลูกค้าของเพจ"""
    db = SessionLocal()
    try:
        query = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.page_id == page_id
        )

        if not include_inactive:
            query = query.filter(models.CustomerTypeCustom.is_active == True)

        groups = query.order_by(models.CustomerTypeCustom.created_at.desc()).all()

        result = []
        for group in groups:
            customer_count = db.query(models.FbCustomer).filter(
                models.FbCustomer.page_id == page_id,
                models.FbCustomer.current_category_id == group.id
            ).count()

            result.append({
                "id": group.id,
                "page_id": group.page_id,
                "type_name": group.type_name,
                "keywords": group.keywords or [],
                "examples": group.examples or [],
                "rule_description": group.rule_description,
                "is_active": group.is_active,
                "created_at": str(group.created_at),
                "updated_at": str(group.updated_at),
                "customer_count": customer_count
            })

        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="create_customer_group_task")
def create_customer_group_task(group_data_dict: dict):
    """Task สำหรับสร้างกลุ่มลูกค้าใน background"""
    db = SessionLocal()
    try:
        new_group = crud.create_customer_type_custom(
            db, 
            page_id=group_data_dict["page_id"],
            type_data={
                'type_name': group_data_dict["type_name"],
                'keywords': group_data_dict["keywords"],
                'rule_description': group_data_dict["rule_description"],
                'examples': group_data_dict["examples"],
                'is_active': True
            }
        )
        db.commit()
        logger.info(f"✅ Celery task: Created customer group {new_group.type_name}")
        return new_group.id
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in create_customer_group_task: {e}")
        raise
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.groups.get_customer_group_task")
def get_customer_group_task(group_id: int):
    """Task สำหรับดึงข้อมูลกลุ่มลูกค้าตาม ID"""
    db = SessionLocal()
    try:
        group = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.id == group_id
        ).first()

        if not group:
            return {"error": "Group not found"}

        result = {
            "id": group.id,
            "page_id": group.page_id,
            "type_name": group.type_name,
            "keywords": group.keywords.split(",") if group.keywords else [],
            "examples": group.examples.split("\n") if group.examples else [],
            "rule_description": group.rule_description,
            "is_active": group.is_active,
            "created_at": str(group.created_at),
            "updated_at": str(group.updated_at),
            "customer_count": len(group.customers)
        }
        return result
    except Exception as e:
        logger.error(f"❌ Error in get_customer_group_task: {e}")
        return {"error": str(e)}
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.groups.update_customer_group_task")
def update_customer_group_task(group_id: int, update_data: dict):
    """Task สำหรับอัปเดทข้อมูลกลุ่มลูกค้า"""
    db = SessionLocal()
    try:
        updated_group = crud.update_customer_type_custom(db, group_id, update_data)
        db.commit()
        logger.info(f"✅ Celery task: Updated customer group {updated_group.type_name}")
        return {
            "id": updated_group.id,
            "type_name": updated_group.type_name,
            "keywords": updated_group.keywords if isinstance(updated_group.keywords, list) else [],
            "rule_description": updated_group.rule_description,
            "examples": updated_group.examples if isinstance(updated_group.examples, list) else [],
            "updated_at": str(updated_group.updated_at)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in update_customer_group_task: {e}")
        raise
    finally:
        db.close()

@celery_app.task(name="app.tasks.groups.delete_customer_group_task")
def delete_customer_group_task(group_id: int, hard_delete: bool = False):
    """Task สำหรับลบกลุ่มลูกค้า (soft delete หรือ hard delete)"""
    db = SessionLocal()
    try:
        group = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.id == group_id
        ).first()
        
        if not group:
            raise ValueError("Group not found")
        
        if hard_delete:
            db.delete(group)
            action = "hard deleted"
        else:
            group.is_active = False
            group.updated_at = datetime.now()
            action = "soft deleted"
        
        db.commit()
        logger.info(f"✅ Celery task: Group {group_id} {action}")
        return {"group_id": group_id, "hard_delete": hard_delete, "status": "success"}
    
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in delete_customer_group_task: {e}")
        raise
    finally:
        db.close()


# ==================== Knowledge Type ====================

@celery_app.task(name="app.tasks.knowledge.get_all_customer_type_knowledge_task")
def get_all_customer_type_knowledge_task():
    """Task สำหรับดึงข้อมูล customer type knowledge ทั้งหมด"""
    db = SessionLocal()
    try:
        knowledge_types = db.query(models.CustomerTypeKnowledge).all()
        
        result = []
        for kt in knowledge_types:
            result.append({
                "id": f"knowledge_{kt.id}",  # ใช้ prefix เพื่อแยกจาก user groups
                "knowledge_id": kt.id,
                "type_name": kt.type_name,
                "rule_description": kt.rule_description,
                "examples": kt.examples,
                "keywords": kt.keywords,
                "logic": kt.logic,
                "supports_image": kt.supports_image,
                "image_label_keywords": kt.image_label_keywords,
                "is_knowledge": True  # flag เพื่อระบุว่าเป็น knowledge type
            })
        
        logger.info("✅ Celery task: Fetched all customer type knowledge")
        return result
    
    except Exception as e:
        logger.error(f"❌ Error in get_all_customer_type_knowledge_task: {e}")
        raise
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.knowledge.get_page_customer_type_knowledge_task")
def get_page_customer_type_knowledge_task(page_id: str):
    """Task สำหรับดึง knowledge types ของ page ตาม page_id"""
    db = SessionLocal()
    try:
        # หา page จาก Facebook page ID
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            logger.warning(f"Page not found for page_id: {page_id}")
            return []

        page_db_id = page.ID

        # ดึง records จากตาราง page_customer_type_knowledge
        page_knowledge_records = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page_db_id
        ).all()

        logger.info(f"Found {len(page_knowledge_records)} page_knowledge records for page {page_id}")

        # ถ้าไม่มี records สำหรับ page นี้ ให้สร้างขึ้นมาใหม่
        if not page_knowledge_records:
            # Celery ไม่สามารถเรียก await ได้โดยตรง ต้องทำ sync wrapper
            loop = asyncio.get_event_loop()
            page_knowledge_records = loop.run_until_complete(
                _create_default_page_knowledge_records(db, page_db_id)
            )

        # สร้าง response
        result = []
        for pk_record in page_knowledge_records:
            if pk_record.knowledge:
                kt = pk_record.knowledge
                result.append({
                    "id": f"knowledge_{kt.id}",
                    "knowledge_id": kt.id,
                    "page_knowledge_id": pk_record.id,
                    "type_name": kt.type_name,
                    "rule_description": kt.rule_description,
                    "examples": kt.examples,
                    "keywords": kt.keywords,
                    "logic": kt.logic,
                    "supports_image": kt.supports_image,
                    "image_label_keywords": kt.image_label_keywords,
                    "is_knowledge": True,
                    "is_enabled": pk_record.is_enabled,
                    "is_active": True,
                    "created_at": pk_record.created_at.isoformat() if pk_record.created_at else None
                })
                logger.debug(f"Added knowledge type: {kt.type_name} (ID: {kt.id})")

        return result

    except Exception as e:
        logger.error(f"❌ Error in get_page_customer_type_knowledge_task: {e}")
        raise
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.knowledge.toggle_page_knowledge_task")
def toggle_page_knowledge_task(page_id: str, knowledge_id: int):
    """Task สำหรับเปิด/ปิด knowledge type ของ page และจัดการ schedules"""
    db = SessionLocal()
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            logger.warning(f"Page not found: {page_id}")
            return {"status": "error", "message": "Page not found"}

        pk_record = db.query(models.PageCustomerTypeKnowledge).filter(
            models.PageCustomerTypeKnowledge.page_id == page.ID,
            models.PageCustomerTypeKnowledge.customer_type_knowledge_id == knowledge_id
        ).first()

        if not pk_record:
            logger.warning(f"Knowledge record not found: {knowledge_id}")
            return {"status": "error", "message": "Record not found"}

        # Toggle สถานะ
        pk_record.is_enabled = not pk_record.is_enabled
        pk_record.updated_at = datetime.now()
        db.commit()

        removed_count = 0

        if not pk_record.is_enabled:
            # ปิด schedules ที่เกี่ยวข้อง
            group_id = f"knowledge_{knowledge_id}"

            if page_id in message_scheduler.active_schedules:
                schedules_to_remove = []
                for schedule in message_scheduler.active_schedules[page_id]:
                    if group_id in schedule.get('groups', []):
                        schedules_to_remove.append(schedule['id'])

                for schedule_id in schedules_to_remove:
                    message_scheduler.remove_schedule(page_id, schedule_id)
                    removed_count += 1

            logger.info(f"Disabled knowledge group {knowledge_id} and deactivated {removed_count} schedules")
        else:
            logger.info(f"Enabled knowledge group {knowledge_id}")

        return {
            "status": "success",
            "is_enabled": pk_record.is_enabled,
            "knowledge_id": knowledge_id,
            "page_id": page_id,
            "removed_schedules": removed_count
        }

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in toggle_page_knowledge_task: {e}")
        raise
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.knowledge.update_customer_type_knowledge_task")
def update_customer_type_knowledge_task(knowledge_id: int, update_data: dict):
    """Task สำหรับอัพเดทข้อมูล customer type knowledge"""
    db = SessionLocal()
    try:
        # ค้นหา knowledge type
        knowledge_type = db.query(models.CustomerTypeKnowledge).filter(
            models.CustomerTypeKnowledge.id == knowledge_id
        ).first()
        
        if not knowledge_type:
            logger.warning(f"Knowledge type not found: {knowledge_id}")
            return {"status": "error", "message": "Knowledge type not found"}

        update_fields = []
        params = {"id": knowledge_id}

        if 'type_name' in update_data:
            update_fields.append("type_name = :type_name")
            params["type_name"] = update_data['type_name']
            
        if 'rule_description' in update_data:
            update_fields.append("rule_description = :rule_description")
            params["rule_description"] = update_data['rule_description']
            
        if 'keywords' in update_data:
            keywords_str = update_data['keywords']
            if isinstance(keywords_str, str):
                keywords_array = [k.strip() for k in keywords_str.split(',') if k.strip()]
            else:
                keywords_array = keywords_str if isinstance(keywords_str, list) else []
            update_fields.append("keywords = :keywords")
            params["keywords"] = keywords_array
            
        if 'examples' in update_data:
            examples_str = update_data['examples']
            if isinstance(examples_str, str):
                examples_array = [e.strip() for e in examples_str.split('\n') if e.strip()]
            else:
                examples_array = examples_str if isinstance(examples_str, list) else []
            update_fields.append("examples = :examples")
            params["examples"] = examples_array

        if update_fields:
            query = text(f"""
                UPDATE customer_type_knowledge
                SET {', '.join(update_fields)}
                WHERE id = :id
                RETURNING id, type_name, rule_description, keywords, examples
            """)
            
            result = db.execute(query, params)
            db.commit()
            updated_row = result.fetchone()
            
            logger.info(f"✅ Updated knowledge type {knowledge_id}")
            
            return {
                "status": "success",
                "id": updated_row[0],
                "type_name": updated_row[1],
                "rule_description": updated_row[2],
                "keywords": updated_row[3] if updated_row[3] else [],
                "examples": updated_row[4] if updated_row[4] else [],
            }
        
        return {"status": "success", "message": "ไม่มีข้อมูลที่ต้องอัพเดท"}

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in update_customer_type_knowledge_task: {e}")
        raise
    finally:
        db.close()
        
@celery_app.task(name="app.tasks.auto_group_customer_task")
def auto_group_customer_task(page_id: str, customer_psid: str, message_text: str):
    """ตรวจสอบข้อความและจัดกลุ่มลูกค้าอัตโนมัติตาม keywords"""
    db = SessionLocal()
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"status": "error", "message": "Page not found"}
        
        # ดึงกลุ่มที่ active ทั้งหมดของเพจ
        groups = db.query(models.CustomerTypeCustom).filter(
            models.CustomerTypeCustom.page_id == page.ID,
            models.CustomerTypeCustom.is_active == True
        ).all()
        
        # ตรวจสอบ keywords
        detected_group = None
        message_lower = message_text.lower()
        
        for group in groups:
            if group.keywords:
                keywords = [k.strip().lower() for k in group.keywords.split(",")]
                for keyword in keywords:
                    if keyword and keyword in message_lower:
                        detected_group = group
                        break
            if detected_group:
                break
        
        if detected_group:
            customer = crud.get_customer_by_psid(db, page.ID, customer_psid)
            if customer:
                customer.customer_type_custom_id = detected_group.id
                customer.updated_at = datetime.now()
                db.commit()
                logger.info(f"✅ Customer {customer_psid} auto-grouped to {detected_group.type_name}")
                
                return {
                    "status": "success",
                    "group_detected": detected_group.type_name,
                    "keywords_matched": True,
                    "customer_psid": customer_psid
                }
        
        return {
            "status": "no_match",
            "message": "No keywords matched",
            "customer_psid": customer_psid
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in auto_group_customer_task: {e}")
        raise
    finally:
        db.close()



