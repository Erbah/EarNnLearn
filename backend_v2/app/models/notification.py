import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime
from app.core.database import Base

class Notification(Base):
    """
    Notifications for Admins (Approvals, etc.)
    """
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True) # Link to the relevant admin page/course
    
    # "PENDING_COURSE" | "SYSTEM" | "ALERT"
    type = Column(String, default="SYSTEM")
    
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
