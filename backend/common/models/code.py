import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class ActivationRID(Base):
    """
    Admin-generated one-time entry codes.
    Once used, status becomes 'USED'.
    """
    __tablename__ = "activation_rids"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rid_code = Column(String, unique=True, index=True, nullable=False)
    tier = Column(String, default="PUBLIC_POOL") # CREATORS, NGO, PUBLIC_POOL
    season_id = Column(String, index=True)
    
    status = Column(String, default="UNUSED") # UNUSED, USED, EXPIRED
    
    # Tracking
    activated_by = Column(UUID(as_uuid=True), index=True, nullable=True) # User ID who used it
    activated_at = Column(DateTime, nullable=True)
    
    # Ownership
    owner_rid = Column(String, index=True, nullable=True) # Who distributed this RID
    
    created_at = Column(DateTime, default=datetime.utcnow)

class ProductCode(Base):
    """
    Permanent personal sales/referral codes.
    Associated with exactly one user for their lifetime.
    """
    __tablename__ = "product_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(UUID(as_uuid=True), index=True, nullable=False) # Refers to User.id
    
    total_sales = Column(Numeric(14, 0), default=0) # Cached for O(1) leaderboard
    status = Column(String, default="ACTIVE")
    
    created_at = Column(DateTime, default=datetime.utcnow)
