import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class PaymentProfile(Base):
    """
    Stores user payment details for receiving earnings from Product Code sales.
    """
    __tablename__ = "payment_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    
    payment_method = Column(String, nullable=False) # mobile_money, bank_transfer, paypal, etc.
    provider = Column(String, nullable=False) # MTN, Vodafone, AirtelTigo, GC_Bank, etc.
    
    account_number = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    
    status = Column(String, default="ACTIVE") # ACTIVE, INACTIVE
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
