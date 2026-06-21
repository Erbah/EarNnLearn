from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
import uuid

# ═══════════════════════════════════════
#  ADMIN SCHEMAS
# ═══════════════════════════════════════

class SettingUpdate(BaseModel):
    value: str

class SettingOut(BaseModel):
    key: str
    value: str
    description: str | None = None
    class Config:
        from_attributes = True

class TierUpdate(BaseModel):
    code_percentage: int | None = None
    seller_share: float | None = None
    family_share: float | None = None
    master_share: float | None = None

class TierOut(BaseModel):
    id: str
    name: str
    code_percentage: int
    seller_share: float
    family_share: float
    master_share: float
    is_active: bool
    class Config:
        from_attributes = True

class TierGenConfig(BaseModel):
    tier_type: str
    count: int = 10
    price: float = 20.0
    platform_share: float | None = 40.0
    seller_share: float | None = 30.0
    family_share: float | None = 30.0

class CodeGenRequest(BaseModel):
    configs: list[TierGenConfig]
    owner_rid: str | None = None  # Defaults to master

class CodeUpdate(BaseModel):
    tier_type: str
    price: float | None = None
    platform_share: float | None = None
    seller_share: float | None = None
    family_share: float | None = None

class UserOut(BaseModel):
    id: uuid.UUID
    rid: str | None
    name: str | None
    email: str
    tier_type: str
    status: str
    parent_rid: str | None
    class Config:
        from_attributes = True

class AnalyticsOut(BaseModel):
    total_users: int
    activated_users: int
    total_revenue: float
    codes_used: int
    codes_available: int
    total_payouts: float
    top_promoters: list[dict]
    community_pot_balance: float

class AdminLogOut(BaseModel):
    action: str
    details: dict | None
    created_at: datetime
    class Config:
        from_attributes = True

class WithdrawalRequestOut(BaseModel):
    id: str
    user_rid: str
    amount: Decimal
    status: str
    payout_method: str
    payout_details: dict | None
    created_at: datetime
    class Config:
        from_attributes = True

class CodeGenerationSessionOut(BaseModel):
    id: str | uuid.UUID
    tier_type: str
    count: int
    price: float
    platform_share: float
    seller_share: float
    family_share: float
    created_at: datetime
    class Config:
        from_attributes = True

class AIAdviceOut(BaseModel):
    advice: str
    type: str  # info, warning, success
    score: int # 0-100

class AIStrategyOut(BaseModel):
    health_score: int
    trends: list[str]
    global_recommendation: str
    suggested_config: dict | None = None

class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    link: str | None
    type: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class CourseApprovalRequest(BaseModel):
    reason: str | None = None

class AIConfigUpdate(BaseModel):
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None
