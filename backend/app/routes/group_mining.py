from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.database.database import get_db
from app.database.models import CustomerGroup, MiningSchedule, GroupCustomer, UserActivity, MessageLog
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json
import logging

router = APIRouter(prefix="/api/v1", tags=["group_mining"])

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========================================
# Pydantic Schemas
# ========================================

class CustomerGroupCreate(BaseModel):
    page_id: str
    name: str

class CustomerGroupUpdate(BaseModel):
    name: str

class CustomerGroupResponse(BaseModel):
    id: int
    page_id: str
    name: str
    created_at: datetime
    customer_count: Optional[int] = 0
    
    class Config:
        orm_mode = True

class GroupCustomerAdd(BaseModel):
    group_id: int
    customer_psids: List[str]

class GroupCustomerResponse(BaseModel):
    id: int
    group_id: int
    customer_psid: str
    added_at: datetime
    
    class Config:
        orm_mode = True

class MessageItem(BaseModel):
    message_type: str  # 'text', 'image', 'video'
    content: str
    display_order: int

class ScheduleCreate(BaseModel):
    group_id: int
    page_id: str
    type: str  # 'immediate', 'scheduled', 'user-inactive'
    scheduled_date: Optional[datetime] = None
    scheduled_time: Optional[str] = None
    inactivity_period: Optional[int] = None
    inactivity_unit: Optional[str] = None  # 'hours', 'days', 'weeks', 'months'
    repeat_type: str = 'once'  # 'once', 'daily', 'weekly', 'monthly'
    repeat_days: Optional[List[int]] = None
    end_date: Optional[datetime] = None
    messages: List[MessageItem]
    is_active: bool = True

class ScheduleUpdate(BaseModel):
    type: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    scheduled_time: Optional[str] = None
    inactivity_period: Optional[int] = None
    inactivity_unit: Optional[str] = None
    repeat_type: Optional[str] = None
    repeat_days: Optional[List[int]] = None
    end_date: Optional[datetime] = None
    messages: Optional[List[MessageItem]] = None
    is_active: Optional[bool] = None

class ScheduleResponse(BaseModel):
    id: int
    group_id: int
    page_id: str
    type: str
    scheduled_date: Optional[datetime]
    scheduled_time: Optional[str]
    inactivity_period: Optional[int]
    inactivity_unit: Optional[str]
    repeat_type: str
    repeat_days: Optional[List[int]]
    end_date: Optional[datetime]
    messages: List[Dict[str, Any]]
    is_active: bool
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True

class UserActivityUpdate(BaseModel):
    page_id: str
    user_psid: str
    conversation_id: Optional[str] = None

class UserActivityResponse(BaseModel):
    id: int
    page_id: str
    user_psid: str
    last_activity: datetime
    conversation_id: Optional[str]
    
    class Config:
        orm_mode = True

class MessageLogResponse(BaseModel):
    id: int
    schedule_id: Optional[int]
    page_id: str
    recipient_psid: str
    message_type: str
    message_content: str
    status: str
    error_message: Optional[str]
    sent_at: datetime
    
    class Config:
        orm_mode = True

# ========================================
# Customer Groups Endpoints
# ========================================

@router.post("/customer-groups", response_model=CustomerGroupResponse)
def create_customer_group(data: CustomerGroupCreate, db: Session = Depends(get_db)):
    """สร้างกลุ่มลูกค้าใหม่"""
    try:
        # ตรวจสอบว่ามีชื่อกลุ่มซ้ำหรือไม่
        existing_group = db.query(CustomerGroup).filter(
            and_(
                CustomerGroup.page_id == data.page_id,
                CustomerGroup.name == data.name
            )
        ).first()
        
        if existing_group:
            raise HTTPException(status_code=400, detail="ชื่อกลุ่มนี้มีอยู่แล้ว")
        
        group = CustomerGroup(
            page_id=data.page_id,
            name=data.name
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        
        # นับจำนวนลูกค้าในกลุ่ม
        customer_count = db.query(GroupCustomer).filter(
            GroupCustomer.group_id == group.id
        ).count()
        
        response = CustomerGroupResponse(
            id=group.id,
            page_id=group.page_id,
            name=group.name,
            created_at=group.created_at,
            customer_count=customer_count
        )
        
        logger.info(f"Created customer group: {group.name} (ID: {group.id})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer group: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการสร้างกลุ่ม")

@router.get("/customer-groups/{page_id}", response_model=List[CustomerGroupResponse])
def get_customer_groups(page_id: str, db: Session = Depends(get_db)):
    """ดึงรายการกลุ่มลูกค้าของเพจ"""
    try:
        groups = db.query(CustomerGroup).filter(
            CustomerGroup.page_id == page_id
        ).order_by(CustomerGroup.created_at.desc()).all()
        
        response = []
        for group in groups:
            customer_count = db.query(GroupCustomer).filter(
                GroupCustomer.group_id == group.id
            ).count()
            
            response.append(CustomerGroupResponse(
                id=group.id,
                page_id=group.page_id,
                name=group.name,
                created_at=group.created_at,
                customer_count=customer_count
            ))
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching customer groups: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม")

@router.put("/customer-groups/{group_id}", response_model=CustomerGroupResponse)
def update_customer_group(
    group_id: int, 
    name: str,
    db: Session = Depends(get_db)
):
    """แก้ไขชื่อกลุ่มลูกค้า"""
    try:
        group = db.query(CustomerGroup).filter(CustomerGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการแก้ไข")
        
        # ตรวจสอบชื่อซ้ำ
        existing = db.query(CustomerGroup).filter(
            and_(
                CustomerGroup.page_id == group.page_id,
                CustomerGroup.name == name,
                CustomerGroup.id != group_id
            )
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="ชื่อกลุ่มนี้มีอยู่แล้ว")
        
        group.name = name
        db.commit()
        db.refresh(group)
        
        customer_count = db.query(GroupCustomer).filter(
            GroupCustomer.group_id == group.id
        ).count()
        
        response = CustomerGroupResponse(
            id=group.id,
            page_id=group.page_id,
            name=group.name,
            created_at=group.created_at,
            customer_count=customer_count
        )
        
        logger.info(f"Updated customer group: {group.name} (ID: {group.id})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer group: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการแก้ไขกลุ่ม")

@router.delete("/customer-groups/{group_id}")
def delete_customer_group(group_id: int, db: Session = Depends(get_db)):
    """ลบกลุ่มลูกค้า"""
    try:
        group = db.query(CustomerGroup).filter(CustomerGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการลบ")
        
        # ตรวจสอบว่ามี schedule ที่ใช้กลุ่มนี้อยู่หรือไม่
        active_schedules = db.query(MiningSchedule).filter(
            and_(
                MiningSchedule.group_id == group_id,
                MiningSchedule.is_active == True
            )
        ).count()
        
        if active_schedules > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"ไม่สามารถลบกลุ่มได้ เนื่องจากมีตารางส่งข้อความที่ใช้งานอยู่ {active_schedules} รายการ"
            )
        
        group_name = group.name
        db.delete(group)
        db.commit()
        
        logger.info(f"Deleted customer group: {group_name} (ID: {group_id})")
        return {"status": "deleted", "message": f"ลบกลุ่ม {group_name} เรียบร้อยแล้ว"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting customer group: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการลบกลุ่ม")

# ========================================
# Group Customers Endpoints
# ========================================

@router.post("/group-customers")
def add_customers_to_group(data: GroupCustomerAdd, db: Session = Depends(get_db)):
    """เพิ่มลูกค้าเข้ากลุ่ม"""
    try:
        # ตรวจสอบว่ากลุ่มมีอยู่จริง
        group = db.query(CustomerGroup).filter(CustomerGroup.id == data.group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการเพิ่มลูกค้า")
        
        added_count = 0
        skipped_count = 0
        
        for psid in data.customer_psids:
            # ตรวจสอบว่ามีลูกค้านี้ในกลุ่มแล้วหรือไม่
            existing = db.query(GroupCustomer).filter(
                and_(
                    GroupCustomer.group_id == data.group_id,
                    GroupCustomer.customer_psid == psid
                )
            ).first()
            
            if not existing:
                customer = GroupCustomer(
                    group_id=data.group_id,
                    customer_psid=psid
                )
                db.add(customer)
                added_count += 1
            else:
                skipped_count += 1
        
        db.commit()
        
        logger.info(f"Added {added_count} customers to group {data.group_id}, skipped {skipped_count}")
        return {
            "status": "success",
            "added": added_count,
            "skipped": skipped_count,
            "total": len(data.customer_psids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding customers to group: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการเพิ่มลูกค้าเข้ากลุ่ม")

@router.get("/group-customers/{group_id}", response_model=List[GroupCustomerResponse])
def get_group_customers(group_id: int, db: Session = Depends(get_db)):
    """ดึงรายชื่อลูกค้าในกลุ่ม"""
    try:
        # ตรวจสอบว่ากลุ่มมีอยู่จริง
        group = db.query(CustomerGroup).filter(CustomerGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการดูข้อมูล")
        
        customers = db.query(GroupCustomer).filter(
            GroupCustomer.group_id == group_id
        ).order_by(GroupCustomer.added_at.desc()).all()
        
        return customers
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching group customers: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า")

@router.delete("/group-customers/{group_id}/{customer_psid}")
def remove_customer_from_group(
    group_id: int,
    customer_psid: str,
    db: Session = Depends(get_db)
):
    """ลบลูกค้าออกจากกลุ่ม"""
    try:
        customer = db.query(GroupCustomer).filter(
            and_(
                GroupCustomer.group_id == group_id,
                GroupCustomer.customer_psid == customer_psid
            )
        ).first()
        
        if not customer:
            raise HTTPException(status_code=404, detail="ไม่พบลูกค้าในกลุ่มนี้")
        
        db.delete(customer)
        db.commit()
        
        logger.info(f"Removed customer {customer_psid} from group {group_id}")
        return {"status": "deleted", "message": "ลบลูกค้าออกจากกลุ่มเรียบร้อยแล้ว"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing customer from group: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการลบลูกค้า")

# ========================================
# Mining Schedules Endpoints
# ========================================

@router.post("/mining-schedules", response_model=ScheduleResponse)
def create_mining_schedule(data: ScheduleCreate, db: Session = Depends(get_db)):
    """สร้างตารางการส่งข้อความ"""
    try:
        # ตรวจสอบว่ากลุ่มมีอยู่จริง
        group = db.query(CustomerGroup).filter(CustomerGroup.id == data.group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการตั้งเวลา")
        
        # ตรวจสอบว่า page_id ตรงกับกลุ่มหรือไม่
        if group.page_id != data.page_id:
            raise HTTPException(status_code=400, detail="Page ID ไม่ตรงกับกลุ่มที่เลือก")
        
        # แปลง messages เป็น JSON
        messages_json = [msg.dict() for msg in data.messages]
        
        schedule = MiningSchedule(
            group_id=data.group_id,
            page_id=data.page_id,
            type=data.type,
            scheduled_date=data.scheduled_date,
            scheduled_time=data.scheduled_time,
            inactivity_period=data.inactivity_period,
            inactivity_unit=data.inactivity_unit,
            repeat_type=data.repeat_type,
            repeat_days=data.repeat_days,
            end_date=data.end_date,
            messages=messages_json,
            is_active=data.is_active
        )
        
        # คำนวณ next_run_at ตามประเภท
        if data.type == 'immediate':
            schedule.next_run_at = datetime.utcnow()
        elif data.type == 'scheduled':
            if data.scheduled_date and data.scheduled_time:
                time_parts = data.scheduled_time.split(':')
                scheduled_datetime = data.scheduled_date.replace(
                    hour=int(time_parts[0]),
                    minute=int(time_parts[1]),
                    second=0,
                    microsecond=0
                )
                schedule.next_run_at = scheduled_datetime
        # type 'user-inactive' จะคำนวณแยกในระบบตรวจสอบ
        
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        
        logger.info(f"Created mining schedule: {schedule.id} for group {data.group_id}")
        return schedule
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating mining schedule: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการสร้างตารางส่งข้อความ")

@router.get("/mining-schedules/{page_id}", response_model=List[ScheduleResponse])
def get_mining_schedules(
    page_id: str,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """ดึงตารางการส่งข้อความของเพจ"""
    try:
        query = db.query(MiningSchedule).filter(MiningSchedule.page_id == page_id)
        
        if active_only:
            query = query.filter(MiningSchedule.is_active == True)
        
        schedules = query.order_by(MiningSchedule.created_at.desc()).all()
        
        return schedules
        
    except Exception as e:
        logger.error(f"Error fetching mining schedules: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูลตารางส่งข้อความ")

@router.get("/mining-schedules/group/{group_id}", response_model=List[ScheduleResponse])
def get_group_schedules(group_id: int, db: Session = Depends(get_db)):
    """ดึงตารางการส่งข้อความของกลุ่ม"""
    try:
        schedules = db.query(MiningSchedule).filter(
            MiningSchedule.group_id == group_id
        ).order_by(MiningSchedule.created_at.desc()).all()
        
        return schedules
        
    except Exception as e:
        logger.error(f"Error fetching group schedules: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูลตารางส่งข้อความ")

@router.put("/mining-schedules/{schedule_id}", response_model=ScheduleResponse)
def update_mining_schedule(
    schedule_id: int,
    data: ScheduleCreate,
    db: Session = Depends(get_db)
):
    """แก้ไขตารางการส่งข้อความ"""
    try:
        schedule = db.query(MiningSchedule).filter(MiningSchedule.id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="ไม่พบตารางที่ต้องการแก้ไข")
        
        # แปลง messages เป็น JSON
        messages_json = [msg.dict() for msg in data.messages]
        
        # Update fields
        schedule.type = data.type
        schedule.scheduled_date = data.scheduled_date
        schedule.scheduled_time = data.scheduled_time
        schedule.inactivity_period = data.inactivity_period
        schedule.inactivity_unit = data.inactivity_unit
        schedule.repeat_type = data.repeat_type
        schedule.repeat_days = data.repeat_days
        schedule.end_date = data.end_date
        schedule.messages = messages_json
        schedule.is_active = data.is_active
        schedule.updated_at = datetime.utcnow()
        
        # คำนวณ next_run_at ใหม่ถ้าเปลี่ยนประเภท
        if data.type == 'immediate' and not schedule.last_run_at:
            schedule.next_run_at = datetime.utcnow()
        elif data.type == 'scheduled' and data.scheduled_date and data.scheduled_time:
            time_parts = data.scheduled_time.split(':')
            scheduled_datetime = data.scheduled_date.replace(
                hour=int(time_parts[0]),
                minute=int(time_parts[1]),
                second=0,
                microsecond=0
            )
            schedule.next_run_at = scheduled_datetime
        
        db.commit()
        db.refresh(schedule)
        
        logger.info(f"Updated mining schedule: {schedule.id}")
        return schedule
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mining schedule: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการแก้ไขตารางส่งข้อความ")

@router.delete("/mining-schedules/{schedule_id}")
def delete_mining_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """ลบตารางการส่งข้อความ"""
    try:
        schedule = db.query(MiningSchedule).filter(MiningSchedule.id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="ไม่พบตารางที่ต้องการลบ")
        
        db.delete(schedule)
        db.commit()
        
        logger.info(f"Deleted mining schedule: {schedule_id}")
        return {"status": "deleted", "message": "ลบตารางส่งข้อความเรียบร้อยแล้ว"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mining schedule: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการลบตารางส่งข้อความ")

@router.put("/mining-schedules/{schedule_id}/toggle")
def toggle_schedule_status(schedule_id: int, db: Session = Depends(get_db)):
    """เปิด/ปิดการทำงานของตาราง"""
    try:
        schedule = db.query(MiningSchedule).filter(MiningSchedule.id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="ไม่พบตารางที่ต้องการเปลี่ยนสถานะ")
        
        schedule.is_active = not schedule.is_active
        schedule.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(schedule)
        
        status = "เปิด" if schedule.is_active else "ปิด"
        logger.info(f"Toggled mining schedule {schedule_id} to {status}")
        
        return {
            "status": "success",
            "is_active": schedule.is_active,
            "message": f"{status}การทำงานของตารางเรียบร้อยแล้ว"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling schedule status: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการเปลี่ยนสถานะ")

# ========================================
# User Activity Tracking
# ========================================

@router.post("/user-activity", response_model=UserActivityResponse)
def update_user_activity(
    data: UserActivityUpdate,
    db: Session = Depends(get_db)
):
    """อัพเดทเวลาล่าสุดที่ user มีกิจกรรม"""
    try:
        activity = db.query(UserActivity).filter(
            and_(
                UserActivity.page_id == data.page_id,
                UserActivity.user_psid == data.user_psid
            )
        ).first()
        
        if activity:
            activity.last_activity = datetime.utcnow()
            if data.conversation_id:
                activity.conversation_id = data.conversation_id
        else:
            activity = UserActivity(
                page_id=data.page_id,
                user_psid=data.user_psid,
                last_activity=datetime.utcnow(),
                conversation_id=data.conversation_id
            )
            db.add(activity)
        
        db.commit()
        db.refresh(activity)
        
        return activity
        
    except Exception as e:
        logger.error(f"Error updating user activity: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการอัพเดท activity")

@router.get("/inactive-users/{page_id}")
def get_inactive_users(
    page_id: str,
    period: int,
    unit: str,
    db: Session = Depends(get_db)
):
    """ดึงรายชื่อ users ที่ไม่มีกิจกรรมตามเวลาที่กำหนด"""
    try:
        # Validate unit
        valid_units = ['hours', 'days', 'weeks', 'months']
        if unit not in valid_units:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time unit. Must be one of: {', '.join(valid_units)}"
            )
        
        # คำนวณเวลาที่ต้องการตรวจสอบ
        now = datetime.utcnow()
        if unit == 'hours':
            threshold = now - timedelta(hours=period)
        elif unit == 'days':
            threshold = now - timedelta(days=period)
        elif unit == 'weeks':
            threshold = now - timedelta(weeks=period)
        elif unit == 'months':
            threshold = now - timedelta(days=period * 30)
        
        # Query inactive users
        inactive_users = db.query(UserActivity).filter(
            and_(
                UserActivity.page_id == page_id,
                UserActivity.last_activity < threshold
            )
        ).all()
        
        # Format response
        response = []
        for user in inactive_users:
            time_diff = now - user.last_activity
            inactive_days = time_diff.days
            inactive_hours = time_diff.total_seconds() / 3600
            
            response.append({
                "user_psid": user.user_psid,
                "last_activity": user.last_activity,
                "conversation_id": user.conversation_id,
                "inactive_days": inactive_days,
                "inactive_hours": int(inactive_hours)
            })
        
        return {
            "page_id": page_id,
            "threshold": threshold,
            "inactive_users": response,
            "total": len(response)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inactive users: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูล inactive users")

# ========================================
# Message Logs
# ========================================

@router.get("/message-logs/{page_id}", response_model=List[MessageLogResponse])
def get_message_logs(
    page_id: str,
    schedule_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """ดึงประวัติการส่งข้อความ"""
    try:
        query = db.query(MessageLog).filter(MessageLog.page_id == page_id)
        
        if schedule_id:
            query = query.filter(MessageLog.schedule_id == schedule_id)
        
        if status:
            query = query.filter(MessageLog.status == status)
        
        logs = query.order_by(MessageLog.sent_at.desc()).limit(limit).all()
        
        return logs
        
    except Exception as e:
        logger.error(f"Error fetching message logs: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงประวัติการส่งข้อความ")

@router.get("/message-logs/stats/{page_id}")
def get_message_stats(
    page_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """ดึงสถิติการส่งข้อความ"""
    try:
        query = db.query(MessageLog).filter(MessageLog.page_id == page_id)
        
        if start_date:
            query = query.filter(MessageLog.sent_at >= start_date)
        
        if end_date:
            query = query.filter(MessageLog.sent_at <= end_date)
        
        # นับจำนวนตามสถานะ
        total_count = query.count()
        sent_count = query.filter(MessageLog.status == 'sent').count()
        failed_count = query.filter(MessageLog.status == 'failed').count()
        pending_count = query.filter(MessageLog.status == 'pending').count()
        
        # สถิติตามประเภทข้อความ
        text_count = query.filter(MessageLog.message_type == 'text').count()
        image_count = query.filter(MessageLog.message_type == 'image').count()
        video_count = query.filter(MessageLog.message_type == 'video').count()
        
        # ข้อความล้มเหลวบ่อยที่สุด
        failed_messages = query.filter(MessageLog.status == 'failed').all()
        error_summary = {}
        for msg in failed_messages:
            error = msg.error_message or 'Unknown error'
            error_summary[error] = error_summary.get(error, 0) + 1
        
        return {
            "page_id": page_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_messages": total_count,
            "status_breakdown": {
                "sent": sent_count,
                "failed": failed_count,
                "pending": pending_count
            },
            "type_breakdown": {
                "text": text_count,
                "image": image_count,
                "video": video_count
            },
            "success_rate": round((sent_count / total_count * 100) if total_count > 0 else 0, 2),
            "common_errors": sorted(
                [{"error": k, "count": v} for k, v in error_summary.items()],
                key=lambda x: x["count"],
                reverse=True
            )[:5]
        }
        
    except Exception as e:
        logger.error(f"Error fetching message stats: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงสถิติ")

# ========================================
# Utility Endpoints
# ========================================

@router.post("/test-send-immediate/{schedule_id}")
async def test_send_immediate(
    schedule_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """ทดสอบส่งข้อความทันที (สำหรับ debug)"""
    try:
        schedule = db.query(MiningSchedule).filter(MiningSchedule.id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="ไม่พบตารางที่ต้องการทดสอบ")
        
        # Import scheduler
        from app.service.message_scheduler import MessageScheduler
        scheduler = MessageScheduler()
        
        # Get recipients
        recipients = scheduler.get_group_recipients(schedule.group_id, db)
        
        if not recipients:
            return {
                "status": "warning",
                "message": "ไม่มีผู้รับในกลุ่มนี้"
            }
        
        # Add background task to send messages
        background_tasks.add_task(
            scheduler.send_messages_to_recipients,
            schedule,
            recipients[:1],  # ส่งแค่คนแรกเพื่อทดสอบ
            db
        )
        
        return {
            "status": "queued",
            "message": f"กำลังส่งข้อความทดสอบไปยัง 1 จาก {len(recipients)} ผู้รับ",
            "schedule_id": schedule_id,
            "group_id": schedule.group_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing immediate send: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการทดสอบส่งข้อความ")

@router.get("/scheduler-status")
def get_scheduler_status():
    """ตรวจสอบสถานะของ Scheduler"""
    try:
        from app.service.message_scheduler import scheduler
        
        return {
            "status": "running" if scheduler.running else "stopped",
            "check_interval": scheduler.check_interval,
            "message": "Message scheduler is operational"
        }
        
    except Exception as e:
        logger.error(f"Error checking scheduler status: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.post("/sync-customers/{page_id}")
async def sync_customers_from_conversations(
    page_id: str,
    group_id: int,
    db: Session = Depends(get_db)
):
    """ซิงค์ลูกค้าจาก conversations ไปยังกลุ่ม"""
    try:
        # ตรวจสอบว่ากลุ่มมีอยู่จริง
        group = db.query(CustomerGroup).filter(
            and_(
                CustomerGroup.id == group_id,
                CustomerGroup.page_id == page_id
            )
        ).first()
        
        if not group:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มที่ต้องการซิงค์")
        
        # เรียก API เพื่อดึง conversations
        import requests
        from app.config import page_tokens
        
        access_token = page_tokens.get(page_id)
        if not access_token:
            raise HTTPException(status_code=400, detail="ไม่พบ access token สำหรับเพจนี้")
        
        # ดึง conversations
        url = f"https://graph.facebook.com/v14.0/{page_id}/conversations"
        params = {
            "access_token": access_token,
            "fields": "participants",
            "limit": 100
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if "error" in data:
            raise HTTPException(status_code=400, detail=f"Facebook API Error: {data['error']['message']}")
        
        # ดึง PSIDs จาก conversations
        psids = set()
        for conv in data.get("data", []):
            participants = conv.get("participants", {}).get("data", [])
            for participant in participants:
                psid = participant.get("id")
                if psid and psid != page_id:  # ไม่เอา page เอง
                    psids.add(psid)
        
        # เพิ่มลูกค้าเข้ากลุ่ม
        added_count = 0
        for psid in psids:
            existing = db.query(GroupCustomer).filter(
                and_(
                    GroupCustomer.group_id == group_id,
                    GroupCustomer.customer_psid == psid
                )
            ).first()
            
            if not existing:
                customer = GroupCustomer(
                    group_id=group_id,
                    customer_psid=psid
                )
                db.add(customer)
                added_count += 1
        
        db.commit()
        
        return {
            "status": "success",
            "found_customers": len(psids),
            "added_to_group": added_count,
            "group_id": group_id,
            "group_name": group.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing customers: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการซิงค์ลูกค้า")

@router.get("/groups-with-schedules/{page_id}")
def get_groups_with_schedules(page_id: str, db: Session = Depends(get_db)):
    """ดึงกลุ่มพร้อมจำนวนตารางที่ตั้งไว้"""
    try:
        # ดึงกลุ่มทั้งหมด
        groups = db.query(CustomerGroup).filter(
            CustomerGroup.page_id == page_id
        ).all()
        
        result = []
        for group in groups:
            # นับจำนวนลูกค้า
            customer_count = db.query(GroupCustomer).filter(
                GroupCustomer.group_id == group.id
            ).count()
            
            # นับจำนวน schedules ที่ active
            active_schedules = db.query(MiningSchedule).filter(
                and_(
                    MiningSchedule.group_id == group.id,
                    MiningSchedule.is_active == True
                )
            ).count()
            
            # นับจำนวน schedules ทั้งหมด
            total_schedules = db.query(MiningSchedule).filter(
                MiningSchedule.group_id == group.id
            ).count()
            
            result.append({
                "id": group.id,
                "name": group.name,
                "created_at": group.created_at,
                "customer_count": customer_count,
                "active_schedules": active_schedules,
                "total_schedules": total_schedules
            })
        
        return {
            "page_id": page_id,
            "groups": result,
            "total_groups": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error fetching groups with schedules: {str(e)}")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม")

# ========================================
# Validation Helpers
# ========================================

def validate_schedule_data(data: ScheduleCreate):
    """ตรวจสอบความถูกต้องของข้อมูล schedule"""
    errors = []
    
    # ตรวจสอบ type
    valid_types = ['immediate', 'scheduled', 'user-inactive']
    if data.type not in valid_types:
        errors.append(f"Invalid schedule type. Must be one of: {', '.join(valid_types)}")
    
    # ตรวจสอบข้อมูลตาม type
    if data.type == 'scheduled':
        if not data.scheduled_date or not data.scheduled_time:
            errors.append("Scheduled type requires both date and time")
        elif data.scheduled_date < datetime.utcnow():
            errors.append("Scheduled date must be in the future")
    
    elif data.type == 'user-inactive':
        if not data.inactivity_period or data.inactivity_period < 1:
            errors.append("Inactivity period must be at least 1")
        
        valid_units = ['hours', 'days', 'weeks', 'months']
        if data.inactivity_unit not in valid_units:
            errors.append(f"Invalid inactivity unit. Must be one of: {', '.join(valid_units)}")
    
    # ตรวจสอบ repeat type
    valid_repeat_types = ['once', 'daily', 'weekly', 'monthly']
    if data.repeat_type not in valid_repeat_types:
        errors.append(f"Invalid repeat type. Must be one of: {', '.join(valid_repeat_types)}")
    
    # ตรวจสอบ messages
    if not data.messages or len(data.messages) == 0:
        errors.append("At least one message is required")
    else:
        for i, msg in enumerate(data.messages):
            if msg.message_type not in ['text', 'image', 'video']:
                errors.append(f"Invalid message type at index {i}")
            if not msg.content:
                errors.append(f"Empty content at message index {i}")
    
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    
    return True

# ========================================
# Export all endpoints
# ========================================

__all__ = [
    "router",
    "create_customer_group",
    "get_customer_groups", 
    "update_customer_group",
    "delete_customer_group",
    "add_customers_to_group",
    "get_group_customers",
    "remove_customer_from_group",
    "create_mining_schedule",
    "get_mining_schedules",
    "get_group_schedules",
    "update_mining_schedule",
    "delete_mining_schedule",
    "toggle_schedule_status",
    "update_user_activity",
    "get_inactive_users",
    "get_message_logs",
    "get_message_stats",
    "test_send_immediate",
    "get_scheduler_status",
    "sync_customers_from_conversations",
    "get_groups_with_schedules"
]