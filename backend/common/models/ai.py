import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_rid = Column(String, index=True)
    
    feature_used = Column(String) # TUTOR, QUIZ_GEN, SUMMARIZE, ADMIN_INSIGHT
    tokens_used = Column(Integer, default=0)
    
    cost = Column(Numeric(12, 4), default=0.0000)
    
    prompt_metadata = Column(JSON, nullable=True) 

    created_at = Column(DateTime, default=datetime.utcnow)

class AITokenRate(Base):
    __tablename__ = "ai_token_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String, default="openai")
    model_name = Column(String, default="gpt-3.5-turbo")
    input_rate_per_1k = Column(Numeric(12, 6), default=0.001500)
    output_rate_per_1k = Column(Numeric(12, 6), default=0.002000)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
