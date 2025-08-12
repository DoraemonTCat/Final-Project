from fastapi import APIRouter, BackgroundTasks, Depends
from app.task.bg_task import run_sync_customer_background, run_sync_customer_messages_background
from app.database.database import get_db
from sqlalchemy.orm import Session
from app.service.auto_sync_service import auto_sync_service
from app.database import crud, database, models, schemas
router = APIRouter()

# API สำหรับเริ่มต้นการ sync ข้อมูลลูกค้า
@router.get("/trigger-sync/{page_id}")
def trigger_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_background, page_id)
    return {"message": f"✅ Triggered background sync for page_id: {page_id}"}

# API สำหรับเริ่มต้นการ sync ข้อความลูกค้า
@router.get("/trigger-messages-sync/{page_id}")
def trigger_messages_sync(page_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_customer_messages_background, page_id)
    return {"message": f"✅ Triggered background message sync for page_id: {page_id}"}

# API สำหรับ sync retarget tiers
@router.post("/sync-retarget-tiers/{page_id}")
async def sync_retarget_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """
    Sync retarget tiers จาก customer_type_knowledge.logic 
    ไปยัง retarget_tiers_config สำหรับแต่ละ page
    """
    try:
        # 1. หา page จาก database
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"Page {page_id} not found"}
        
        # 2. ดึงข้อมูล customer_type_knowledge ทั้งหมด
        knowledge_types = db.query(models.CustomerTypeKnowledge).all()
        
        synced_count = 0
        errors = []
        
        for kt in knowledge_types:
            try:
                # 3. ตรวจสอบว่ามี retarget_tiers ใน logic หรือไม่
                if kt.logic and isinstance(kt.logic, dict):
                    retarget_tiers = kt.logic.get('retarget_tiers', [])
                    
                    if retarget_tiers:
                        # 4. ลบข้อมูลเก่าของ page นี้ก่อน (optional - ถ้าต้องการ reset)
                        # db.query(models.RetargetTierConfig).filter(
                        #     models.RetargetTierConfig.page_id == page.ID
                        # ).delete()
                        
                        # 5. เพิ่มข้อมูลใหม่
                        for tier in retarget_tiers:
                            # ตรวจสอบว่ามีอยู่แล้วหรือไม่
                            existing = db.query(models.RetargetTierConfig).filter(
                                models.RetargetTierConfig.page_id == page.ID,
                                models.RetargetTierConfig.tier_name == tier.get('name')
                            ).first()
                            
                            if not existing:
                                new_tier = models.RetargetTierConfig(
                                    page_id=page.ID,
                                    tier_name=tier.get('name'),
                                    days_since_last_contact=tier.get('days', 0)
                                )
                                db.add(new_tier)
                                synced_count += 1
                            else:
                                # อัพเดทข้อมูลที่มีอยู่
                                existing.days_since_last_contact = tier.get('days', existing.days_since_last_contact)
                                existing.updated_at = datetime.now()
                                synced_count += 1
                                
            except Exception as e:
                errors.append({
                    'knowledge_type': kt.type_name,
                    'error': str(e)
                })
                logger.error(f"Error syncing tier for {kt.type_name}: {e}")
        
        db.commit()
        
        return {
            "status": "success",
            "synced_count": synced_count,
            "errors": errors,
            "message": f"Synced {synced_count} retarget tiers for page {page_id}"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error syncing retarget tiers: {e}")
        return {"error": str(e)}

# API สำหรับลบข้อมูล retarget tiers ที่ซ้ำซ้อน    
@router.post("/cleanup-duplicate-retarget-tiers")
async def cleanup_duplicate_retarget_tiers(
    db: Session = Depends(get_db)
):
    """
    ลบข้อมูล retarget tiers ที่ซ้ำซ้อน
    """
    try:
        # ดึง pages ทั้งหมด
        pages = db.query(models.FacebookPage).all()
        
        total_deleted = 0
        
        for page in pages:
            # ดึง tiers ทั้งหมดของ page
            tiers = db.query(models.RetargetTierConfig).filter(
                models.RetargetTierConfig.page_id == page.ID
            ).order_by(models.RetargetTierConfig.id).all()
            
            # เก็บ track tier_name ที่เจอแล้ว
            seen_tier_names = set()
            duplicates_to_delete = []
            
            for tier in tiers:
                if tier.tier_name in seen_tier_names:
                    # พบข้อมูลซ้ำ
                    duplicates_to_delete.append(tier)
                else:
                    seen_tier_names.add(tier.tier_name)
            
            # ลบข้อมูลซ้ำ
            for duplicate in duplicates_to_delete:
                db.delete(duplicate)
                total_deleted += 1
                logger.info(f"Deleted duplicate tier: {duplicate.tier_name} (ID: {duplicate.id}) for page {page.ID}")
        
        db.commit()
        
        return {
            "status": "success",
            "total_deleted": total_deleted,
            "message": f"Cleaned up {total_deleted} duplicate retarget tiers"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error cleaning up duplicate tiers: {e}")
        return {"error": str(e)}
    
# API สำหรับรีเซ็ต retarget tiers ของ page
@router.post("/reset-retarget-tiers/{page_id}")
async def reset_retarget_tiers(
    page_id: str,
    db: Session = Depends(get_db)
):
    """
    Reset retarget tiers สำหรับ page ที่ระบุ (ลบทั้งหมดและสร้างใหม่)
    """
    try:
        page = crud.get_page_by_page_id(db, page_id)
        if not page:
            return {"error": f"Page {page_id} not found"}
        
        # ลบข้อมูลเก่าทั้งหมด
        deleted = db.query(models.RetargetTierConfig).filter(
            models.RetargetTierConfig.page_id == page.ID
        ).delete()
        
        # Sync ใหม่
        synced_tiers = crud.sync_retarget_tiers_from_knowledge(db, page.ID)
        
        return {
            "status": "success",
            "deleted_count": deleted,
            "synced_count": len(synced_tiers),
            "tiers": [
                {
                    "name": tier.tier_name,
                    "days": tier.days_since_last_contact
                }
                for tier in synced_tiers
            ]
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting tiers: {e}")
        return {"error": str(e)}