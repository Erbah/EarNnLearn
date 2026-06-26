from pydantic import BaseModel, ConfigDict
from uuid import UUID

class CodeCreate(BaseModel):
    tier_type: str = "public"
    price: float = 20.00
    currency: str = "GHS"

class CodeResponse(BaseModel):
    id: UUID
    generated_rid: str | None = None
    product_code: str | None = None
    owner_rid: str
    parent_rid: str | None = None
    used: bool
    price: float
    tier_type: str
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class ActivationRequest(BaseModel):
    product_code: str

class SellerInfoResponse(BaseModel):
    seller_name: str
    account_number: str
    provider: str
    method: str
    amount: float
    currency: str

class PaymentSubmission(BaseModel):
    product_code: str
    payment_reference: str

class BuyCodeRequest(BaseModel):
    min_price: float
    currency: str

class BuySponsorRequest(BaseModel):
    product_code: str

class LegacyActivationRequest(BaseModel):
    activation_code: str
    code_type: str = "rid"
    payment_method: str
    payment_reference: str
    payment_account: str
    amount: float = 100.0

class SimulationRequest(BaseModel):
    amount: float
    currency: str = "GHS"
