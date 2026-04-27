import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class AIPerformanceLog(Base):
    """
    Performance Monitoring for AI Operations.
    Refined (v14) with Categorized Latency and Operation Context.
    """
    __tablename__ = "ai_performance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_rid = Column(String, index=True)
    
    # Context
    operation_type = Column(String) # ROADMAP, LESSON_CHAPTER, CHAT, QUIZ_VALIDATION
    subject = Column(String, index=True)
    topic = Column(String, index=True, nullable=True)
    difficulty = Column(String, nullable=True)
    section_type = Column(String, nullable=True) # intro, example, quiz, core_concept
    
    # Metrics
    latency_ms = Column(Integer)
    latency_category = Column(String) # Normal (<5s), Warning (5-8s), Critical (8-12s), Failure Risk (>12s)
    
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    
    # Success Tracking
    success = Column(Boolean, default=True)
    failure_reason = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    
    model_name = Column(String)
    provider = Column(String)
    
    # Operational Metadata for drill-down
    operation_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
