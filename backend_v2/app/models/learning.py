"""
CediTrees 2.0 — Pay-As-You-Learn Models
=========================================
CoursePayment: Tracks per-user course payment status (upfront or earn-to-learn).
VideoProgress: Tracks video watch events + PPC deductions applied.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, Boolean, Table, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())

def get_now():
    return datetime.utcnow()

class CoursePayment(Base):
    __tablename__ = "course_payments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=False, index=True)
    
    total_price = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0)
    remaining = Column(Numeric(12, 2), nullable=False)
    
    # "upfront" | "earn_to_learn"
    payment_method = Column(String, default="upfront")
    
    # "active" | "paused" (debt threshold) | "completed" | "cancelled"
    status = Column(String, default="active")
    
    # PPC = total_price / (videos - y)
    ppc = Column(Numeric(12, 2), default=0)
    
    # How many videos can be watched unpaid before pausing
    debt_threshold = Column(Integer, default=2)
    unpaid_videos = Column(Integer, default=0)
    
    start_season = Column(Integer, default=1)
    created_at = Column(DateTime, default=get_now)


class VideoProgress(Base):
    __tablename__ = "video_progress"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=False, index=True)
    video_id = Column(String, nullable=False)
    
    watch_time = Column(Integer, default=0)  # Seconds the user actually watched
    watched = Column(Boolean, default=False)
    deduction_applied = Column(Boolean, default=False)
    deduction_amount = Column(Numeric(12, 2), default=0)
    
    watched_at = Column(DateTime, default=get_now)


# ═══════════════════════════════════════
#  SKILL TREE (THE FOREST)
# ═══════════════════════════════════════

skill_prerequisites = Table(
    "skill_prerequisites",
    Base.metadata,
    Column("skill_id", String, ForeignKey("skill_nodes.id"), primary_key=True),
    Column("prerequisite_id", String, ForeignKey("skill_nodes.id"), primary_key=True)
)

class SkillNode(Base):
    """
    Represents a specific point on the visual Learning Forest.
    """
    __tablename__ = "skill_nodes"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    node_type = Column(String, default="COURSE") # COURSE, MILESTONE, SPECIAL
    course_id = Column(String, index=True, nullable=True)
    
    # UI Layout (ReactFlow coordinates)
    x_coord = Column(Float, default=0.0)
    y_coord = Column(Float, default=0.0)
    
    icon = Column(String, nullable=True) # Lucide icon name
    
    created_at = Column(DateTime, default=get_now)
    
    # Self-referential relationship for prerequisites
    prerequisites = relationship(
        "SkillNode",
        secondary=skill_prerequisites,
        primaryjoin="SkillNode.id == skill_prerequisites.c.skill_id",
        secondaryjoin="SkillNode.id == skill_prerequisites.c.prerequisite_id",
        backref="required_by"
    )
