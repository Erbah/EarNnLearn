from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.analytics import OnboardingMetric
from app.schemas.user_schema import UserResponse, OnboardingUpdate
from sqlalchemy import func

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the current authenticated user profile."""
    return current_user

@router.put("/onboarding", response_model=UserResponse)
def update_onboarding(
    payload: OnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the user's onboarding progress and personalization preferences.
    Added guards (v16) for database backward compatibility.
    """
    if payload.step is not None:
        current_user.last_onboarding_step = payload.step
    
    if payload.learning_goal:
        current_user.learning_goal = payload.learning_goal
        
    if payload.preferred_style:
        current_user.preferred_style = payload.preferred_style
        
    if payload.onboarding_completed is not None:
        current_user.onboarding_completed = payload.onboarding_completed

    # Set hardened defaults if missing (DB Sync safety)
    if not getattr(current_user, "learning_goal", None):
        current_user.learning_goal = "General Exploration"
    if not getattr(current_user, "preferred_style", None):
        current_user.preferred_style = "Balanced"

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/analytics/onboarding-event")
def track_onboarding_event(
    event: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tracks onboarding analytics (drop-off, time per step).
    Refined (v14): Persists to onboarding_metrics for KPI calculation.
    """
    metric = OnboardingMetric(
        user_rid=current_user.rid,
        step_reached=event.get("step", 0),
        action_taken=event.get("action", "unknown"),
        time_spent_ms=event.get("time_spent", 0),
        onboarding_completed=(event.get("step") == 5),
        session_metadata=event.get("metadata", {})
    )
    db.add(metric)
    db.commit()
    return {"status": "tracked"}

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
