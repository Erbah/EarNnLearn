import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class Transaction(Base):
    """
    Every purchase must be recorded for auditing and viral tracking.
    """
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    buyer_id = Column(UUID(as_uuid=True), index=True, nullable=False) # User who bought
    seller_id = Column(UUID(as_uuid=True), index=True, nullable=True) # User who sold (Owner of PC)
    
    product_code = Column(String, index=True) # The specific PC used for this sale
    
    amount = Column(Numeric(12, 2))
    currency = Column(String, default="GHS")
    
    payment_method = Column(String) # mobile_money, card, etc.
    transaction_reference = Column(String, unique=True, index=True) # ID sent by the aggregator (e.g. Flutterwave)
    payment_reference = Column(String, index=True) # Manual entry (e.g. MoMo Transaction ID)
    
    status = Column(String, default="PENDING") # PENDING, CONFIRMED, FAILED, REFUNDED
    
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
