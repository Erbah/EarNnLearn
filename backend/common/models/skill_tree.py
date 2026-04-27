import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, JSON, Table, DateTime
from common.database.db_session import Base

# Association table for Skill Prerequisites (Self-referential many-to-many)
skill_prerequisites = Table(
    "skill_prerequisites",
    Base.metadata,
    Column("skill_id", String, ForeignKey("skill_nodes.id"), primary_key=True),
    Column("prerequisite_id", String, ForeignKey("skill_nodes.id"), primary_key=True)
)

class SkillNode(Base):
    """
    Represents a specific skill or topic in a visual Learning Skill Tree.
    Nodes are unlocked as prerequisites are met.
    """
    __tablename__ = "skill_nodes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Category: e.g., 'Python', 'Mathematics', 'Cloud'
    category = Column(String, index=True)
    
    # The actual AI Course or Topic this skill maps to
    course_id = Column(String, index=True, nullable=True)
    topic_id = Column(String, index=True, nullable=True)
    
    # Meta for frontend visualization (React Flow coordinates)
    ui_metadata = Column(JSON, nullable=True) 

class UserSkill(Base):
    """
    Tracks which skills a specific user has unlocked/mastered.
    """
    __tablename__ = "user_skills"

    user_rid = Column(String, primary_key=True)
    skill_id = Column(String, primary_key=True)
    
    is_mastered = Column(Boolean, default=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)

class CareerPath(Base):
    """
    A sequence of courses/nodes leading to a specific job role.
    """
    __tablename__ = "career_paths"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False) # e.g., "Fullstack Developer"
    user_rid = Column(String, index=True)
    
    # Ordered list of course IDs that make up this path
    course_sequence = Column(JSON) 
    progress_percentage = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
