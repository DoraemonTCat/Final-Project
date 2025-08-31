from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


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

    class Config:
        orm_mode = True

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

class FbCustomerSchema(BaseModel):
    id: int
    page_id: int
    customer_psid: str
    name: Optional[str]
    customer_type_custom_id: Optional[int]
    customer_type_knowledge_id: Optional[int]
    first_interaction_at: Optional[datetime]
    last_interaction_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    source_type: str
    mining_status: str  # เพิ่มฟิลด์นี้
    current_tier: Optional[str]  # เพิ่มฟิลด์นี้

    class Config:
        orm_mode = True
    
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