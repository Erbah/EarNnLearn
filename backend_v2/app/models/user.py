import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rid = Column(String, unique=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password_hash = Column(String)
    
    # Internal Referral Architecture
    parent_rid = Column(String, index=True)
    tier_type = Column(String, default="public") # creator, ngo, public
    role = Column(String, default="USER") # SUPER_ADMIN, EDUCATION_ADMIN, USER
    
    # Platform access rules
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    
    # MOMO / Bank Details for Peer-to-Peer payments (Pay-in)
    momo_provider = Column(String, nullable=True) # MTN, Vodafone, AirtelTigo
    momo_number = Column(String, nullable=True)
    momo_name = Column(String, nullable=True)
    
    # Global Payment Gateways (Pay-in)
    preferred_payment_method = Column(String, default="mobile_money") # mobile_money, paystack, paypal, stripe
    paystack_id = Column(String, nullable=True)
    paypal_email = Column(String, nullable=True)
    stripe_id = Column(String, nullable=True)

    # Earning Details (Pay-out)
    payout_method = Column(String, default="mobile_money")
    payout_number = Column(String, nullable=True)
    payout_provider = Column(String, nullable=True)
    payout_name = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")
    
    # Gamification Stats
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    current_streak = Column(Integer, default=0)
    hearts = Column(Integer, default=5)
    last_active_at = Column(DateTime, default=datetime.utcnow)

    # Elite Personalization & Onboarding (v12)
    learning_goal = Column(String, default="General Exploration")
    preferred_style = Column(String, default="Balanced")
    onboarding_completed = Column(Boolean, default=False)
    last_onboarding_step = Column(Integer, default=0)
    is_beta_user = Column(Boolean, default=False)

    # Relationships
    codes = relationship("Code", primaryjoin="User.rid == Code.owner_rid", foreign_keys="[Code.owner_rid]", overlaps="codes")
