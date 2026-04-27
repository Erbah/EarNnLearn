from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Numeric, UniqueConstraint, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database.base import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_now():
    return datetime.utcnow()

# --- USER & WALLET ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    display_name = Column(String)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)
    preferred_currency = Column(String, default="GHS")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Payment (Pay-in)
    payment_method = Column(String, nullable=True) # momo, paypal, stripe, etc
    payment_provider = Column(String, nullable=True) # MTN, Vodafone, etc
    payment_identifier = Column(String, nullable=True) # phone or email

    # Payout (Earnings)
    payout_method = Column(String, nullable=True)
    payout_provider = Column(String, nullable=True)
    payout_identifier = Column(String, nullable=True)
    payout_name = Column(String, nullable=True)

    paystack_customer_id = Column(String, nullable=True)
    
    activations = relationship("Activation", back_populates="user", primaryjoin="User.id == Activation.user_id")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    network_node = relationship("NetworkTree", back_populates="user", uselist=False, primaryjoin="User.id == NetworkTree.user_id")

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    balance = Column(Numeric(12, 2), default=0.0)
    user = relationship("User", back_populates="wallet")

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id = Column(Integer, primary_key=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"))
    amount = Column(Numeric(12, 2))
    type = Column(String) # CREDIT, DEBIT
    source = Column(String) # EARNING, DEPOSIT, WITHDRAWAL
    reference = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# --- ECONOMY MODELS ---

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Numeric(12,2))
    payment_method = Column(String)
    payment_reference = Column(String, unique=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    activation = relationship("Activation", back_populates="transaction", uselist=False, primaryjoin="Transaction.id == Activation.transaction_id")

class GeneratedRid(Base):
    __tablename__ = "generated_rids"
    id = Column(Integer, primary_key=True)
    rid_code = Column(String, unique=True, index=True)
    generated_by = Column(Integer, ForeignKey("users.id"))
    tier_type = Column(String, default="public")
    price = Column(Numeric(12, 2), default=20.0)
    currency = Column(String, default="GHS")
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    activations = relationship("Activation", back_populates="rid", primaryjoin="GeneratedRid.id == Activation.rid_id")

class ProductCode(Base):
    __tablename__ = "product_codes"
    id = Column(Integer, primary_key=True)
    product_code = Column(String, unique=True, index=True)
    generated_by = Column(Integer, ForeignKey("users.id"))
    activated_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    activation = relationship("Activation", back_populates="product_code", uselist=False, primaryjoin="ProductCode.id == Activation.product_code_id")

class Activation(Base):
    __tablename__ = "activations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    rid_id = Column(Integer, ForeignKey("generated_rids.id"))
    product_code_id = Column(Integer, ForeignKey("product_codes.id"))
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    user_rid = Column(String, index=True) # Hierarchical RID (e.g. ACNIRP.1.2)
    profit_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="activations", foreign_keys=[user_id])
    rid = relationship("GeneratedRid", back_populates="activations", foreign_keys=[rid_id])
    product_code = relationship("ProductCode", back_populates="activation", foreign_keys=[product_code_id])
    transaction = relationship("Transaction", back_populates="activation", foreign_keys=[transaction_id])
    profits = relationship("ProfitDistribution", back_populates="activation")

class ProfitDistribution(Base):
    __tablename__ = "profit_distribution"
    id = Column(Integer, primary_key=True)
    activation_id = Column(Integer, ForeignKey("activations.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Numeric(12,2))
    level = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("activation_id", "receiver_id", name="uq_profit_activation_receiver"),
    )
    activation = relationship("Activation", back_populates="profits", foreign_keys=[activation_id], primaryjoin="Activation.id == ProfitDistribution.activation_id")

# --- NETWORK ---

class NetworkTree(Base):
    __tablename__ = "network_tree"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    depth = Column(Integer, default=0)
    path = Column(String) # Format "1.2.3.4"
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="network_node", foreign_keys=[user_id])

# --- WITHDRAWAL ---

class Withdrawal(Base):
    __tablename__ = "withdrawals"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Numeric(12, 2))
    status = Column(String, default="pending")
    method = Column(String)
    details = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# --- COURSES ---

class Course(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=generate_uuid)
    creator_rid = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, default="General")
    thumbnail_url = Column(String)
    price = Column(Numeric(12, 2), default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=get_now)
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")

class Module(Base):
    __tablename__ = "modules"
    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, default=0)
    course = relationship("Course", back_populates="modules")
    videos = relationship("Video", back_populates="module", cascade="all, delete-orphan")

class Video(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True, default=generate_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    title = Column(String, nullable=False)
    video_url = Column(String, nullable=False)
    duration = Column(Integer, default=0)
    order = Column(Integer, default=0)
    module = relationship("Module", back_populates="videos")

# --- LEARNING ---

class CoursePayment(Base):
    __tablename__ = "course_payments"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=False, index=True)
    total_price = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0)
    remaining = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String, default="upfront")
    status = Column(String, default="active")
    ppc = Column(Numeric(12, 2), default=0)
    debt_threshold = Column(Integer, default=2)
    unpaid_videos = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_now)

class VideoProgress(Base):
    __tablename__ = "video_progress"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=False, index=True)
    video_id = Column(String, nullable=False)
    watch_time = Column(Integer, default=0)
    watched = Column(Boolean, default=False)
    deduction_applied = Column(Boolean, default=False)
    deduction_amount = Column(Numeric(12, 2), default=0)
    watched_at = Column(DateTime, default=get_now)

# --- SYSTEM ---

class Season(Base):
    __tablename__ = "seasons"
    id = Column(Integer, primary_key=True)
    season_number = Column(Integer, unique=True)
    name = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=False)
    previous_season_id = Column(Integer, ForeignKey("seasons.id"), nullable=True)

class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    description = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True)
    action = Column(String)
    details = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
