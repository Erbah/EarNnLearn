"""
CediTrees 2.0 — Admin Models
=============================
system_settings: Key-value store for platform-wide configuration
tiers: Code allocation percentages per tier group
admin_logs: Audit trail for all admin actions
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Tier(Base):
    __tablename__ = "tiers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)  # creator, ngo, public
    code_percentage = Column(Integer, default=0)         # % of generated codes allocated
    seller_share = Column(Numeric(5, 2), default=0.70)
    family_share = Column(Numeric(5, 2), default=0.25)
    master_share = Column(Numeric(5, 2), default=0.05)
    is_active = Column(Boolean, default=True)


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_rid = Column(String, nullable=False)
    action = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Advertisement(Base):
    __tablename__ = "advertisements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    subtitle = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Season(Base):
    """
    The platform runs in seasons with changing economics.
    """
    __tablename__ = "seasons"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    season_name = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    minimum_activation_price = Column(Numeric(12, 2), default=10.00)
    
    status = Column(String, default="ACTIVE") # ACTIVE, EXPIRED
    
    total_revenue = Column(Numeric(14, 2), default=0)
    total_users = Column(Integer, default=0)
