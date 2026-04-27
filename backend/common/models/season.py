from sqlalchemy import Column, String, Integer, DateTime, Boolean
from common.database.db_session import Base
from datetime import datetime

class Season(Base):
    """
    EarNnLearn Seasonal Platform System.
    Users must activate a code each season to maintain full platform benefits.
    """
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False) # e.g., Season 1, Season 2
    
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    
    is_active = Column(Boolean, default=True)
    previous_season_id = Column(Integer, nullable=True) # Linked list of seasons

    created_at = Column(DateTime, default=datetime.utcnow)
