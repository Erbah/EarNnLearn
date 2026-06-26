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
from pydantic import BaseModel, ConfigDict
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

from app.schemas.admin_schema import *

router = APIRouter()


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
        if body.code_percentage < 0 or body.code_percentage > 100: raise HTTPException(status_code=400, detail="Invalid percentage")
        tier.code_percentage = body.code_percentage
    if body.seller_share is not None:
        if body.seller_share < 0 or body.seller_share > 100: raise HTTPException(status_code=400, detail="Invalid percentage")
        tier.seller_share = body.seller_share
    if body.family_share is not None:
        if body.family_share < 0 or body.family_share > 100: raise HTTPException(status_code=400, detail="Invalid percentage")
        tier.family_share = body.family_share
    if body.master_share is not None:
        if body.master_share < 0 or body.master_share > 100: raise HTTPException(status_code=400, detail="Invalid percentage")
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
    total_value = db.query(func.sum(Code.price)).scalar() or 0
    
    return {
        "total": total,
        "used": used,
        "unused": unused,
        "total_value": float(total_value)
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

@router.delete("/codes/purge-unused")
def purge_all_unused_codes(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    deleted_count = db.query(Code).filter(Code.used == False).delete(synchronize_session=False)
    db.add(AdminLog(admin_rid=current_user.rid, action="Purged all unused RIDs", details={"deleted_count": deleted_count}))
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}

@router.delete("/codes/{code_id}")
def delete_individual_code(code_id: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    try:
        u_id = uuid.UUID(code_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid code ID format")
        
    code = db.query(Code).filter(Code.id == u_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    was_used = code.used
    
    # Nullify references to this code in transactions to avoid foreign key/integrity failures
    from app.models.transaction import Transaction
    db.query(Transaction).filter(Transaction.code_id == u_id).update({Transaction.code_id: None})
    
    db.delete(code)
    db.add(AdminLog(
        admin_rid=current_user.rid,
        action=f"Force-deleted {'used' if was_used else 'unused'} code: {code_id}",
    ))
    db.commit()
    return {"status": "success", "was_used": was_used}

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
    
    # Deactivate other seasons and set their end_date to mark the boundary
    db.query(Season).filter(Season.is_active == True).update({
        "is_active": False,
        "end_date": body.start_date
    })
    
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

    # Fetch next season if end_date is missing (to protect newer seasons from unbounded deletes)
    next_season = db.query(Season).filter(
        Season.start_date > season.start_date
    ).order_by(Season.start_date.asc()).first()

    # Filter codes created within this season's range
    query = db.query(Code).filter(
        Code.used == False,
        Code.generated_rid != None,
        Code.created_at >= season.start_date
    )
    if season.end_date:
        query = query.filter(Code.created_at <= season.end_date)
    elif next_season:
        query = query.filter(Code.created_at < next_season.start_date)
    
    count = query.delete(synchronize_session=False)
    
    db.add(AdminLog(
        admin_rid=current_user.rid, 
        action="DELETED SEASON RIDS", 
        details={"season_id": season_id, "deleted_count": count}
    ))
    db.commit()
    
    return {"status": "success", "deleted_count": count}


class TransactionOut(BaseModel):
    id: uuid.UUID
    code_id: uuid.UUID | None = None
    buyer_rid: str
    seller_rid: str
    amount: Decimal
    currency: str
    payment_method: str | None = None
    payment_reference: str | None = None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

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


