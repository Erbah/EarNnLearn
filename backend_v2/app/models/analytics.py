import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class OnboardingMetric(Base):
    """
    Onboarding Conversion & KPI tracking (v14).
    Target: Completion Rate, Time to First Lesson, First Correct Answer Rate.
    """
    __tablename__ = "onboarding_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_rid = Column(String, index=True)
    
    # KPI Markers
    step_reached = Column(Integer, default=0)
    action_taken = Column(String) # view, click, complete
    time_spent_ms = Column(Integer, default=0) # Total duration in onboarding
    
    # Knowledge Markers
    first_correct_answer_rate = Column(Numeric(5, 2), nullable=True) # % of first lesson quiz questions correct
    time_to_first_lesson_ms = Column(Integer, nullable=True) # Duration from start to first lesson scene
    
    # Context
    device_type = Column(String, default="desktop") # mobile, tablet, desktop
    onboarding_completed = Column(Boolean, default=False)
    
    session_metadata = Column(JSON, nullable=True) # { "last_step": 3, "drop_off_reason": "timeout" }
    
    created_at = Column(DateTime, default=datetime.utcnow)
