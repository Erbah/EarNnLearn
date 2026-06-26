import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Quiz(Base):
    __tablename__ = "engagement_quizzes"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, index=True, nullable=False)
    module_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    passing_score = Column(Integer, default=70)  # Percentage
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

class QuizQuestion(Base):
    __tablename__ = "engagement_quiz_questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    quiz_id = Column(String, ForeignKey("engagement_quizzes.id"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String, default="multiple_choice")  # multiple_choice, true_false
    points = Column(Integer, default=1)
    position = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan")

class QuizOption(Base):
    __tablename__ = "engagement_quiz_options"

    id = Column(String, primary_key=True, default=generate_uuid)
    question_id = Column(String, ForeignKey("engagement_quiz_questions.id"), nullable=False, index=True)
    option_text = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)

    question = relationship("QuizQuestion", back_populates="options")

class QuizAttempt(Base):
    __tablename__ = "engagement_quiz_attempts"

    id = Column(String, primary_key=True, default=generate_uuid)
    quiz_id = Column(String, ForeignKey("engagement_quizzes.id"), nullable=False, index=True)
    user_rid = Column(String, index=True, nullable=False)
    score = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    attempted_at = Column(DateTime, default=datetime.utcnow)

    quiz = relationship("Quiz", back_populates="attempts")

class Discussion(Base):
    __tablename__ = "engagement_discussions"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, index=True, nullable=False)
    video_id = Column(String, index=True, nullable=True)
    user_rid = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    replies = relationship("DiscussionReply", back_populates="discussion", cascade="all, delete-orphan")

class DiscussionReply(Base):
    __tablename__ = "engagement_discussion_replies"

    id = Column(String, primary_key=True, default=generate_uuid)
    discussion_id = Column(String, ForeignKey("engagement_discussions.id"), nullable=False, index=True)
    user_rid = Column(String, index=True, nullable=False)
    content = Column(Text, nullable=False)
    is_instructor_reply = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    discussion = relationship("Discussion", back_populates="replies")
