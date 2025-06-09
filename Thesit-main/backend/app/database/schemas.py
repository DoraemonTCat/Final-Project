from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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