import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Boolean, Integer, JSON, Index
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_rid = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, default="GHS")
    stock = Column(Integer, default=1)
    image_urls = Column(JSON, nullable=True) # Stored as a list of image paths
    product_type = Column(String, default="PHYSICAL") # PHYSICAL or DIGITAL
    category = Column(String, nullable=False, default="other", server_default="other")
    status = Column(String, default="PENDING_AI_REVIEW") # PENDING_AI_REVIEW, APPROVED, REJECTED, ADMIN_APPROVED, ADMIN_REJECTED
    review_feedback = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_product_status_stock", "status", "stock"),
        Index("idx_product_status_created", "status", "created_at"),
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    buyer_rid = Column(String, nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    total_price = Column(Numeric(12, 2), nullable=False)
    shipping_address = Column(String, nullable=True) # Text address for delivery
    
    # PENDING_PAYMENT, ESCROWED, SHIPPED, DELIVERED, DISPUTED, RELEASED, REFUNDED, CANCELLED
    shipping_status = Column(String, default="PENDING_PAYMENT")
    tracking_code = Column(String, nullable=True)
    buyer_confirmed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_order_status_created", "shipping_status", "created_at"),
    )


class Escrow(Base):
    __tablename__ = "escrows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    seller_rid = Column(String, nullable=False, index=True)
    buyer_rid = Column(String, nullable=False, index=True)
    
    # HELD, RELEASED, REFUNDED, FROZEN
    status = Column(String, default="HELD")
    release_at = Column(DateTime, nullable=True) # Target time for digital auto-release
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShopSetting(Base):
    __tablename__ = "shop_settings"

    id = Column(String, primary_key=True, default="AI_REVIEW_CONFIG")
    ai_rules_prompt = Column(
        String, 
        nullable=False, 
        default="Verify the product is appropriate, family-friendly, and does not contain weapons, drugs, illegal items, or brand impersonation without certificate proof."
    )
    platform_commission = Column(Numeric(5, 4), default=0.0500) # Default 5% platform fee
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
