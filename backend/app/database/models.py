from sqlalchemy import (Column, String, Integer, TIMESTAMP, ForeignKey, DateTime, 
                        func, Text, Boolean, Interval, JSON, CheckConstraint, ARRAY, BigInteger, LargeBinary)
from sqlalchemy.orm import relationship
from app.database.database import Base


class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    id = Column("ID", Integer, primary_key=True)
    page_id = Column(String(50), unique=True, nullable=False)
    page_name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    customers = relationship("FbCustomer", back_populates="page")
    message_sets = relationship("MessageSets", back_populates="page", foreign_keys="MessageSets.page_id")
    customer_type_customs = relationship("CustomerTypeCustom", back_populates="page")
    customer_type_messages = relationship("CustomerTypeMessage", back_populates="page")
    retarget_tiers = relationship("RetargetTiersConfig", back_populates="page", foreign_keys="RetargetTiersConfig.page_id")
    fb_custom_messages = relationship("FBCustomMessage", back_populates="page", foreign_keys="FBCustomMessage.page_id")
    fb_customer_classifications = relationship("FBCustomerClassification", back_populates="page", foreign_keys="FBCustomerClassification.page_id")
    fb_customer_custom_classifications = relationship("FBCustomerCustomClassification", back_populates="page", foreign_keys="FBCustomerCustomClassification.page_id")
    page_customer_type_knowledge = relationship("PageCustomerTypeKnowledge", back_populates="page", foreign_keys="PageCustomerTypeKnowledge.page_id")
    custom_messages = relationship("CustomMessage", back_populates="page", foreign_keys="CustomMessage.page_id")


class FbCustomer(Base):
    __tablename__ = "fb_customers"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    customer_psid = Column(String(50), nullable=False)
    name = Column(Text)
    first_interaction_at = Column(DateTime(timezone=True))
    last_interaction_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    source_type = Column(String, default='new')
    profile_pic = Column(Text, default='')
    current_category_id = Column(Integer, ForeignKey("customer_type_knowledge.id"))

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('new', 'imported')",
            name="fb_customers_source_type_check"
        ),
    )

    # Relationships
    page = relationship("FacebookPage", back_populates="customers", foreign_keys=[page_id])
    messages = relationship("CustomerMessage", back_populates="customer", foreign_keys="CustomerMessage.customer_id")
    classifications = relationship("FBCustomerClassification", back_populates="customer", foreign_keys="FBCustomerClassification.customer_id")
    custom_classifications = relationship("FBCustomerCustomClassification", back_populates="customer", foreign_keys="FBCustomerCustomClassification.customer_id")
    mining_statuses = relationship("FBCustomerMiningStatus", back_populates="customer", foreign_keys="FBCustomerMiningStatus.customer_id")
    customermessage = relationship("CustomerMessage", back_populates="customer", cascade="all, delete-orphan", foreign_keys="CustomerMessage.customer_id")
    current_category = relationship("CustomerTypeKnowledge", foreign_keys=[current_category_id])

class CustomerTypeCustom(Base):
    __tablename__ = "customer_type_custom"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    type_name = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    examples = Column(ARRAY(Text))
    keywords = Column(ARRAY(Text))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships with explicit foreign_keys
    page = relationship("FacebookPage", back_populates="customer_type_customs")
    old_custom_classifications = relationship(
        "FBCustomerCustomClassification", 
        back_populates="old_category",
        foreign_keys="FBCustomerCustomClassification.old_category_id"
    )
    custom_classifications = relationship(
        "FBCustomerCustomClassification", 
        back_populates="new_category",
        foreign_keys="FBCustomerCustomClassification.new_category_id"
    )
    customer_type_messages = relationship("CustomerTypeMessage", back_populates="customer_type_custom")


class CustomerTypeKnowledge(Base):
    __tablename__ = "customer_type_knowledge"

    id = Column(Integer, primary_key=True)
    type_name = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    examples = Column(ARRAY(Text))
    keywords = Column(ARRAY(Text))
    logic = Column(JSON)
    supports_image = Column(Boolean, default=False)
    image_label_keywords = Column(ARRAY(Text))

    # Relationships with explicit foreign_keys
    old_classifications = relationship(
        "FBCustomerClassification", 
        back_populates="old_category",
        foreign_keys="FBCustomerClassification.old_category_id"
    )
    classifications = relationship(
        "FBCustomerClassification", 
        back_populates="new_category",
        foreign_keys="FBCustomerClassification.new_category_id"
    )
    page_knowledge = relationship("PageCustomerTypeKnowledge", back_populates="knowledge")


class PageCustomerTypeKnowledge(Base):
    __tablename__ = "page_customer_type_knowledge"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    customer_type_knowledge_id = Column(Integer, ForeignKey("customer_type_knowledge.id", ondelete="CASCADE"), nullable=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Fixed relationships
    page = relationship("FacebookPage", back_populates="page_customer_type_knowledge", foreign_keys=[page_id])
    knowledge = relationship("CustomerTypeKnowledge", back_populates="page_knowledge", foreign_keys=[customer_type_knowledge_id])
    messages = relationship("CustomerTypeMessage", back_populates="page_customer_type_knowledge", foreign_keys="CustomerTypeMessage.page_customer_type_knowledge_id")


class CustomerTypeMessage(Base):
    __tablename__ = "customer_type_messages"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    customer_type_custom_id = Column(Integer, ForeignKey("customer_type_custom.id", ondelete="CASCADE"))
    page_customer_type_knowledge_id = Column(Integer, ForeignKey("page_customer_type_knowledge.id", ondelete="CASCADE"))
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    image_data = Column(LargeBinary)

    page = relationship("FacebookPage", back_populates="customer_type_messages")
    customer_type_custom = relationship("CustomerTypeCustom", back_populates="customer_type_messages")
    page_customer_type_knowledge = relationship("PageCustomerTypeKnowledge", back_populates="messages")
    schedules = relationship("MessageSchedule", back_populates="customer_type_message")


class MessageSchedule(Base):
    __tablename__ = "message_schedules"

    id = Column(Integer, primary_key=True)
    customer_type_message_id = Column(Integer, ForeignKey("customer_type_messages.id", ondelete="CASCADE"), nullable=False)
    send_type = Column(String(20), nullable=False)
    scheduled_at = Column(DateTime(timezone=True))
    send_after_inactive = Column(Interval)
    frequency = Column(String(20), default="once")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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

    customer_type_message = relationship("CustomerTypeMessage", back_populates="schedules")


class MessageSets(Base):
    __tablename__ = "message_sets"

    id = Column(Integer, primary_key=True)
    page_id = Column(String(50), ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    set_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("FBCustomMessage", back_populates="message_set", cascade="all, delete-orphan", foreign_keys="FBCustomMessage.message_set_id")
    page = relationship("FacebookPage", back_populates="message_sets", foreign_keys=[page_id])
    custom_messages = relationship("CustomMessage", back_populates="message_set", cascade="all, delete-orphan", foreign_keys="CustomMessage.message_set_id")


class FBCustomMessage(Base):
    __tablename__ = "fb_custom_messages"

    id = Column(Integer, primary_key=True)
    message_set_id = Column(Integer, ForeignKey("message_sets.id", ondelete="CASCADE"), nullable=False)
    page_id = Column(String(50), ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    image_data = Column(LargeBinary)

    message_set = relationship("MessageSets", back_populates="messages", foreign_keys=[message_set_id])
    page = relationship("FacebookPage", back_populates="fb_custom_messages", foreign_keys=[page_id])


class FBCustomerClassification(Base):
    __tablename__ = "fb_customer_classifications"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True)
    customer_id = Column(Integer, ForeignKey("fb_customers.id", ondelete="CASCADE"), nullable=False)
    old_category_id = Column(Integer, ForeignKey("customer_type_knowledge.id", ondelete="SET NULL"))
    new_category_id = Column(Integer, ForeignKey("customer_type_knowledge.id", ondelete="CASCADE"), nullable=False)
    classified_at = Column(DateTime(timezone=True), server_default=func.now())
    classified_by = Column(Text)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)

    customer = relationship("FbCustomer", back_populates="classifications", foreign_keys=[customer_id])
    old_category = relationship("CustomerTypeKnowledge", foreign_keys=[old_category_id], back_populates="old_classifications")
    new_category = relationship("CustomerTypeKnowledge", foreign_keys=[new_category_id], back_populates="classifications")
    page = relationship("FacebookPage", back_populates="fb_customer_classifications", foreign_keys=[page_id])

    def __repr__(self):
        return f"<FbCustomerClassification(id={self.id}, customer_id={self.customer_id}, new_category_id={self.new_category_id}, page_id={self.page_id})>"


class FBCustomerCustomClassification(Base):
    __tablename__ = "fb_customer_custom_classifications"

    id = Column(BigInteger, primary_key=True)
    customer_id = Column(Integer, ForeignKey("fb_customers.id", ondelete="CASCADE"), nullable=False)
    old_category_id = Column(Integer, ForeignKey("customer_type_custom.id", ondelete="SET NULL"))
    new_category_id = Column(Integer, ForeignKey("customer_type_custom.id", ondelete="CASCADE"), nullable=False)
    classified_at = Column(DateTime(timezone=True), server_default=func.now())
    classified_by = Column(Text)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)

    customer = relationship("FbCustomer", back_populates="custom_classifications", foreign_keys=[customer_id])
    old_category = relationship("CustomerTypeCustom", foreign_keys=[old_category_id], back_populates="old_custom_classifications")
    new_category = relationship("CustomerTypeCustom", foreign_keys=[new_category_id], back_populates="custom_classifications")
    page = relationship("FacebookPage", back_populates="fb_customer_custom_classifications", foreign_keys=[page_id])


class FBCustomerMiningStatus(Base):
    __tablename__ = "fb_customer_mining_status"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("fb_customers.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('ยังไม่ขุด', 'ขุดแล้ว', 'มีการตอบกลับ')",
            name="fb_customer_mining_status_check"
        ),
    )

    customer = relationship("FbCustomer", back_populates="mining_statuses", foreign_keys=[customer_id])


class RetargetTiersConfig(Base):
    __tablename__ = "retarget_tiers_config"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, ForeignKey("facebook_pages.ID", ondelete="CASCADE"), nullable=False)
    tier_name = Column(String(50), nullable=False)
    days_since_last_contact = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    page = relationship("FacebookPage", back_populates="retarget_tiers", foreign_keys=[page_id])

    __table_args__ = (
        CheckConstraint(
            "tier_name IN ('หาย', 'หายนาน', 'หายนานมาก')",
            name="chk_tier_name"
        ),
        CheckConstraint(
            "days_since_last_contact > 0",
            name="chk_days_contact"
        ),
    )


class CustomerMessage(Base):
    __tablename__ = "customer_messages"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("fb_customers.id", ondelete="CASCADE"), nullable=True)
    conversation_id = Column(Text, nullable=False)
    sender_id = Column(Text, nullable=False)
    sender_name = Column(Text, nullable=False)
    message_text = Column(Text, nullable=False)
    message_type = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    customer = relationship("FbCustomer", back_populates="customermessage", foreign_keys=[customer_id])
    
class CustomMessage(Base):
    __tablename__ = "custom_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_set_id = Column(Integer, ForeignKey("message_sets.id", ondelete="CASCADE"), nullable=False)
    page_id = Column(String, ForeignKey("facebook_pages.page_id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 🔗 Relationships
    message_set = relationship("MessageSets", back_populates="custom_messages", foreign_keys=[message_set_id])
    page = relationship("FacebookPage", back_populates="custom_messages", foreign_keys=[page_id])