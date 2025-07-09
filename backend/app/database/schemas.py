from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from typing import List, Dict, Any
from datetime import datetime, timedelta

class FacebookPageBase(BaseModel):
    page_id: str
    page_name: str

class FacebookPageCreate(FacebookPageBase):
    pass

class FacebookPageUpdate(BaseModel):
    page_name: Optional[str] = None

class FacebookPageOut(FacebookPageBase):
    ID: int
    created_at: datetime

    class Config:
        orm_mode = True

# ========== FbCustomer Schemas ==========

class FbCustomerBase(BaseModel):
    name: Optional[str] = None
    customer_type_custom_id: Optional[int] = None
    customer_type_knowledge_id: Optional[int] = None

class FbCustomerCreate(FbCustomerBase):
    page_id: int
    customer_psid: str

class FbCustomerUpdate(FbCustomerBase):
    pass

class FbCustomerInDB(FbCustomerBase):
    id: int
    page_id: int
    customer_psid: str
    first_interaction_at: Optional[datetime]
    last_interaction_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class FbCustomerResponse(BaseModel):
    id: int
    psid: str
    name: str
    first_interaction: Optional[str]
    last_interaction: Optional[str]
    customer_type: Optional[str]

class ConversationResponse(BaseModel):
    id: int
    conversation_id: str
    conversation_name: str
    user_name: str
    psids: List[str]
    names: List[str]
    raw_psid: str
    updated_time: Optional[str]
    created_time: Optional[str]
    last_user_message_time: Optional[str]

class SyncResponse(BaseModel):
    status: str
    synced: int
    errors: int
    message: str
    
# ========== CustomerTypeCustom Schemas ==========

class CustomerTypeCustomBase(BaseModel):
    type_name: str
    keywords: Optional[str] = ""
    rule_description: Optional[str] = ""
    examples: Optional[str] = ""

class CustomerTypeCustomCreate(CustomerTypeCustomBase):
    pass

class CustomerTypeCustomUpdate(BaseModel):
    type_name: Optional[str] = None
    keywords: Optional[str] = None
    rule_description: Optional[str] = None
    examples: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerTypeCustomInDB(CustomerTypeCustomBase):
    id: int
    page_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CustomerTypeCustomResponse(BaseModel):
    id: int
    page_id: int
    type_name: str
    keywords: List[str]
    rule_description: str
    examples: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    customer_count: Optional[int] = 0

    class Config:
        orm_mode = True
    rule_description: Optional[str] = ""

class CustomerTypeCustomCreate(CustomerTypeCustomBase):
    pass

class CustomerTypeCustomUpdate(BaseModel):
    type_name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[str] = None
    examples: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerTypeCustomInDB(CustomerTypeCustomBase):
    id: int
    page_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CustomerTypeCustomResponse(BaseModel):
    id: int
    page_id: int
    type_name: str
    keywords: List[str]
    examples: List[str]
    rule_description: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    customer_count: Optional[int] = 0

    class Config:
        orm_mode = True

class CustomerTypeStatistics(BaseModel):
    type_id: Optional[int]
    type_name: str
    customer_count: int
    is_active: bool
    
# ========== CustomerTypeMessage Schemas ==========

class CustomerTypeMessageBase(BaseModel):
    message_type: str
    content: str
    dir: Optional[str] = ""
    display_order: int

class CustomerTypeMessageCreate(CustomerTypeMessageBase):
    customer_type_custom_id: Optional[int] = None
    page_customer_type_knowledge_id: Optional[int] = None

class CustomerTypeMessageUpdate(BaseModel):
    message_type: Optional[str] = None
    content: Optional[str] = None
    dir: Optional[str] = None
    display_order: Optional[int] = None

class CustomerTypeMessageInDB(CustomerTypeMessageBase):
    id: int
    page_id: int
    customer_type_custom_id: Optional[int]
    page_customer_type_knowledge_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CustomerTypeMessageResponse(BaseModel):
    id: int
    page_id: int
    customer_type_custom_id: Optional[int]
    message_type: str
    content: str
    dir: str
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class BulkMessagesCreate(BaseModel):
    messages: List[Dict[str, Any]]
    
# ========== MessageSchedule Schemas ==========

class MessageScheduleBase(BaseModel):
    send_type: str  # immediate, scheduled, after_inactive
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[timedelta] = None
    frequency: Optional[str] = "once"

class MessageScheduleCreate(MessageScheduleBase):
    customer_type_message_id: int

class MessageScheduleUpdate(BaseModel):
    send_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_after_inactive: Optional[timedelta] = None
    frequency: Optional[str] = None

class MessageScheduleInDB(MessageScheduleBase):
    id: int
    customer_type_message_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class ScheduleWithMessagesCreate(BaseModel):
    type: str  # immediate, scheduled, user-inactive
    date: Optional[str] = None
    time: Optional[str] = None
    inactivityPeriod: Optional[str] = None
    inactivityUnit: Optional[str] = None
    repeat: Optional[Dict[str, Any]] = {"type": "once"}
    groups: List[int]
    messages: List[Dict[str, Any]]

class ScheduleDetailResponse(BaseModel):
    id: int
    group_id: int
    group_name: str
    type: str
    scheduled_at: Optional[str]
    send_after_inactive: Optional[str]
    frequency: str
    messages: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime