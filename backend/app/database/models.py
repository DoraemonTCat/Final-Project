from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey, DateTime, func, Text
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