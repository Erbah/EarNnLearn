"""
CediTrees 2.0 — Marketplace Models
====================================
Reviews, certificates, categories, and course enrollment
for the global learning marketplace.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, Boolean, ForeignKey
from app.core.database import Base


class CourseCategory(Base):
    __tablename__ = "course_categories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    icon = Column(String, nullable=True)  # emoji or icon name
    position = Column(Integer, default=0)


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String, nullable=False, index=True)
    user_rid = Column(String, nullable=False, index=True)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    completed = Column(Boolean, default=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    progress_percent = Column(Integer, default=0)


class CourseReview(Base):
    __tablename__ = "course_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String, nullable=False, index=True)
    user_rid = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String, nullable=False, index=True)
    user_rid = Column(String, nullable=False, index=True)
    course_title = Column(String, nullable=False)
    user_name = Column(String, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    certificate_code = Column(String, unique=True)  # Verifiable code
    grade_percentage = Column(Numeric(5, 2), default=0.0)
    certificate_url = Column(String, nullable=True)


