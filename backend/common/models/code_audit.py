import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base

class CodeActivationLog(Base):
    """
    Audit log for all product code activation attempts.
    Used for fraud detection and brute-force protection.
    """
    __tablename__ = "code_activation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    product_code = Column(String, index=True)
    user_id = Column(String, index=True, nullable=True) # ID of user who attempted it
    
    status = Column(String) # success, invalid_checksum, not_found, already_used, expired
    
    ip_address = Column(String)
    user_agent = Column(String, nullable=True)
    
    details = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
