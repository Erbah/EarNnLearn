from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import get_current_user
from app.models import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["users"])

class OnboardingUpdate(BaseModel):
    step: Optional[int] = None
    learning_goal: Optional[str] = None
    preferred_style: Optional[str] = None
    onboarding_completed: Optional[bool] = None

@router.put("/onboarding")
def update_onboarding(
    payload: OnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.step is not None:
        current_user.last_onboarding_step = payload.step
    
    if payload.learning_goal:
        current_user.learning_goal = payload.learning_goal
        
    if payload.preferred_style:
        current_user.preferred_style = payload.preferred_style
        
    if payload.onboarding_completed is not None:
        current_user.onboarding_completed = payload.onboarding_completed

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
    # Simply acknowledge the event in the backend for now
    # We can implement OnboardingMetric if needed, but for now we unblock the UI
    return {"status": "tracked"}
