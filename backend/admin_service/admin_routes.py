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
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal

from common.database.db_session import get_db
from common.core.security import get_current_user, create_access_token, verify_password, get_password_hash
from common.models.user import User
from common.models.wallet import Wallet, WalletTransaction
from common.models.code import ActivationRID, ProductCode
from common.models.transaction import Transaction, ReferralIndex
from common.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season
from common.services.code_engine import generate_product_code

router = APIRouter()

# ─── Helper: Admin-Only Guard ───
def require_admin(user: User):
    if user.tier_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

class AdminLoginRequest(BaseModel):
    admin_password: str

class CredentialUpdateRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/login")
def login_admin(body: AdminLoginRequest, db: Session = Depends(get_db)):
    """Log in strictly as a Super Admin bypass without requiring a user account."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        if body.admin_password != "erbah1983":
            raise HTTPException(status_code=403, detail="Invalid admin credential")
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash("erbah1983"), description="Admin Dashboard Login"))
        db.commit()
    
    new_token = create_access_token(
        data={"sub": "superadmin", "tier_type": "admin"}
    )
    
    return {"status": "authenticated", "tier_type": "admin", "token": new_token}

@router.put("/credentials")
def update_admin_credentials(body: CredentialUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update the root admin master password."""
    require_admin(current_user)
    
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.current_password, setting.value):
            raise HTTPException(status_code=403, detail="Current password incorrect")
        setting.value = get_password_hash(body.new_password)
    else:
        if body.current_password != "erbah1983":
            raise HTTPException(status_code=403, detail="Current password incorrect")
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(body.new_password), description="Admin Dashboard Login"))
        
    db.commit()
    return {"status": "success", "detail": "Admin credentials updated"}


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

class CodeGenRequest(BaseModel):
    count: int = 10
    tier_type: str = "PUBLIC_POOL" # CREATORS, NGO, PUBLIC_POOL
    price: float = 20.0
    season_id: str | None = None
    owner_rid: str | None = None

class BulkCodeGenRequest(BaseModel):
    configs: list[CodeGenRequest]

class UserOut(BaseModel):
    id: str  # DB UUID
    name: str | None
    email: str
    tier_type: str
    status: str
    class Config:
        from_attributes = True

class AnalyticsOut(BaseModel):
    total_users: int
    activated_users: int
    total_revenue: float
    codes_used: int
    codes_available: int
    total_payouts: float
    top_promoters: list[dict] # { name, network_size }

class ProfitSuggestionOut(BaseModel):
    creators_tier: int
    ngo_tier: int
    public_pool_tier: int
    reasoning: str

class AdminLogOut(BaseModel):
    action: str
    details: dict | None
    created_at: datetime
    class Config:
        from_attributes = True


@router.get("/ai/strategy")
def get_ai_strategy(current_user: User = Depends(get_current_user)):
    """Mock endpoint returning an immediate operational recommendation for Admin ecosystem health."""
    require_admin(current_user)
    return {
        "health_score": 94,
        "global_recommendation": "Network is stable. High demand for NGOS. Recommend generating 50 NGO codes.",
        "suggested_config": {
            "tier_type": "ngo",
            "count": 50,
            "price": 10.0,
            "platform_share": 10.0,
            "seller_share": 60.0,
            "family_share": 30.0
        }
    }

# ═══════════════════════════════════════
#  DASHBOARD OVERVIEW / ANALYTICS
# ═══════════════════════════════════════
@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    
    total_users = db.query(func.count(User.id)).scalar() or 0
    activated_users = db.query(func.count(User.id)).filter(User.rid != None).scalar() or 0
    
    total_revenue = db.query(func.sum(Transaction.amount)).filter(Transaction.status == "success").scalar() or 0
    
    # Analytics for 10M Scale
    activations_count = db.query(func.count(ActivationRID.id)).filter(ActivationRID.status == "USED").scalar() or 0
    active_distributors = db.query(func.count(ProductCode.id)).filter(ProductCode.status == "ACTIVE").scalar() or 0
    
    total_payouts = db.query(func.sum(WalletTransaction.amount)).filter(
        WalletTransaction.type.like("CREDIT_PROFIT%")
    ).scalar() or 0

    # Top 5 promoters by network size
    top = db.query(
        ReferralIndex.user_rid,
        func.count(ReferralIndex.user_rid).label("network_size")
    ).group_by(ReferralIndex.parent_rid).order_by(desc("network_size")).limit(5).all()

    top_promoters = []
    for row in top:
        u = db.query(User).filter(User.rid == row[0]).first()
        top_promoters.append({"name": u.name if u else "User", "network_size": row[1]})

    return AnalyticsOut(
        total_users=total_users,
        activated_users=activated_users,
        total_revenue=float(total_revenue),
        codes_used=int(activations_count),
        codes_available=active_distributors,
        total_payouts=float(total_payouts),
        top_promoters=top_promoters
    )


# ═══════════════════════════════════════
#  SYSTEM SETTINGS
# ═══════════════════════════════════════
@router.get("/settings", response_model=list[SettingOut])
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(SystemSetting).filter(SystemSetting.key != "ADMIN_PASSWORD").all()

@router.put("/settings/{key}", response_model=SettingOut)
def update_setting(key: str, body: SettingUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
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
#  TIER MANAGEMENT
# ═══════════════════════════════════════
@router.get("/tiers", response_model=list[TierOut])
def get_tiers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(Tier).all()

@router.put("/tiers/{tier_name}", response_model=TierOut)
def update_tier(tier_name: str, body: TierUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
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


@router.get("/profit-shares/ai-suggestion", response_model=ProfitSuggestionOut)
def get_ai_profit_suggestion(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    AI Advisory: Suggests optimized profit distribution based on platform performance.
    """
    require_admin(current_user)
    
    # Logic: If enrollment is low, boost creator shares. If growth is slow, boost public pool.
    # For now: Return the user's requested "Best Economy" suggestion.
    return ProfitSuggestionOut(
        creators_tier=45,
        ngo_tier=15,
        public_pool_tier=40,
        reasoning="Maximizes creator incentives to drive high-quality content while maintaining platform sustainability and charitable NGO support."
    )
#  CODE GENERATION
# ═══════════════════════════════════════
@router.post("/codes/generate")
def generate_entry_rids(body: BulkCodeGenRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Generate One-Time Activation RIDs (Entry Tickets) in bulk across multiple tier configurations.
    """
    require_admin(current_user)
    
    rids_created = []
    
    import secrets
    import string

    def make_rid(parent_rid="A"):
        """
        CRITICAL: Hierarchical dot-notation format (Parent.Random4).
        DO NOT CHANGE this format without explicit user authorization.
        Example: A.KEZU
        """
        # Ensure parent_rid is clean (remove any old RID- prefixes if they exist)
        clean_parent = parent_rid.split("-")[-1] if "-" in parent_rid else parent_rid
        suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
        return f"{clean_parent}.{suffix}"

    for config in body.configs:
        owner = config.owner_rid or current_user.rid
        for _ in range(config.count):
            rid = ActivationRID(
                rid_code=make_rid(owner),
                owner_rid=owner,
                tier=config.tier_type.upper(),
                season_id=config.season_id,
                status="UNUSED"
            )
            db.add(rid)
            rids_created.append(rid.rid_code)
        
        db.add(AdminLog(
            admin_rid=current_user.rid,
            action=f"Generated {config.count} RIDs",
            details={"tier": config.tier_type, "price": config.price, "owner": owner, "season": config.season_id}
        ))
        
    db.commit()
    return {"generated": len(rids_created), "rids": rids_created}

@router.get("/codes")
def list_codes(search: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    query = db.query(ActivationRID)
    if search:
        query = query.filter(ActivationRID.rid_code.ilike(f"%{search}%"))
    codes = query.order_by(desc(ActivationRID.created_at)).limit(100).all()
    return [{"id": c.id, "rid_code": c.rid_code, "tier_type": c.tier, "is_used": c.status != "UNUSED", "price": getattr(c, "price", 0)} for c in codes]

@router.get("/codes/stats")
def get_codes_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    total = db.query(func.count(ActivationRID.id)).scalar() or 0
    used = db.query(func.count(ActivationRID.id)).filter(ActivationRID.status != "UNUSED").scalar() or 0
    return {"total": total, "unused": total - used, "used": used}

@router.get("/codes/sessions")
def get_codes_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    logs = db.query(AdminLog).filter(AdminLog.action.like("Generated %")).order_by(desc(AdminLog.created_at)).limit(20).all()
    return [{"id": str(l.id), "action": l.action, "created_at": l.created_at.isoformat() if l.created_at else None, "details": l.details} for l in logs]


# ═══════════════════════════════════════
#  USER MANAGEMENT
# ═══════════════════════════════════════
@router.get("/users", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(User).offset(skip).limit(limit).all()

@router.get("/users/{user_id}")
def get_user_detail(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    rid = user.rid
    wallet = db.query(Wallet).filter(Wallet.user_rid == rid).first() if rid else None
    txs = db.query(WalletTransaction).filter(WalletTransaction.user_rid == rid).order_by(desc(WalletTransaction.created_at)).limit(20).all() if rid else []
    
    # Active distributors/codes
    pcs = db.query(ProductCode).filter(ProductCode.owner_id == user.id).all()
    rids = db.query(ActivationRID).filter(ActivationRID.owner_rid == rid).all() if rid else []
    
    ref_idx = db.query(ReferralIndex).filter(ReferralIndex.user_rid == rid).first() if rid else None
    
    # Count direct children
    children_count = db.query(func.count(ReferralIndex.user_rid)).filter(ReferralIndex.parent_rid == rid).scalar() or 0 if rid else 0
    
    return {
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "tier_type": user.tier_type, "status": user.status},
        "wallet": {"balance": float(wallet.balance) if wallet else 0, "withdrawable": float(wallet.withdrawable_balance) if wallet else 0},
        "transactions": [{"type": t.type, "amount": float(t.amount), "description": t.description} for t in txs],
        "active_channels": len([c for c in codes if c.is_active]),
        "total_activations": int(sum([c.usage_count for c in codes])),
        "children_count": children_count,
        "depth": ref_idx.depth if ref_idx else 0
    }

@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "suspended"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Suspended user: {user.email}"))
    db.commit()
    return {"status": "User suspended"}

@router.post("/users/{user_id}/activate")
def reactivate_user(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Reactivated user: {user.email}"))
    db.commit()
    return {"status": "User reactivated"}

@router.post("/users/{user_id}/adjust-wallet")
def adjust_wallet(user_id: str, amount: float, reason: str = "Admin adjustment", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.rid:
        raise HTTPException(status_code=404, detail="Active user/wallet not found")
    
    wallet = db.query(Wallet).filter(Wallet.user_rid == user.rid).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    wallet.balance += Decimal(str(amount))
    wallet.withdrawable_balance += Decimal(str(amount))
    db.add(WalletTransaction(user_rid=user.rid, type="ADMIN_ADJUSTMENT", amount=Decimal(str(amount)), description=reason))
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Wallet adjustment: {user.email}", details={"amount": amount, "reason": reason}))
    db.commit()
    return {"status": "Wallet adjusted", "new_balance": float(wallet.balance)}


# ═══════════════════════════════════════
#  ADMIN ACTIVITY LOGS
# ═══════════════════════════════════════
@router.get("/logs", response_model=list[AdminLogOut])
def get_admin_logs(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(AdminLog).order_by(desc(AdminLog.created_at)).limit(limit).all()
