import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rid = Column(String, unique=True, index=True)
    name = Column(String)
    display_name = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, index=True)
    password_hash = Column(String)
    
    # Viral Scaling Architecture
    product_code = Column(String, unique=True, index=True) # The user's OWN multi-use sales code
    referred_by = Column(String, index=True) # The product_code that brought this user in
    
    # Legacy/Internal RID (Internal Tree Tracking)
    rid = Column(String, unique=True, index=True)
    parent_rid = Column(String, index=True)
    tier_type = Column(String, default="PUBLIC_POOL") # CREATORS, NGO, PUBLIC_POOL
    
    # Platform access rules
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    
    # Gamification & Behavioral Stats
    total_xp = Column(Integer, default=0, index=True)
    level = Column(Integer, default=1)
    current_streak = Column(Integer, default=0)
    last_active_at = Column(DateTime, default=datetime.utcnow)
    hearts = Column(Integer, default=5) # 0-5 scale
    
    # Internal Tracking
    status = Column(String, default="inactive") # inactive, active, suspended
    
    created_at = Column(DateTime, default=datetime.utcnow)
