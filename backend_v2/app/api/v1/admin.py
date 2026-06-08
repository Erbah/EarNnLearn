"""
CediTrees 2.0 — Admin API Router
==================================
Full control center for the platform:
- System settings CRUD
- Code generation
- User management
- Tier configuration
- Season control
- Analytics overview
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from pydantic import BaseModel
from typing import Annotated
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import get_current_user, create_access_token, verify_password, get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.models.code import Code
from app.models.transaction import Transaction, ReferralIndex
from app.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season, CodeGenerationSession
from app.models.course import Course
from app.models.notification import Notification
from app.services.code_engine import generate_admin_rid
from app.services.ai_engine import ai_tutor_engine
from app.core.permissions import require_super_admin, require_education_admin, ROLE_SUPER_ADMIN, ROLE_EDUCATION_ADMIN

router = APIRouter()

# ─── Elevation / Auth Logic ───
class AdminLoginRequest(BaseModel):
    admin_password: str

class CredentialUpdateRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/login")
def login_admin(body: AdminLoginRequest, db: Session = Depends(get_db)):
    """Log in strictly as a Super Admin bypass using the master password."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        # Default fallback using environment variable
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.admin_password != initial_password:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
        # Initialize the setting if missing
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(initial_password), description="Admin Dashboard Login"))
        db.commit()
    
    # Find the actual super admin user to issue a real token
    admin_user = db.query(User).filter(User.role == ROLE_SUPER_ADMIN).first()
    if not admin_user:
        raise HTTPException(status_code=500, detail="No Super Admin user found in database")

    new_token = create_access_token(
        data={"sub": admin_user.rid, "tier_type": "admin"}
    )
    
    return {"status": "authenticated", "tier_type": "admin", "token": new_token}

@router.put("/credentials")
def update_admin_credentials(
    body: CredentialUpdateRequest, 
    current_user: Annotated[User, Depends(require_super_admin)], 
    db: Session = Depends(get_db)
):
    """Update the root admin master password."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.current_password, setting.value):
            raise HTTPException(status_code=403, detail="Current password incorrect")
        setting.value = get_password_hash(body.new_password)
    else:
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.current_password != initial_password:
            raise HTTPException(status_code=403, detail="Current password incorrect")
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(body.new_password), description="Admin Dashboard Login"))
        
    db.commit()
    return {"status": "success", "detail": "Admin credentials updated"}

class ElevateRequest(BaseModel):
    admin_password: str

@router.post("/elevate")
def elevate_to_admin(body: ElevateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elevate the current user to SUPER_ADMIN if the correct master password is provided."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        # Default fallback using environment variable
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.admin_password != initial_password:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
        # Initialize the setting if missing
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(initial_password), description="Admin Dashboard Login"))
        db.commit()
    
    current_user.role = ROLE_SUPER_ADMIN
    db.commit()
    
    # Issue a fresh token so next requests pass the role check correctly if needed
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    sub_claim = current_user.rid if current_user.rid else current_user.email
    new_token = create_access_token(
        data={"sub": sub_claim, "role": ROLE_SUPER_ADMIN}, expires_delta=access_token_expires
    )
    
    return {"status": "elevated", "role": ROLE_SUPER_ADMIN, "token": new_token}


# ═══════════════════════════════════════
#  SCHEMAS
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
    id: str
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


# ═══════════════════════════════════════
#  DASHBOARD OVERVIEW / ANALYTICS
# ═══════════════════════════════════════
@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    
    total_users = db.query(func.count(User.id)).scalar() or 0
    activated_users = db.query(func.count(User.id)).filter(User.rid != None).scalar() or 0
    
    total_revenue = db.query(func.sum(Transaction.amount)).filter(Transaction.status == "success").scalar() or 0
    
    codes_used = db.query(func.count(Code.id)).filter(Code.used == True).scalar() or 0
    codes_available = db.query(func.count(Code.id)).filter(Code.used == False, Code.product_code != None).scalar() or 0
    
    total_payouts = db.query(func.sum(WalletTransaction.amount)).filter(
        WalletTransaction.type.like("CREDIT_PROFIT%")
    ).scalar() or 0

    # Top 5 promoters by number of direct referrals
    top = db.query(
        ReferralIndex.parent_rid,
        func.count(ReferralIndex.user_rid).label("network_size")
    ).filter(
        ReferralIndex.parent_rid != None
    ).group_by(ReferralIndex.parent_rid).order_by(desc("network_size")).limit(5).all()

    top_promoters = []
    for row in top:
        if row[0]:  # skip null parent_rid
            top_promoters.append({"rid": row[0], "network_size": row[1]})

    return AnalyticsOut(
        total_users=total_users,
        activated_users=activated_users,
        total_revenue=float(total_revenue),
        codes_used=codes_used,
        codes_available=codes_available,
        total_payouts=float(total_payouts),
        top_promoters=top_promoters
    )


# ═══════════════════════════════════════
#  SYSTEM SETTINGS
# ═══════════════════════════════════════
@router.get("/settings", response_model=list[SettingOut])
def get_all_settings(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@router.put("/settings/{key}", response_model=SettingOut)
def update_setting(key: str, body: SettingUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=body.value)
        db.add(setting)
    else:
        setting.value = body.value
    
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Updated setting: {key}", details={"new_value": body.value}))
    db.commit()
    db.refresh(setting)
    return setting


# ═══════════════════════════════════════
#  AI MODEL MANAGEMENT
# ═══════════════════════════════════════
@router.get("/ai-settings")
def get_ai_settings(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Get active AI provider and model configuration."""
    
    provider = db.query(SystemSetting).filter(SystemSetting.key == "ai_provider").first()
    model = db.query(SystemSetting).filter(SystemSetting.key == "ai_model").first()
    base_url = db.query(SystemSetting).filter(SystemSetting.key == "ai_base_url").first()
    
    from app.core.config import Settings
    settings_obj = Settings()
    
    return {
        "active_provider": provider.value if provider else settings_obj.AI_PROVIDER,
        "active_model": model.value if model else settings_obj.AI_MODEL,
        "active_base_url": base_url.value if base_url else None,
        "is_custom": provider is not None or model is not None
    }

@router.put("/ai-settings")
def update_ai_settings(body: AIConfigUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Dynamically switch AI models and providers (Qwen, DeepSeek, Ollama, etc.)"""
    
    # 1. Update Provider
    provider_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_provider").first()
    if not provider_setting:
        provider_setting = SystemSetting(key="ai_provider", value=body.provider, description="Active AI Provider (openai, google, deepseek, ollama, etc.)")
        db.add(provider_setting)
    else:
        provider_setting.value = body.provider
        
    # 2. Update Model
    model_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_model").first()
    if not model_setting:
        model_setting = SystemSetting(key="ai_model", value=body.model, description="Specific LLM Model String")
        db.add(model_setting)
    else:
        model_setting.value = body.model
        
    # 3. Optional: Update Global API Key if provided
    if body.api_key:
        key_setting = db.query(SystemSetting).filter(SystemSetting.key == "AI_API_KEY").first()
        if not key_setting:
            key_setting = SystemSetting(key="AI_API_KEY", value=body.api_key, description="Universal AI API Key override")
            db.add(key_setting)
        else:
            key_setting.value = body.api_key
            
    # 4. Optional: Update Base URL (for Ollama Cloud / Self-hosted)
    if body.base_url:
        url_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_base_url").first()
        if not url_setting:
            url_setting = SystemSetting(key="ai_base_url", value=body.base_url, description="Base URL for AI Provider (e.g. Ollama Cloud)")
            db.add(url_setting)
        else:
            url_setting.value = body.base_url

    db.add(AdminLog(admin_rid=current_user.rid, action="Updated AI Master Strategy", details={"provider": body.provider, "model": body.model}))
    db.commit()
    
    return {"status": "success", "message": f"AI Strategy updated to {body.model} via {body.provider}"}


# ═══════════════════════════════════════
#  TIER MANAGEMENT
# ═══════════════════════════════════════
@router.get("/tiers", response_model=list[TierOut])
def get_tiers(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    return db.query(Tier).all()

@router.put("/tiers/{tier_name}", response_model=TierOut)
def update_tier(tier_name: str, body: TierUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    tier = db.query(Tier).filter(Tier.name == tier_name).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    if body.code_percentage is not None:
        tier.code_percentage = body.code_percentage
    if body.seller_share is not None:
        tier.seller_share = body.seller_share
    if body.family_share is not None:
        tier.family_share = body.family_share
    if body.master_share is not None:
        tier.master_share = body.master_share

    db.add(AdminLog(admin_rid=current_user.rid, action=f"Updated tier: {tier_name}", details=body.dict(exclude_none=True)))
    db.commit()
    db.refresh(tier)
    return tier


# ═══════════════════════════════════════
#  CODE GENERATION
# ═══════════════════════════════════════
@router.post("/codes/generate")
def generate_codes(body: CodeGenRequest, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    
    owner = body.owner_rid or current_user.rid
    codes_created = []
    
    for config in body.configs:
        session_id = uuid.uuid4()
        session_record = CodeGenerationSession(
            id=session_id,
            tier_type=config.tier_type,
            count=config.count,
            price=config.price,
            platform_share=config.platform_share,
            seller_share=config.seller_share,
            family_share=config.family_share
        )
        db.add(session_record)

        for _ in range(config.count):
            code = Code(
                generated_rid=generate_admin_rid(),
                owner_rid=owner,
                price=config.price,
                tier_type=config.tier_type,
                platform_share=config.platform_share,
                seller_share=config.seller_share,
                family_share=config.family_share,
                session_id=session_id
            )
            db.add(code)
            codes_created.append(code.generated_rid)
    
    db.add(AdminLog(
        admin_rid=current_user.rid,
        action=f"Generated {len(codes_created)} codes across {len(body.configs)} tiers",
        details={"configs": [c.dict() for c in body.configs], "owner": owner}
    ))
    db.commit()
    return {"generated": len(codes_created), "codes": codes_created}

@router.get("/codes/sessions", response_model=list[CodeGenerationSessionOut])
def get_generation_sessions(current_user: Annotated[User, Depends(require_super_admin)], limit: int = 20, db: Session = Depends(get_db)):
    """Retrieve history of RID generation sessions for AI analysis."""
    return db.query(CodeGenerationSession).order_by(desc(CodeGenerationSession.created_at)).limit(limit).all()

@router.get("/ai/advice", response_model=AIAdviceOut)
def get_ai_advice(
    tier_type: str,
    price: float,
    platform_share: float,
    seller_share: float,
    family_share: float,
    current_user: Annotated[User, Depends(require_super_admin)],
    db: Session = Depends(get_db)
):
    """
    Active AI Advisor: Analyzes current configuration against heuristics 
    and historical trends to provide optimization advice.
    """
    
    advice_parts = []
    score = 100
    advice_type = "success"

    # 1. Historical Context (Simplified)
    # In a real scenario, we'd average the last N sessions
    # For now, let's use some smart defaults for comparison
    avg_price = 20.0 if tier_type == "public" else 50.0
    
    # 2. Heuristic Analysis
    # Platform Share
    if platform_share > 45:
        advice_parts.append("High platform fee detected. This might discourage user recruitment in early stages.")
        score -= 15
        advice_type = "warning"
    elif platform_share < 15:
        advice_parts.append("Platform fee is very low. Ensure this covers infrastructure costs.")
        score -= 5
        if advice_type != "warning": advice_type = "info"

    # Incentives (Seller + Family)
    total_incentive = seller_share + family_share
    if total_incentive < 40:
        advice_parts.append("Network incentives are below optimal threshold. Growth speed may be slow.")
        score -= 20
        advice_type = "warning"
    elif seller_share < 20:
         advice_parts.append("Direct seller commission is low. Promoters might prioritize other platforms.")
         score -= 10
    
    # Tier Specific Advice
    if tier_type == "ngo" and price > 100:
        advice_parts.append("NGO code price seems high. Typically these are kept accessible (₵10-₵50).")
        score -= 10
    elif tier_type == "creator" and total_incentive > 70:
        advice_parts.append("Excellent creator incentive profile! Expect high retention from influencers.")
        score += 5

    # Final Compilation
    if not advice_parts:
        advice = "Configuration is perfectly balanced based on current market trends."
    else:
        advice = " ".join(advice_parts)

    if score < 60: advice_type = "warning"
    elif score > 85: advice_type = "success"
    else: advice_type = "info"

    return AIAdviceOut(advice=advice, type=advice_type, score=max(0, min(100, score)))


@router.get("/ai/strategy", response_model=AIStrategyOut)
def get_ai_strategy(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """
    Global Platform Advisor: Evaluates long-term ecosystem health 
    based on aggregated generation sessions.
    """
    
    sessions = db.query(CodeGenerationSession).order_by(desc(CodeGenerationSession.created_at)).limit(50).all()
    
    if not sessions:
        return AIStrategyOut(
            health_score=100,
            trends=["No historical data yet. Platform is in pristine state."],
            global_recommendation="Begin by generating a balanced batch for Public users (40/30/30 split)."
        )

    # Simple Trend Analysis
    recent = sessions[:5]
    historical = sessions[5:]
    
    trends = []
    health_score = 90
    
    # 1. Price Drift
    avg_recent_price = sum(s.price for s in recent) / len(recent)
    if historical:
        avg_hist_price = sum(s.price for s in historical) / len(historical)
        if avg_recent_price > avg_hist_price * 1.2:
            trends.append("Price is trending upwards (+20%). Monitor for accessibility barrier.")
            health_score -= 10
        elif avg_recent_price < avg_hist_price * 0.8:
            trends.append("Price is trending downwards. Good for volume, watch revenue margins.")

    # 2. Incentive Drift (Seller Share)
    avg_seller_share = sum(s.seller_share for s in recent) / len(recent)
    if avg_seller_share < 25:
        trends.append("Seller incentives are currently low. Risk of reduced network growth.")
        health_score -= 15
    elif avg_seller_share > 40:
        trends.append("Aggressive seller incentives detected. Excellent for rapid expansion.")
        health_score += 5

    # 3. Participation Variety
    tiers = set(s.tier_type for s in sessions)
    if len(tiers) < 3:
        trends.append("Limited tier usage. Consider engaging Creators or NGOs to diversify ecosystem.")
        health_score -= 10

    # Suggested Config for Next Batch
    suggested = {
        "tier_type": "public",
        "price": 25.0,
        "platform_share": 35.0,
        "seller_share": 35.0,
        "family_share": 30.0
    } if avg_seller_share < 30 else {
        "tier_type": "public",
        "price": 20.0,
        "platform_share": 40.0,
        "seller_share": 30.0,
        "family_share": 30.0
    }

    return AIStrategyOut(
        health_score=max(0, min(100, health_score)),
        trends=trends,
        global_recommendation="Ecosystem is stable. Focus on NGO integration to boost community impact." if health_score > 80 else "Growth re-alignment recommended. Increase seller shares for the next 3 batches.",
        suggested_config=suggested
    )


@router.get("/codes")
def list_codes(current_user: Annotated[User, Depends(require_super_admin)], search: str | None = None, db: Session = Depends(get_db)):
    
    q = db.query(Code)
    if search:
        search_filter = f"%{search}%"
        q = q.filter(
            (Code.product_code.ilike(search_filter)) | 
            (Code.generated_rid.ilike(search_filter)) |
            (Code.owner_rid.ilike(search_filter))
        )
    
    codes = q.order_by(desc(Code.created_at)).limit(100).all()
    
    return [
        {
            "id": str(c.id),
            "rid_code": c.generated_rid or c.product_code or "N/A",
            "is_used": c.used,
            "price": float(c.price),
            "currency": c.currency,
            "tier_type": c.tier_type,
            "platform_share": float(c.platform_share) if c.platform_share else None,
            "seller_share": float(c.seller_share) if c.seller_share else None,
            "family_share": float(c.family_share) if c.family_share else None
        } for c in codes
    ]

@router.get("/codes/stats")
def get_code_stats(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    
    total = db.query(func.count(Code.id)).scalar() or 0
    used = db.query(func.count(Code.id)).filter(Code.used == True).scalar() or 0
    unused = total - used
    
    return {
        "total": total,
        "used": used,
        "unused": unused
    }

import uuid

@router.put("/codes/{code_id}")
def update_code_tier(code_id: str, body: CodeUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    
    # Cast to UUID to avoid SQLAlchemy error
    try:
        u_id = uuid.UUID(code_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid code ID format")

    code = db.query(Code).filter(Code.id == u_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
        
    code.tier_type = body.tier_type
    if body.price is not None:
        code.price = body.price
    if body.platform_share is not None:
        code.platform_share = body.platform_share
    if body.seller_share is not None:
        code.seller_share = body.seller_share
    if body.family_share is not None:
        code.family_share = body.family_share
        
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Updated code: {code_id}", details=body.dict()))
    db.commit()
    return {"status": "success"}

@router.delete("/codes/{code_id}")
def delete_individual_code(code_id: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    try:
        u_id = uuid.UUID(code_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid code ID format")
        
    code = db.query(Code).filter(Code.id == u_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
        
    if code.used:
        raise HTTPException(status_code=400, detail="Cannot delete a code that has already been used")
        
    db.delete(code)
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Deleted individual code: {code_id}"))
    db.commit()
    return {"status": "success"}

@router.delete("/codes/sessions/{session_id}")
def delete_generation_session(session_id: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    try:
        s_id = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
        
    session = db.query(CodeGenerationSession).filter(CodeGenerationSession.id == s_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Delete all UNUSED codes associated with this session
    deleted_count = db.query(Code).filter(Code.session_id == s_id, Code.used == False).delete(synchronize_session=False)
    
    # Check if any codes in this session ARE used
    used_count = db.query(Code).filter(Code.session_id == s_id, Code.used == True).count()
    
    if used_count == 0:
        db.delete(session)
        msg = f"Deleted session and {deleted_count} unused codes."
    else:
        msg = f"Deleted {deleted_count} unused codes. Session record kept because {used_count} codes are already used."
        
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Deleted session codes: {session_id}", details={"deleted": deleted_count, "kept_used": used_count}))
    db.commit()
    return {"status": "success", "message": msg, "deleted_count": deleted_count, "kept_used": used_count}

@router.delete("/codes/purge-unused")
def purge_all_unused_codes(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    deleted_count = db.query(Code).filter(Code.used == False).delete(synchronize_session=False)
    db.add(AdminLog(admin_rid=current_user.rid, action="Purged all unused RIDs", details={"deleted_count": deleted_count}))
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}


# ═══════════════════════════════════════
#  USER MANAGEMENT
# ═══════════════════════════════════════
@router.get("/users", response_model=list[UserOut])
def list_users(current_user: Annotated[User, Depends(require_super_admin)], skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(User).offset(skip).limit(limit).all()

@router.get("/users/{rid}")
def get_user_detail(rid: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    wallet = db.query(Wallet).filter(Wallet.user_rid == rid).first()
    txs = db.query(WalletTransaction).filter(WalletTransaction.user_rid == rid).order_by(desc(WalletTransaction.created_at)).limit(20).all()
    codes = db.query(Code).filter(Code.owner_rid == rid).all()
    ref_idx = db.query(ReferralIndex).filter(ReferralIndex.user_rid == rid).first()
    
    # Count direct children
    children_count = db.query(func.count(ReferralIndex.user_rid)).filter(ReferralIndex.parent_rid == rid).scalar() or 0
    
    return {
        "user": {"id": str(user.id), "rid": user.rid, "name": user.name, "email": user.email, "tier_type": user.tier_type, "status": user.status, "parent_rid": user.parent_rid},
        "wallet": {"balance": float(wallet.balance) if wallet else 0, "withdrawable": float(wallet.withdrawable_balance) if wallet else 0},
        "transactions": [{"type": t.type, "amount": float(t.amount), "description": t.description} for t in txs],
        "codes_count": len(codes),
        "codes_unused": len([c for c in codes if not c.used]),
        "children_count": children_count,
        "depth": ref_idx.depth if ref_idx else 0,
        "path": ref_idx.path if ref_idx else None
    }

@router.post("/users/{rid}/suspend")
def suspend_user(rid: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "suspended"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Suspended user: {rid}"))
    db.commit()
    return {"status": "User suspended"}

@router.post("/users/{rid}/activate")
def reactivate_user(rid: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Reactivated user: {rid}"))
    db.commit()
    return {"status": "User reactivated"}

@router.post("/users/{rid}/adjust-wallet")
def adjust_wallet(rid: str, amount: float, current_user: Annotated[User, Depends(require_super_admin)], reason: str = "Admin adjustment", db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_rid == rid).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    wallet.balance += Decimal(str(amount))
    wallet.withdrawable_balance += Decimal(str(amount))
    db.add(WalletTransaction(user_rid=rid, type="ADMIN_ADJUSTMENT", amount=Decimal(str(amount)), description=reason))
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Wallet adjustment: {rid}", details={"amount": amount, "reason": reason}))
    db.commit()
    return {"status": "Wallet adjusted", "new_balance": float(wallet.balance)}


# ═══════════════════════════════════════
#  SEASON MANAGEMENT
# ═══════════════════════════════════════
class SeasonCreate(BaseModel):
    season_number: int
    start_date: datetime
    end_date: datetime | None = None

@router.get("/seasons")
def list_seasons(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    return db.query(Season).order_by(desc(Season.start_date)).all()

@router.post("/seasons")
def create_season(body: SeasonCreate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    
    # Deactivate other seasons to ensure only one is active (optional but recommended)
    db.query(Season).filter(Season.is_active == True).update({"is_active": False})
    
    season = Season(
        season_number=body.season_number, 
        start_date=body.start_date,
        end_date=body.end_date,
        is_active=True
    )
    db.add(season)
    db.commit()
    db.refresh(season)
    return season

@router.delete("/seasons/{season_id}/rids")
def delete_season_rids(
    season_id: str, 
    confirmation_phrase: str,
    current_user: Annotated[User, Depends(require_super_admin)], 
    password: str = None, # Optional but recommended
    db: Session = Depends(get_db)
):
    
    if confirmation_phrase != "DELETE RID SEASON":
        raise HTTPException(status_code=400, detail="Invalid confirmation phrase")

    # Locate the season to find its created_at or other markers if needed
    # For now, we assume RIDs are tagged by tier/date since we don't have a season_id in Code model yet
    # Let's check if we need to add season_id to Code model or if we filter by date range
    season = db.query(Season).filter(Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # Filter codes created within this season's range
    query = db.query(Code).filter(
        Code.used == False,
        Code.generated_rid != None,
        Code.created_at >= season.start_date
    )
    if season.end_date:
        query = query.filter(Code.created_at <= season.end_date)
    
    count = query.delete(synchronize_session=False)
    
    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action="DELETED SEASON RIDS", 
        details={"season_id": season_id, "deleted_count": count}
    ))
    db.commit()
    
    return {"status": "success", "deleted_count": count}


# ═══════════════════════════════════════
#  COURSE APPROVALS
# ═══════════════════════════════════════
@router.get("/courses/pending")
def list_pending_courses(current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    return db.query(Course).filter(Course.approval_status == "pending").order_by(desc(Course.created_at)).all()

@router.post("/courses/{course_id}/approve")
def approve_course(course_id: str, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.approval_status = "approved"
    course.is_published = True
    course.approval_remarks = None
    
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Approved course: {course.title} ({course_id})"))
    db.commit()
    return {"status": "success", "message": f"Course '{course.title}' approved and published."}

@router.post("/courses/{course_id}/ai-review")
def get_course_ai_review(course_id: str, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # In a real app, this might cost the platform money, so we restrict it to admins
    review = ai_tutor_engine.get_ai_course_review(
        title=course.title,
        description=course.description,
        category=course.category,
        price=float(course.price)
    )
    return review

@router.post("/courses/{course_id}/reject")
def reject_course(course_id: str, body: CourseApprovalRequest, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.approval_status = "rejected"
    course.is_published = False
    course.approval_remarks = body.reason
    
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Rejected course: {course.title} ({course_id})", details={"reason": body.reason}))
    db.commit()
    return {"status": "success", "message": f"Course '{course.title}' rejected with feedback."}

# ═══════════════════════════════════════
#  NOTIFICATIONS
# ═══════════════════════════════════════
@router.get("/notifications", response_model=list[NotificationOut])
def get_admin_notifications(current_user: Annotated[User, Depends(require_education_admin)], limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Notification).order_by(desc(Notification.created_at)).limit(limit).all()

@router.post("/notifications/{note_id}/read")
def mark_notification_read(note_id: str, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    note = db.query(Notification).filter(Notification.id == note_id).first()
    if note:
        note.is_read = True
        db.commit()
    return {"status": "success"}

# ═══════════════════════════════════════
#  WITHDRAWAL MANAGEMENT
# ═══════════════════════════════════════
@router.get("/withdrawals/pending", response_model=list[WithdrawalRequestOut])
def get_pending_withdrawals(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    return db.query(WithdrawalRequest).filter(WithdrawalRequest.status == "PENDING").all()

@router.post("/withdrawals/{request_id}/approve")
def approve_withdrawal(request_id: str, current_user: Annotated[User, Depends(require_super_admin)], admin_notes: str = None, db: Session = Depends(get_db)):
    req = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request already processed")

    req.status = "APPROVED"
    req.admin_notes = admin_notes
    req.processed_at = datetime.utcnow()
    
    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action=f"Approved withdrawal: {request_id}", 
        details={"user": req.user_rid, "amount": float(req.amount)}
    ))
    db.commit()
    return {"status": "success"}

@router.post("/withdrawals/{request_id}/reject")
def reject_withdrawal(request_id: str, reason: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    req = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request already processed")

    # Return funds to wallet
    wallet = db.query(Wallet).filter(Wallet.user_rid == req.user_rid).first()
    if wallet:
        wallet.withdrawable_balance += req.amount
        wallet.balance += req.amount
        db.add(WalletTransaction(
            user_rid=req.user_rid,
            type="CREDIT_REFUND",
            amount=req.amount,
            description=f"Refund from rejected withdrawal: {reason}"
        ))

    req.status = "REJECTED"
    req.admin_notes = reason
    req.processed_at = datetime.utcnow()
    
    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action=f"Rejected withdrawal: {request_id}", 
        details={"user": req.user_rid, "reason": reason}
    ))
    db.commit()
    return {"status": "success"}


class TransactionOut(BaseModel):
    id: uuid.UUID
    code_id: uuid.UUID | None
    buyer_rid: str
    seller_rid: str
    amount: Decimal
    currency: str
    payment_method: str | None
    payment_reference: str | None
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

# ═══════════════════════════════════════
#  TRANSACTION / PAYMENT MANAGEMENT
# ═══════════════════════════════════════
@router.get("/payments/pending", response_model=list[TransactionOut])
def get_pending_payments(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Retrieve all pending manual payment submissions for review."""
    return db.query(Transaction).filter(Transaction.status == "pending").order_by(desc(Transaction.created_at)).all()

@router.post("/payments/{transaction_id}/approve")
def approve_payment(transaction_id: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """
    Manually approve a MoMo payment reference and trigger activation.
    """
    try:
        t_id = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")

    tx = db.query(Transaction).filter(Transaction.id == t_id, Transaction.status == "pending").first()
    if not tx:
        raise HTTPException(status_code=404, detail="Pending transaction not found")

    # Identify user from buyer_rid mapping "PENDING_ACT_{user_id}"
    if not tx.buyer_rid.startswith("PENDING_ACT_"):
        raise HTTPException(status_code=400, detail="Invalid transaction mapping for activation")
        
    user_id = tx.buyer_rid.replace("PENDING_ACT_", "")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User associated with this payment not found")

    code = db.query(Code).filter(Code.id == tx.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code associated with this payment not found")

    from app.services.activation_service import run_activation_engine
    activated_code = run_activation_engine(db, user, code, tx)

    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action=f"Approved manual payment: {transaction_id}", 
        details={"user_id": user_id, "code": activated_code.product_code}
    ))
    db.commit()

    return {
        "status": "success", 
        "message": "Payment approved. Account activated.",
        "new_rid": user.rid
    }

@router.post("/payments/{transaction_id}/reject")
def reject_payment(transaction_id: str, reason: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Reject a payment submission if the reference is invalid or fraudulent."""
    try:
        t_id = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")

    tx = db.query(Transaction).filter(Transaction.id == t_id, Transaction.status == "pending").first()
    if not tx:
        raise HTTPException(status_code=404, detail="Pending transaction not found")

    tx.status = "failed"
    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action=f"Rejected manual payment: {transaction_id}", 
        details={"reason": reason}
    ))
    db.commit()
    return {"status": "success", "message": "Payment submission rejected."}


# ═══════════════════════════════════════
#  ADMIN ACTIVITY LOGS
# ═══════════════════════════════════════
@router.get("/logs", response_model=list[AdminLogOut])
def get_admin_logs(current_user: Annotated[User, Depends(require_super_admin)], limit: int = 50, db: Session = Depends(get_db)):
    return db.query(AdminLog).order_by(desc(AdminLog.created_at)).limit(limit).all()


@router.get("/tables")
def list_db_tables(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """List all registered table names in the database."""
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    return [row[0] for row in result.all()]


@router.get("/tables/{table_name}")
def get_table_data(
    table_name: str, 
    current_user: Annotated[User, Depends(require_super_admin)], 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """Retrieve raw row data for database audits."""
    tables_res = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    valid_tables = [row[0] for row in tables_res.all()]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail="Invalid table name")
        
    result = db.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
    columns = result.keys()
    data = [dict(zip(columns, row)) for row in result.all()]
    return {
        "table": table_name,
        "columns": list(columns),
        "data": data
    }
