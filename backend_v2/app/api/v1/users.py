from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, verify_password, get_password_hash
from app.models.user import User
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
