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