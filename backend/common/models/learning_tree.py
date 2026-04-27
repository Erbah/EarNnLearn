import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from common.database.db_session import Base
from sqlalchemy.orm import relationship

class LearningNode(Base):
    """
    Represents a specific point on the visual Skill Tree.
    Can be a Course, a Lesson, or a Milestones.
    """
    __tablename__ = "learning_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    node_type = Column(String, default="COURSE") # COURSE, MILESTONE, SPECIAL
    course_id = Column(String, ForeignKey("courses.id"), index=True, nullable=True)
    
    # UI Layout (ReactFlow coordinates)
    x_coord = Column(Float, default=0.0)
    y_coord = Column(Float, default=0.0)
    
    icon = Column(String, nullable=True) # Lucide icon name or URL
    
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    prerequisites = relationship("LearningPrerequisite", backref="node", foreign_keys="[LearningPrerequisite.node_id]")

class LearningPrerequisite(Base):
    """
    Determines the directed edges of the skill tree.
    Node B requires Node A to be unlocked/completed.
    """
    __tablename__ = "learning_prerequisites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id = Column(UUID(as_uuid=True), ForeignKey("learning_nodes.id"), index=True)
    required_node_id = Column(UUID(as_uuid=True), ForeignKey("learning_nodes.id"), index=True)
