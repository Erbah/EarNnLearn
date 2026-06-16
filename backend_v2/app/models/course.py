import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    creator_rid = Column(String, index=True, nullable=False)
    creator_name = Column(String, nullable=True)
    institution = Column(String, nullable=True)  # MIT, Harvard, or company name
    
    # Marketplace fields
    category = Column(String, default="General", index=True)
    skill_level = Column(String, default="Beginner")  # Beginner, Intermediate, Advanced
    is_published = Column(Boolean, default=False)
    # approval_status: pending, approved, rejected
    approval_status = Column(String, default="pending")
    approval_remarks = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    
    playlist_url = Column(String, nullable=True)
    price = Column(Numeric(12, 2), default=0.00)
    currency = Column(String, default="GHS")
    acceleration_factor = Column(Integer, default=5) 
    
    # Aggregated stats (updated by triggers/endpoints)
    avg_rating = Column(Numeric(3, 2), default=0.00)
    enrollment_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String, index=True)
    title = Column(String)
    position = Column(Integer)

class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id = Column(String, index=True)
    title = Column(String)
    youtube_id = Column(String)
    duration = Column(Integer)
    position = Column(Integer)
    is_preview = Column(Boolean, default=False)
