import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime
from common.database.db_session import Base

class SeasonActivation(Base):
    """
    Subscribes a permanent user identity to a specific learning season.
    This replaces the 'new account per season' model.
    """
    __tablename__ = "season_activations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_rid = Column(String, index=True, nullable=False) # Perm link to User.rid
    season_id = Column(String, index=True, nullable=False) # Perm link to Season.id
    
    # The Product Code used to unlock this specific season
    product_code = Column(String, nullable=False)
    
    activated_at = Column(DateTime, default=datetime.utcnow)
