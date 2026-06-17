from pydantic import BaseModel, EmailStr, model_validator
from uuid import UUID

class UserCreate(BaseModel):
    name: str
    phone: str | None = None
    email: EmailStr | None = None
    password: str
    activation_code: str | None = None
    code_type: str | None = "rid" # rid or product_code
    
    # Financial Selection (Pay-in)
    payment_method: str = "mobile_money" # mobile_money, paystack, stripe
    payment_number: str | None = None # Email for paystack/stripe, phone for momo
    payment_provider: str | None = "MTN"
    
    # Earning Details (Pay-out)
    payout_method: str = "mobile_money"
    payout_number: str | None = None
    payout_provider: str | None = "MTN"
    payout_name: str | None = None
    
    # Pricing
    purchase_amount: float | None = 20.0
    preferred_currency: str | None = "GHS"
    
    # Notifications
    preferred_notification_method: str | None = "auto"

    @model_validator(mode='after')
    def check_contact_method(self) -> 'UserCreate':
        if not self.phone and not self.email:
            raise ValueError('Either phone or email must be provided')
        return self

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    rid: str | None = None
    tier_type: str
    role: str
    status: str
    preferred_payment_method: str
    product_codes: list[str] = []
    seller_percentage: float | None = 0.70
    activation_price: float | None = 20.0
    min_withdrawal: float | None = 50.0
    withdrawal_fee: float | None = 2.0
    default_currency: str | None = "GHS"
    
    # Elite Personalization
    learning_goal: str | None = "General Exploration"
    preferred_style: str | None = "Balanced"
    onboarding_completed: bool = False
    last_onboarding_step: int = 0
    is_beta_user: bool = True
    
    # Notifications
    preferred_notification_method: str = "auto"
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class RegistrationResponse(BaseModel):
    user: UserResponse
    token: Token
    paystack_url: str | None = None

class OnboardingUpdate(BaseModel):
    step: int | None = None
    learning_goal: str | None = None
    preferred_style: str | None = None
    onboarding_completed: bool | None = None

class UserProfileUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    preferred_payment_method: str | None = None
    momo_provider: str | None = None
    momo_number: str | None = None
    momo_name: str | None = None
    payout_method: str | None = None
    payout_number: str | None = None
    payout_provider: str | None = None
    payout_name: str | None = None
    learning_goal: str | None = None
    preferred_style: str | None = None
    current_password: str | None = None
    new_password: str | None = None
    preferred_notification_method: str | None = None
