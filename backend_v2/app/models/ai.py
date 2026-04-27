import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, JSON, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class AIUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_rid = Column(String, index=True)
    
    feature_used = Column(String) # TUTOR, QUIZ_GEN, SUMMARIZE, ADMIN_INSIGHT
    tokens_used = Column(Integer, default=0)
    
    # Pre-calculated cost dynamically billed to the Wallet
    cost = Column(Numeric(12, 4), default=0.0000)
    
    # Store history for potential replay/analytics (Warning: can get large)
    prompt_metadata = Column(JSON, nullable=True) 

    created_at = Column(DateTime, default=datetime.utcnow)


class AILesson(Base):
    """AI-Generated Interactive Lessons"""
    __tablename__ = "ai_lessons"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    creator_rid = Column(String, index=True, nullable=True)  # User who generated it, optional for admin-generated
    
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    difficulty = Column(String, default="beginner")  # beginner, intermediate, advanced
    style = Column(String, default="interactive")  # socratic, problem-based, lecture, interactive
    objectives = Column(JSON, default=[])  # Array of learning objectives
    
    # Lesson content structure
    scenes = Column(JSON, default=[])  # Array of scene objects
    
    target_duration_minutes = Column(Integer, default=30)
    
    # Progress tracking
    total_scenes = Column(Integer, default=0)
    completed_scenes = Column(Integer, default=0)
    
    # Meta
    status = Column(String, default="published")  # draft, published, archived
    is_partially_generated = Column(Boolean, default=False)  # For fail-safe incremental generation
    last_successful_scene_index = Column(Integer, default=0) # For failure recovery logic
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LessonProgress(Base):
    """User progress within a lesson"""
    __tablename__ = "lesson_progress"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, index=True, nullable=False)
    lesson_id = Column(String, index=True, nullable=False)
    
    current_scene = Column(Integer, default=0)
    completed_scenes = Column(Integer, default=0)
    total_scenes = Column(Integer, default=0)
    
    completed = Column(Boolean, default=False)
    completion_verified = Column(Boolean, default=False)  # Set only if score >= 60%
    exercise_score = Column(Numeric(5, 2), default=0.00)  # Average correctness %
    
    completion_date = Column(DateTime, nullable=True)
    
    # Adaptive Learning Context
    performance_metrics = Column(JSON, default={})  # { "scene_0": { "time": 120, "mistakes": 2 } }
    attempt_history = Column(JSON, default={}) # { "question_id": ["timestamp1", "timestamp2"] }
    penalty_multiplier = Column(Numeric(5, 2), default=1.0) # Reduces score after repeated retries
    confidence_score = Column(Numeric(5, 2), default=0.0) # Speed + Accuracy metric
    weak_areas = Column(JSON, default=[])  # ["calculus", "derivatives"]
    
    started_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LessonChat(Base):
    """Chat history for lesson AI tutor"""
    __tablename__ = "lesson_chat"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, index=True, nullable=False)
    lesson_id = Column(String, index=True, nullable=False)
    
    role = Column(String)  # user, teacher, tutor, peer
    message = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class SubjectRoadmap(Base):
    """
    Persisted Subject Curriculums.
    Used to track units, topics, and user progress for deep lessons.
    """
    __tablename__ = "subject_roadmaps"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, index=True, nullable=False)
    
    subject = Column(String, index=True, nullable=False)
    
    # Store Units -> Topics -> Subtopics
    # Structure: { "units": [{ "title": "Unit 1", "topics": [{ "id": "t1", "title": "Topic 1", "difficulty": "beginner" }] }] }
    roadmap_data = Column(JSON, nullable=False) 
    
    # Progress tracking across the subject
    # Structure: { "topic_id": { "status": "completed", "score": 85, "verified": true } }
    progress = Column(JSON, default={}) 
    dependency_graph = Column(JSON, default={}) # { "topic_id": ["prereq_id1", "prereq_id2"] }
    
    # Configuration
    guided_mode = Column(Boolean, default=True)  # Enforce sequential learning
    difficulty_level = Column(String, default="beginner")
    learning_goal = Column(String, nullable=True)  # exam, career, interest
    teacher_id = Column(String, nullable=True) # Prepare for Teacher/Admin mode
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
