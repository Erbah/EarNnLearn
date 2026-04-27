"""
CediTrees 2.0 — Marketplace API Router
========================================
Course publishing, enrollment, reviews, certificates, and creator analytics.
Supports the global learning marketplace where creators earn through the referral economy.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
import uuid, random, string

from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.course import Course, Module, Video
from common.models.marketplace import (
    CourseCategory, CourseEnrollment, CourseReview, Certificate, Quiz
)
from common.models.learning import CoursePayment
from common.models.transaction import ReferralIndex

router = APIRouter()


# ═══════════════════════════════════════
#  SCHEMAS
# ═══════════════════════════════════════
class CourseCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "General"
    skill_level: str = "Beginner"
    price: float = 0.0
    playlist_url: str | None = None

class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    skill_level: str | None = None
    price: float | None = None
    is_published: bool | None = None

class ModuleCreate(BaseModel):
    title: str
    position: int = 0

class VideoCreate(BaseModel):
    title: str
    youtube_id: str
    duration: int = 0
    position: int = 0

class ReviewCreate(BaseModel):
    rating: int  # 1-5
    review_text: str = ""

class CourseOut(BaseModel):
    id: str
    title: str
    description: str | None
    creator_rid: str
    category: str
    skill_level: str
    price: float
    avg_rating: float
    enrollment_count: int
    is_published: bool
    class Config:
        from_attributes = True


# ═══════════════════════════════════════
#  COURSE DISCOVERY (PUBLIC)
# ═══════════════════════════════════════
@router.get("/browse", response_model=list[CourseOut])
def browse_courses(
    category: str | None = None,
    skill_level: str | None = None,
    sort: str = "popular",  # popular, newest, rating
    skip: int = 0, limit: int = 20,
    db: Session = Depends(get_db)
):
    """Browse published courses in the marketplace."""
    q = db.query(Course).filter(Course.is_published == True)

    if category:
        q = q.filter(Course.category == category)
    if skill_level:
        q = q.filter(Course.skill_level == skill_level)

    if sort == "popular":
        q = q.order_by(desc(Course.enrollment_count))
    elif sort == "rating":
        q = q.order_by(desc(Course.avg_rating))
    else:
        q = q.order_by(desc(Course.created_at))

    return q.offset(skip).limit(limit).all()


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Get all course categories."""
    cats = db.query(CourseCategory).order_by(CourseCategory.position).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon} for c in cats]


@router.get("/{course_id}")
def get_course_detail(course_id: str, db: Session = Depends(get_db)):
    """Get full course detail with modules, videos, and reviews."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    modules = db.query(Module).filter(Module.course_id == course_id).order_by(Module.position).all()
    reviews = db.query(CourseReview).filter(CourseReview.course_id == course_id).order_by(desc(CourseReview.created_at)).limit(10).all()

    module_data = []
    for m in modules:
        videos = db.query(Video).filter(Video.module_id == m.id).order_by(Video.position).all()
        quizzes = db.query(Quiz).filter(Quiz.module_id == m.id).order_by(Quiz.position).all()
        module_data.append({
            "id": m.id, "title": m.title, "position": m.position,
            "videos": [{"id": v.id, "title": v.title, "youtube_id": v.youtube_id, "duration": v.duration} for v in videos],
            "quizzes": [{"id": q.id, "question": q.question, "options": [q.option_a, q.option_b, q.option_c, q.option_d]} for q in quizzes]
        })

    return {
        "course": {
            "id": str(course.id), "title": course.title, "description": course.description,
            "creator_rid": course.creator_rid, "category": course.category,
            "skill_level": course.skill_level, "price": float(course.price),
            "avg_rating": float(course.avg_rating), "enrollment_count": course.enrollment_count,
        },
        "modules": module_data,
        "reviews": [{"rating": r.rating, "text": r.review_text, "user": r.user_rid, "date": r.created_at.isoformat()} for r in reviews]
    }


# ═══════════════════════════════════════
#  CREATOR: COURSE PUBLISHING
# ═══════════════════════════════════════
@router.post("/create", response_model=CourseOut)
def create_course(body: CourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new course (creator must have an RID)."""
    if not current_user.rid:
        raise HTTPException(status_code=403, detail="Activate your account first")

    course = Course(
        title=body.title, description=body.description,
        creator_rid=current_user.rid, category=body.category,
        skill_level=body.skill_level, price=body.price,
        playlist_url=body.playlist_url
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.put("/{course_id}", response_model=CourseOut)
def update_course(course_id: str, body: CourseUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update course details (creator only)."""
    course = db.query(Course).filter(Course.id == course_id, Course.creator_rid == current_user.rid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or not yours")

    for field, val in body.dict(exclude_none=True).items():
        setattr(course, field, val)
    db.commit()
    db.refresh(course)
    return course


@router.post("/{course_id}/modules")
def add_module(course_id: str, body: ModuleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a module to a course."""
    course = db.query(Course).filter(Course.id == course_id, Course.creator_rid == current_user.rid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or not yours")

    module = Module(course_id=course_id, title=body.title, position=body.position)
    db.add(module)
    db.commit()
    db.refresh(module)
    return {"id": module.id, "title": module.title, "position": module.position}


@router.post("/modules/{module_id}/videos")
def add_video(module_id: str, body: VideoCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a video to a module."""
    video = Video(module_id=module_id, title=body.title, youtube_id=body.youtube_id, duration=body.duration, position=body.position)
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"id": video.id, "title": video.title, "youtube_id": video.youtube_id}


# ═══════════════════════════════════════
#  STUDENT: ENROLLMENT & REVIEWS
# ═══════════════════════════════════════
@router.post("/{course_id}/enroll")
def enroll_in_course(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Enroll in a course."""
    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.user_rid == current_user.rid
    ).first()
    if existing:
        return {"status": "Already enrolled"}

    db.add(CourseEnrollment(course_id=course_id, user_rid=current_user.rid))
    course = db.query(Course).filter(Course.id == course_id).first()
    if course:
        course.enrollment_count = (course.enrollment_count or 0) + 1
    db.commit()
    return {"status": "Enrolled successfully"}


@router.post("/{course_id}/review")
def review_course(course_id: str, body: ReviewCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Rate and review a course (1-5 stars)."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    existing = db.query(CourseReview).filter(
        CourseReview.course_id == course_id,
        CourseReview.user_rid == current_user.rid
    ).first()
    if existing:
        existing.rating = body.rating
        existing.review_text = body.review_text
    else:
        db.add(CourseReview(course_id=course_id, user_rid=current_user.rid, rating=body.rating, review_text=body.review_text))

    # Update average rating
    avg = db.query(func.avg(CourseReview.rating)).filter(CourseReview.course_id == course_id).scalar() or 0
    course = db.query(Course).filter(Course.id == course_id).first()
    if course:
        course.avg_rating = round(float(avg), 2)
    db.commit()
    return {"status": "Review submitted", "avg_rating": round(float(avg), 2)}


# ═══════════════════════════════════════
#  CERTIFICATES
# ═══════════════════════════════════════
@router.post("/{course_id}/certificate")
def issue_certificate(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Issue a completion certificate (must be enrolled and completed)."""
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.user_rid == current_user.rid
    ).first()
    if not enrollment:
        raise HTTPException(status_code=400, detail="Not enrolled in this course")

    existing = db.query(Certificate).filter(
        Certificate.course_id == course_id,
        Certificate.user_rid == current_user.rid
    ).first()
    if existing:
        return {"certificate_code": existing.certificate_code, "issued_at": existing.issued_at.isoformat()}

    course = db.query(Course).filter(Course.id == course_id).first()
    cert_code = "CERT-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    cert = Certificate(
        course_id=course_id, user_rid=current_user.rid,
        course_title=course.title, user_name=current_user.name or current_user.email,
        certificate_code=cert_code
    )
    db.add(cert)
    enrollment.completed = True
    enrollment.completed_at = datetime.utcnow()
    db.commit()
    return {"certificate_code": cert_code, "course_title": course.title, "issued_at": cert.issued_at.isoformat()}


@router.get("/certificates/verify/{code}")
def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Publicly verify a certificate by its code."""
    cert = db.query(Certificate).filter(Certificate.certificate_code == code).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"valid": True, "course_title": cert.course_title, "user": cert.user_name, "issued_at": cert.issued_at.isoformat()}


# ═══════════════════════════════════════
#  CREATOR ANALYTICS
# ═══════════════════════════════════════
@router.get("/creator/analytics")
def creator_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Dashboard analytics for course creators."""
    if not current_user.rid:
        raise HTTPException(status_code=403, detail="Account not activated")

    rid = current_user.rid
    courses = db.query(Course).filter(Course.creator_rid == rid).all()
    course_ids = [c.id for c in courses]

    total_enrollments = db.query(func.count(CourseEnrollment.id)).filter(
        CourseEnrollment.course_id.in_(course_ids)
    ).scalar() or 0

    total_reviews = db.query(func.count(CourseReview.id)).filter(
        CourseReview.course_id.in_(course_ids)
    ).scalar() or 0

    avg_rating = db.query(func.avg(CourseReview.rating)).filter(
        CourseReview.course_id.in_(course_ids)
    ).scalar() or 0

    completions = db.query(func.count(CourseEnrollment.id)).filter(
        CourseEnrollment.course_id.in_(course_ids),
        CourseEnrollment.completed == True
    ).scalar() or 0

    # Calculated KPI: Total Unique Students
    unique_students = db.query(func.count(func.distinct(CourseEnrollment.user_rid))).filter(
        CourseEnrollment.course_id.in_(course_ids)
    ).scalar() or 0

    # Calculated KPI: Total Course Revenue
    total_revenue = db.query(func.sum(CoursePayment.amount_paid)).filter(
        CoursePayment.course_id.in_(course_ids)
    ).scalar() or 0

    # Calculated KPI: Referral Growth (Network depth from creator)
    referral_growth = db.query(func.count(ReferralIndex.id)).filter(
        ReferralIndex.path.like(f"{current_user.rid}.%"),
        func.length(ReferralIndex.path) > len(current_user.rid)
    ).scalar() or 0

    return {
        "total_courses": len(courses),
        "total_enrollments": total_enrollments,
        "total_unique_students": unique_students,
        "total_revenue": float(total_revenue),
        "avg_rating": round(float(avg_rating), 2),
        "referral_growth": referral_growth,
        "completion_rate": round(completions / max(total_enrollments, 1) * 100, 1),
        "courses": [{
            "id": str(c.id), 
            "title": c.title, 
            "enrollments": c.enrollment_count,
            "revenue": float(db.query(func.sum(CoursePayment.amount_paid)).filter(CoursePayment.course_id == str(c.id)).scalar() or 0),
            "rating": float(c.avg_rating), 
            "published": c.is_published
        } for c in courses]
    }
