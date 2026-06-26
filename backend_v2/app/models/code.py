import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Code(Base):
    """
    Combined Codes Table: Handles both GeneratedRID (system) and Product Codes (public resalable).
    """
    __tablename__ = "codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # If this row is a root system node, it has a generated_rid
    generated_rid = Column(String, unique=True, index=True, nullable=True)
    
    # Output of RID activation - resalable public invite codes
    product_code = Column(String, unique=True, index=True, nullable=True)
    
    owner_rid = Column(String, index=True)
    parent_rid = Column(String, index=True)
    session_id = Column(UUID(as_uuid=True), nullable=True)
    
    used = Column(Boolean, default=False, index=True)
    price = Column(Numeric(12, 2), default=20.00)
    currency = Column(String, default="GHS")
    tier_type = Column(String, default="public")
    
    # Custom profit sharing overrides (must sum to 100%)
    platform_share = Column(Numeric(5, 2), nullable=True)
    seller_share = Column(Numeric(5, 2), nullable=True)
    family_share = Column(Numeric(5, 2), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
