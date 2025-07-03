from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey, DateTime, func, Text, Boolean, Interval, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.database import Base


class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    ID = Column(Integer, primary_key=True, index=True)
    page_id = Column(String(50), unique=True, nullable=False)
    page_name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    messages = relationship("CustomMessage", back_populates="page", cascade="all, delete-orphan", foreign_keys="CustomMessage.page_id")
    message_sets = relationship("MessageSets", back_populates="page", cascade="all, delete-orphan")
    customer_type_messages = relationship("CustomerTypeMessage", back_populates="page", cascade="all, delete-orphan")
    customers = relationship("FbCustomer", back_populates="page", cascade="all, delete-orphan")


class CustomerTypeCustom(Base):
    __tablename__ = "customer_type_custom"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    type_name = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    examples = Column(Text, server_default="")
    keywords = Column(Text, server_default="")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    page = relationship("FacebookPage", foreign_keys=[page_id])
    customer_type_messages = relationship("CustomerTypeMessage", back_populates="customer_type_custom", cascade="all, delete-orphan")
    customers = relationship("FbCustomer", back_populates="customer_type_custom")


class CustomerTypeKnowledge(Base):
    __tablename__ = "customer_type_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    examples = Column(Text, server_default="")
    keywords = Column(Text, server_default="")
    logic = Column(JSON, server_default="{}")
    supports_image = Column(Boolean, server_default="false")
    image_label_keywords = Column(Text, server_default="")

    # Relationships
    customer_type_messages = relationship("CustomerTypeMessage", back_populates="customer_type_knowledge", cascade="all, delete-orphan")
    customers = relationship("FbCustomer", back_populates="customer_type_knowledge")


class CustomerTypeMessage(Base):
    __tablename__ = "customer_type_messages"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    customer_type_custom_id = Column(Integer, ForeignKey("customer_type_custom.id", ondelete="CASCADE"), nullable=True)
    page_customer_type_knowledge_id = Column(Integer, ForeignKey("page_customer_type_knowledge_id.id", ondelete="CASCADE"), nullable=True)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    ctm_character = Column(String(50), server_default="")
    display_order = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    page = relationship("FacebookPage", back_populates="customer_type_messages", foreign_keys=[page_id])
    customer_type_custom = relationship("CustomerTypeCustom", back_populates="customer_type_messages")
    page_customer_type_knowledge_id = relationship("PageCustomerTypeKnowledge", back_populates="customer_type_messages")
    message_schedules = relationship("MessageSchedule", back_populates="customer_type_message", cascade="all, delete-orphan")


class MessageSchedule(Base):
    __tablename__ = "message_schedules"

    id = Column(Integer, primary_key=True, index=True)
    customer_type_message_id = Column(Integer, ForeignKey("customer_type_messages.id", ondelete="CASCADE"), nullable=False)
    send_type = Column(String(20), nullable=False)
    scheduled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    send_after_inactive = Column(Interval, nullable=True)
    frequency = Column(String(20), server_default="once")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Check constraints
    __table_args__ = (
        CheckConstraint(
            "frequency IN ('once', 'daily', 'weekly', 'monthly')",
            name="message_schedules_frequency_check"
        ),
        CheckConstraint(
            "send_type IN ('immediate', 'scheduled', 'after_inactive')",
            name="message_schedules_send_type_check"
        ),
    )

    # Relationships
    customer_type_message = relationship("CustomerTypeMessage", back_populates="message_schedules")


class FbCustomer(Base):
    __tablename__ = "fb_customers"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    customer_psid = Column(String(50), nullable=False)
    name = Column(Text, server_default="")
    customer_type_custom_id = Column(Integer, ForeignKey("customer_type_custom.id", ondelete="SET NULL"), nullable=True)
    customer_type_knowledge_id = Column(Integer, ForeignKey("customer_type_knowledge.id", ondelete="SET NULL"), nullable=True)
    first_interaction_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_interaction_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    source_type = Column(Text, server_default="new", nullable=False)

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('new', 'imported')",
            name="fb_customers_source_type_check"
        )
    )
    # Relationships
    page = relationship("FacebookPage", back_populates="customers", foreign_keys=[page_id])
    customer_type_custom = relationship("CustomerTypeCustom", back_populates="customers")
    customer_type_knowledge = relationship("CustomerTypeKnowledge", back_populates="customers")


class MessageSets(Base):
    __tablename__ = "message_sets"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    set_name = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    messages = relationship("CustomMessage", back_populates="message_set", cascade="all, delete-orphan")
    page = relationship("FacebookPage", back_populates="message_sets", foreign_keys=[page_id])


class CustomMessage(Base):
    __tablename__ = "fb_custom_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_set_id = Column(Integer, ForeignKey("message_sets.id", ondelete="CASCADE"), nullable=False)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    message_set = relationship("MessageSets", back_populates="messages")
    page = relationship("FacebookPage", back_populates="messages", foreign_keys=[page_id])

class PageCustomerTypeKnowledge(Base):
    __tablename__ = "fb_custom_messages"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    customer_type_knowledge_id = Column(Integer, ForeignKey("customer_type_knowledge.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, server_default="true")
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    page = relationship("FacebookPage", back_populates="messages", foreign_keys=[page_id])
    customer_type_knowledge = relationship("CustomerTypeKnowledge", back_populates="customers")