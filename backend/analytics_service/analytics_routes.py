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
from common.core.security import get_current_user
from common.models.user import User
from common.models.wallet import Wallet, WalletTransaction
from common.models.code import Code
from common.models.transaction import Transaction, ReferralIndex
from common.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season
from common.services.code_engine import generate_product_code

router = APIRouter()

# ─── Helper: Admin-Only Guard ───
def require_admin(user: User):
    if user.tier_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


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
    tier_type: str = "public"
    price: float = 20.0
    owner_rid: str | None = None  # Defaults to master

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


# ═══════════════════════════════════════
#  DASHBOARD OVERVIEW / ANALYTICS
# ═══════════════════════════════════════
@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    
    total_users = db.query(func.count(User.id)).scalar() or 0
    activated_users = db.query(func.count(User.id)).filter(User.rid != None).scalar() or 0
    
    total_revenue = db.query(func.sum(Transaction.amount)).filter(Transaction.status == "success").scalar() or 0
    
    codes_used = db.query(func.count(Code.id)).filter(Code.used == True).scalar() or 0
    codes_available = db.query(func.count(Code.id)).filter(Code.used == False, Code.product_code != None).scalar() or 0
    
    total_payouts = db.query(func.sum(WalletTransaction.amount)).filter(
        WalletTransaction.type.like("CREDIT_PROFIT%")
    ).scalar() or 0

    # Top 5 promoters by network size
    top = db.query(
        ReferralIndex.user_rid,
        func.count(ReferralIndex.user_rid).label("network_size")
    ).group_by(ReferralIndex.parent_rid).having(
        ReferralIndex.parent_rid != None
    ).order_by(desc("network_size")).limit(5).all()

    top_promoters = []
    for row in top:
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
def get_all_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(SystemSetting).all()

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


# ═══════════════════════════════════════
#  CODE GENERATION
# ═══════════════════════════════════════
@router.post("/codes/generate")
def generate_codes(body: CodeGenRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    
    owner = body.owner_rid or current_user.rid
    codes_created = []
    
    for _ in range(body.count):
        code = Code(
            product_code=generate_product_code(),
            owner_rid=owner,
            price=body.price,
            tier_type=body.tier_type
        )
        db.add(code)
        codes_created.append(code.product_code)
    
    db.add(AdminLog(
        admin_rid=current_user.rid,
        action=f"Generated {body.count} codes",
        details={"tier": body.tier_type, "price": body.price, "owner": owner}
    ))
    db.commit()
    return {"generated": len(codes_created), "codes": codes_created}


# ═══════════════════════════════════════
#  USER MANAGEMENT
# ═══════════════════════════════════════
@router.get("/users", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(User).offset(skip).limit(limit).all()

@router.get("/users/{rid}")
def get_user_detail(rid: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
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
def suspend_user(rid: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "suspended"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Suspended user: {rid}"))
    db.commit()
    return {"status": "User suspended"}

@router.post("/users/{rid}/activate")
def reactivate_user(rid: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Reactivated user: {rid}"))
    db.commit()
    return {"status": "User reactivated"}

@router.post("/users/{rid}/adjust-wallet")
def adjust_wallet(rid: str, amount: float, reason: str = "Admin adjustment", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
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
#  ADMIN ACTIVITY LOGS
# ═══════════════════════════════════════
@router.get("/logs", response_model=list[AdminLogOut])
def get_admin_logs(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return db.query(AdminLog).order_by(desc(AdminLog.created_at)).limit(limit).all()
