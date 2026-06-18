from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, verify_password, get_password_hash
from app.models.user import User
from app.models.marketplace import Certificate
from app.models.course import Course
from app.models.analytics import OnboardingMetric
from app.schemas.user_schema import UserResponse, OnboardingUpdate, UserProfileUpdate
from sqlalchemy import func

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the current authenticated user profile."""
    return current_user




@router.get("/analytics/launch-metrics")
def get_launch_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Internal Soft Launch Dashboard API.
    Provides real-time KPI visibility.
    """
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin Access Required")
        
    total_users = db.query(func.count(User.id)).scalar()
    completed_onboarding = db.query(func.count(User.id)).filter(User.onboarding_completed == True).scalar()
    
    # Aggregated Metrics
    metrics = {
        "onboarding_completion_rate": (completed_onboarding / total_users * 100) if total_users > 0 else 0,
        "total_signups": total_users,
        "active_sessions": db.query(func.count(User.id)).filter(User.status == "active").scalar(),
        "avg_latency_ms": 0, # Should be pulled from AIPerformanceLog
    }
    
    return metrics

@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the current authenticated user's profile details.
    """
    if payload.name is not None:
        current_user.name = payload.name
    if payload.email is not None:
        # Check uniqueness manually if needed, but DB handles IntegrityError
        # A robust solution checks before setting, but for now we set it.
        # Ensure we don't set email to empty string, use None instead
        current_user.email = payload.email if payload.email != "" else None
    if payload.phone is not None:
        from app.utils.phone import normalize_phone
        current_user.phone = normalize_phone(payload.phone) if payload.phone != "" else None
    if payload.preferred_notification_method is not None:
        current_user.preferred_notification_method = payload.preferred_notification_method
    if payload.preferred_payment_method is not None:
        current_user.preferred_payment_method = payload.preferred_payment_method
    if payload.momo_provider is not None:
        current_user.momo_provider = payload.momo_provider
    if payload.momo_number is not None:
        current_user.momo_number = payload.momo_number
    if payload.momo_name is not None:
        current_user.momo_name = payload.momo_name
    if payload.payout_method is not None:
        current_user.payout_method = payload.payout_method
    if payload.payout_number is not None:
        current_user.payout_number = payload.payout_number
    if payload.payout_provider is not None:
        current_user.payout_provider = payload.payout_provider
    if payload.payout_name is not None:
        current_user.payout_name = payload.payout_name
    if payload.learning_goal is not None:
        current_user.learning_goal = payload.learning_goal
    if payload.preferred_style is not None:
        current_user.preferred_style = payload.preferred_style

    # Password update
    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password."
            )
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password."
            )
        current_user.password_hash = get_password_hash(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/{rid}/portfolio")
def get_public_portfolio(rid: str, db: Session = Depends(get_db)):
    """
    Public Portfolio / CV Endpoint.
    Does not require authentication.
    Returns Gamification stats and earned certificates for a user.
    Hides all sensitive financial and contact details.
    """
    user = db.query(User).filter(User.rid == rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    certificates = db.query(Certificate).filter(Certificate.user_rid == rid).order_by(Certificate.issued_at.desc()).all()
    
    cert_list = []
    for cert in certificates:
        course = db.query(Course).filter(Course.id == cert.course_id).first()
        cert_list.append({
            "certificate_id": cert.id,
            "course_title": course.title if course else "Unknown Course",
            "course_category": course.category if course else "General",
            "institution": course.institution if course and course.institution else (course.creator_name if course else "Independent"),
            "issued_at": cert.issued_at,
            "grade_percentage": cert.grade_percentage,
            "certificate_url": cert.certificate_url
        })
        
    return {
        "profile": {
            "name": user.name,
            "learning_goal": user.learning_goal,
            "level": user.level,
            "total_xp": user.total_xp,
            "member_since": user.created_at
        },
        "total_certificates": len(cert_list),
        "certificates": cert_list
    }

# ── NOTIFICATIONS ──

from app.models.notification import Notification

@router.get("/me/notifications")
def get_my_notifications(limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns the current user's notifications, as well as global announcements (user_rid is NULL).
    """
    from sqlalchemy import or_, desc
    notes = db.query(Notification).filter(
        or_(Notification.user_rid == current_user.rid, Notification.user_rid == None)
    ).order_by(desc(Notification.created_at)).limit(limit).all()
    
    return notes

@router.post("/me/notifications/{note_id}/read")
def mark_notification_read(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Marks a specific user notification as read.
    Cannot mark global announcements (user_rid = NULL) as read to avoid affecting all users.
    """
    note = db.query(Notification).filter(
        Notification.id == note_id,
        Notification.user_rid == current_user.rid
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found or access denied")
        
    note.is_read = True
    db.commit()
    return {"status": "success"}

@router.post("/me/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Marks all of the user's specific notifications as read.
    """
    db.query(Notification).filter(
        Notification.user_rid == current_user.rid,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}
