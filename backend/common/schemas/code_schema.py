from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class CodeCreate(BaseModel):
    tier_type: str = "public"
    price: float = 20.00
    currency: str = "GHS"

class CodeResponse(BaseModel):
    id: UUID
    product_code: str | None = None
    activation_rid: str | None = None
    is_active: bool = True
    status: str | None = None # UNUSED, USED, ACTIVE
    usage_count: int = 0
    price: float = 0.0
    tier_type: str = "PUBLIC_POOL"
    
    class Config:
        from_attributes = True

class ActivationRequest(BaseModel):
    product_code: str

class PaymentProfileCreate(BaseModel):
    payment_method: str = Field(..., example="mobile_money")
    provider: str = Field(..., example="MTN")
    account_number: str = Field(..., example="0241234567")
    account_name: str = Field(..., example="Fredrick Erbah")

class PaymentProfileResponse(BaseModel):
    id: UUID
    payment_method: str
    provider: str
    account_number: str
    account_name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentSubmissionRequest(BaseModel):
    product_code: str # The PC being bought
    payment_reference: str # MoMo ID / Transaction Reference
