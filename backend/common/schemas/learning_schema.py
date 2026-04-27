from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class LearningPrerequisiteResponse(BaseModel):
    required_node_id: UUID

    class Config:
        from_attributes = True

class LearningNodeResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    node_type: str
    course_id: Optional[str]
    x_coord: float
    y_coord: float
    icon: Optional[str]
    prerequisites: List[LearningPrerequisiteResponse] = []
    
    status: str = "LOCKED" # LOCKED, UNLOCKED, COMPLETED (Calculated)

    class Config:
        from_attributes = True

class UserHUDResponse(BaseModel):
    total_xp: int
    level: int
    current_streak: int
    hearts: int
    xp_to_next_level: int
    progress_percent: float
