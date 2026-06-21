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

from app.schemas.admin_schema import *

router = APIRouter()


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

    community_wallet = db.query(Wallet).filter(Wallet.user_rid == "COMMUNITY_POT").first()
    community_pot_balance = float(community_wallet.balance) if community_wallet else 0.0

    return AnalyticsOut(
        total_users=total_users,
        activated_users=activated_users,
        total_revenue=float(total_revenue),
        codes_used=codes_used,
        codes_available=codes_available,
        total_payouts=float(total_payouts),
        top_promoters=top_promoters,
        community_pot_balance=community_pot_balance
    )

@router.get("/finance/notification-expenses")
def get_notification_expenses(
    current_user: Annotated[User, Depends(require_super_admin)],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    season_number: int | None = None,
    db: Session = Depends(get_db)
):
    """AI Finance Dashboard: Get tabulated notification costs."""
    from app.models.admin import PlatformExpense
    
    query = db.query(PlatformExpense).filter(
        PlatformExpense.expense_type.in_(["SMS_WHATSAPP_NOTIFICATION", "EMAIL_NOTIFICATION"])
    )
    
    if start_date:
        query = query.filter(PlatformExpense.created_at >= start_date)
    if end_date:
        query = query.filter(PlatformExpense.created_at <= end_date)
    if season_number is not None:
        query = query.filter(PlatformExpense.season_number == season_number)
        
    expenses = query.order_by(desc(PlatformExpense.created_at)).all()
    
    sms_cost = sum(float(e.amount) for e in expenses if e.expense_type == "SMS_WHATSAPP_NOTIFICATION")
    email_cost = sum(float(e.amount) for e in expenses if e.expense_type == "EMAIL_NOTIFICATION")
    
    latest_20 = [{
        "id": e.id,
        "type": e.expense_type,
        "amount": float(e.amount),
        "currency": e.currency,
        "season_number": e.season_number,
        "description": e.description,
        "created_at": e.created_at.isoformat() if e.created_at else None
    } for e in expenses[:20]]
    
    return {
        "total_sms_whatsapp_cost": sms_cost,
        "total_email_cost": email_cost,
        "total_notification_cost": sms_cost + email_cost,
        "season_number_filtered": season_number,
        "record_count": len(expenses),
        "latest_records": latest_20
    }



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


