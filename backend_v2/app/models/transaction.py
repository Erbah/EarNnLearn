import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code_id = Column(UUID(as_uuid=True), index=True) # References the Code table
    
    buyer_rid = Column(String, index=True)
    seller_rid = Column(String, index=True)
    
    amount = Column(Numeric(12, 2))
    currency = Column(String, default="GHS")
    payment_method = Column(String)
    payment_reference = Column(String, index=True)
    
    status = Column(String, default="pending") # pending, success, failed
    
    created_at = Column(DateTime, default=datetime.utcnow)


class ReferralIndex(Base):
    """
    Graph traversal optimization table for ultra-fast ancestor lookups
    """
    __tablename__ = "referral_index"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_rid = Column(String, index=True)
    parent_rid = Column(String, index=True)
    
    path = Column(String, index=True) # Represents structural ancestry e.g., A.AC.ACC
    depth = Column(Integer)
