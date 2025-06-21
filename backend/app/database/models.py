from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey, DateTime, func, Text, Boolean, JSON
from app.database.database import Base
from sqlalchemy.orm import relationship

class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    ID = Column(Integer, primary_key=True, index=True)
    page_id = Column(String(50), unique=True, nullable=False)
    page_name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 🔁 Relationship กลับไปยัง CustomMessage
    messages = relationship("CustomMessage", back_populates="page", cascade="all, delete-orphan")

class MessageSets(Base):
    __tablename__ = "message_sets"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    set_name = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # 🔁 ความสัมพันธ์กับ custom messages
    messages = relationship("CustomMessage", back_populates="message_set", cascade="all, delete-orphan")


class CustomMessage(Base):
    __tablename__ = "fb_custom_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_set_id = Column(Integer, ForeignKey("message_sets.id", ondelete="CASCADE"), nullable=False)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(20), nullable=False)  # 'text', 'image', 'video', etc.
    content = Column(Text, nullable=False)             # ข้อความ หรือ URL ของ media
    display_order = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # 🔁 ความสัมพันธ์กับ message_set
    message_set = relationship("MessageSets", back_populates="messages")
    # 🔁 ความสัมพันธ์กับ FacebookPage (ถ้ามีใช้)
    page = relationship("FacebookPage", back_populates="messages", foreign_keys=[page_id])
    
# ... (models ที่มีอยู่เดิม) ...

class CustomerGroup(Base):
    __tablename__ = "customer_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    schedules = relationship("MiningSchedule", back_populates="group", cascade="all, delete-orphan")
    customers = relationship("GroupCustomer", back_populates="group", cascade="all, delete-orphan")

class MiningSchedule(Base):
    __tablename__ = "mining_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("customer_groups.id", ondelete="CASCADE"), nullable=False)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    
    # Schedule type: 'immediate', 'scheduled', 'user-inactive'
    type = Column(String(20), nullable=False)
    
    # For scheduled type
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    scheduled_time = Column(String(5), nullable=True)  # HH:MM format
    
    # For user-inactive type
    inactivity_period = Column(Integer, nullable=True)  # Number of time units
    inactivity_unit = Column(String(10), nullable=True)  # 'hours', 'days', 'weeks', 'months'
    
    # Repeat settings
    repeat_type = Column(String(10), default='once')  # 'once', 'daily', 'weekly', 'monthly'
    repeat_days = Column(JSON, nullable=True)  # Array of day numbers for weekly repeat
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Messages
    messages = Column(JSON, nullable=False)  # Array of message objects
    
    # Status
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    group = relationship("CustomerGroup", back_populates="schedules")

class GroupCustomer(Base):
    __tablename__ = "group_customers"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("customer_groups.id", ondelete="CASCADE"), nullable=False)
    customer_psid = Column(String(255), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    group = relationship("CustomerGroup", back_populates="customers")

class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("mining_schedules.id", ondelete="SET NULL"), nullable=True)
    page_id = Column(String, nullable=False)
    recipient_psid = Column(String(255), nullable=False)
    message_type = Column(String(20), nullable=False)
    message_content = Column(Text, nullable=False)
    status = Column(String(20), nullable=False)  # 'sent', 'failed', 'pending'
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    user_psid = Column(String(255), nullable=False)
    last_activity = Column(DateTime(timezone=True), nullable=False)
    conversation_id = Column(String(255), nullable=True)
    
    # Index for faster queries
    __table_args__ = (
        Index('ix_user_activity_page_psid', 'page_id', 'user_psid'),
    )