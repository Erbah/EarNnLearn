import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

from app.models.learning import generate_uuid, get_now

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, unique=True, index=True) # Direct mapping for fast graph traversal
    
    balance = Column(Numeric(12, 2), default=0.00)
    locked_balance = Column(Numeric(12, 2), default=0.00)
    withdrawable_balance = Column(Numeric(12, 2), default=0.00)
    
    currency = Column(String, default="GHS")
    updated_at = Column(DateTime, default=get_now, onupdate=get_now)


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, index=True)
    
    type = Column(String, index=True) # CREDIT_PROFIT, DEBIT_WITHDRAWAL, COURSE_PAYMENT, AI_USAGE
    amount = Column(Numeric(12, 2))
    description = Column(String)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    payout_method = Column(String) # Mobile Money, Paystack, Bank
    payout_details = Column(JSON, nullable=True) # JSON blob for flexibility
    
    admin_notes = Column(String, nullable=True)
    
    # Withdrawal Limit Permit (WLP) - Two Factor Auth
    wlp_code = Column(String, nullable=True)
    wlp_expires_at = Column(DateTime, nullable=True)
    
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
