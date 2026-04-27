import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class CourseProgress(Base):
    __tablename__ = "course_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_rid = Column(String, index=True)
    course_id = Column(UUID(as_uuid=True), index=True)
    video_id = Column(UUID(as_uuid=True), index=True)
    
    watched_percentage = Column(Integer, default=0)
    video_completed = Column(Boolean, default=False)
    
    # Has the user's wallet been deducted for this specific video in the Pay-as-you-learn system?
    deduction_applied = Column(Boolean, default=False)
    
    # For Cross-Season Carryover evaluation
    season_started = Column(Integer, default=1)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
