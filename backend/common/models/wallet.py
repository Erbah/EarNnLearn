import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from common.database.db_session import Base

from common.models.learning import generate_uuid, get_now

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
