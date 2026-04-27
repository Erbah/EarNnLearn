from pydantic import BaseModel, EmailStr
from uuid import UUID

class UserCreate(BaseModel):
    name: str
    display_name: str | None = None
    email: EmailStr
    phone: str
    password: str
    activation_code: str | None = None # RID for initial entry
    referred_by: str | None = None # Product Code of sponsor
    
    # Payment Profile Setup (Self-receiving details)
    payment_method: str = "mobile_money"
    payment_provider: str | None = "MTN"
    account_number: str | None = None
    account_name: str | None = None

class UserResponse(BaseModel):
    id: UUID
    name: str
    display_name: str | None = None
    email: EmailStr
    tier_type: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
