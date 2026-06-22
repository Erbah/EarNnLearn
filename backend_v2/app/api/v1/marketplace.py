"""
CediTrees 2.0 — Marketplace API Router
========================================
Course publishing, enrollment, reviews, certificates, and creator analytics.
Supports the global learning marketplace where creators earn through the referral economy.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
import uuid, random, string

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.course import Course, Module, Video
from app.models.marketplace import (
    CourseCategory, CourseEnrollment, CourseReview, Certificate
)
from app.models.engagement import Quiz
from app.models.learning import CoursePayment
from app.models.transaction import ReferralIndex
from app.models.notification import Notification
from app.services.currency_engine import currency_engine
from app.services.ingestion_service import ingestion_service
from app.models.code import Code
from app.models.admin import SystemSetting

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
    creator_name: str | None = None

class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    skill_level: str | None = None
    price: float | None = None
    is_published: bool | None = None
    creator_name: str | None = None

class ModuleCreate(BaseModel):
    title: str
    position: int = 0

class VideoCreate(BaseModel):
    title: str
    youtube_id: str
    duration: int = 0
    position: int = 0
    is_preview: bool = False

class ReviewCreate(BaseModel):
    rating: int  # 1-5
    review_text: str = ""

class CourseOut(BaseModel):
    id: str
    title: str
    description: str | None
    creator_rid: str
    creator_name: str | None
    category: str
    skill_level: str
    price: float
    avg_rating: float
    enrollment_count: int
    is_published: bool
    approval_status: str
    thumbnail_url: str | None = None
    class Config:
        from_attributes = True


# ═══════════════════════════════════════
#  COURSE DISCOVERY (PUBLIC)
# ═══════════════════════════════════════
from app.models.code import Code

@router.get("/browse", response_model=list[CourseOut])
def browse_courses(
    category: str | None = None,
    skill_level: str | None = None,
    sort: str = "popular",  # popular, newest, rating
    skip: int = 0, limit: int = 20,
    db: Session = Depends(get_db)
):
    """Browse published courses in the marketplace."""
    q = db.query(Course).filter(Course.approval_status == "approved")

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

@router.get("/pool")
def get_marketplace_pool(limit: int = 5, db: Session = Depends(get_db)):
    """
    Returns a list of unactivated public product codes that users can buy
    if they don't have a direct sponsor.
    """
    codes = db.query(Code).filter(
        Code.used == False,
        Code.tier_type == "public",
        Code.product_code != None
    ).order_by(func.random()).limit(limit).all()
    
    return [
        {
            "code": c.product_code,
            "price": float(c.price),
            "owner": c.owner_rid,
            "tier": c.tier_type
        } for c in codes
    ]


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Get all course categories."""
    cats = db.query(CourseCategory).order_by(CourseCategory.position).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon} for c in cats]


@router.get("/rids")
def get_rid_pool(limit: int = 10, db: Session = Depends(get_db)):
    """
    Returns a list of unactivated RIDs (Direct Keys).
    """
    codes = db.query(Code).filter(
        Code.used == False,
        Code.generated_rid != None
    ).order_by(func.random()).limit(limit).all()
    
    return [
        {
            "code": c.generated_rid,
            "price": float(c.price),
            "owner": c.owner_rid,
            "tier": c.tier_type
        } for c in codes
    ]


@router.get("/product-codes")
def get_product_code_pool(limit: int = 10, db: Session = Depends(get_db)):
    """
    Returns a list of unactivated Product Codes (Referral links).
    """
    codes = db.query(Code).filter(
        Code.used == False,
        Code.product_code != None
    ).order_by(func.random()).limit(limit).all()
    
    return [
        {
            "code": c.product_code,
            "price": float(c.price),
            "owner": c.owner_rid,
            "tier": c.tier_type
        } for c in codes
    ]


@router.get("/check")
def check_code(code: str, db: Session = Depends(get_db)):
    """
    Verifies a code and returns its metadata, including the effective price
    which reflects the admin-configured activation_price floor from SystemSettings.
    """
    target = db.query(Code).filter(
        (Code.generated_rid == code) | (Code.product_code == code)
    ).first()

    if target:
        is_rid = target.generated_rid == code
        code_price = float(target.price)

        # Always enforce the activation_price from SystemSettings as the minimum/exact value for RIDs.
        # This ensures admin settings reflect immediately on the registration pricing UI.
        activation_price = SystemSetting.get_val(db, "activation_price", 20.0)
        try:
            activation_price = float(activation_price)
        except (TypeError, ValueError):
            activation_price = 20.0

        if is_rid:
            # RIDs represent system entry keys, their price is strictly determined by the admin setting.
            effective_price = activation_price
        else:
            # Resalable product codes are set by users, but must meet the minimum activation_price.
            effective_price = max(code_price, activation_price)

        return {
            "valid": not target.used,
            "type": "rid" if is_rid else "product_code",
            "price": effective_price,
            "currency": target.currency,
            "activation_price": activation_price,
        }
    
    return {"valid": False, "error": "Code not found"}


@router.get("/currencies")
def get_rates():
    """Returns supported currencies and live exchange rates from CurrencyEngine."""
    return {
        "currencies": currency_engine.get_supported_currencies(),
        "rates": currency_engine.RATES
    }


@router.get("/config")
def get_public_config(db: Session = Depends(get_db)):
    """Returns public configurations like splits and activation price."""
    seller = SystemSetting.get_val(db, "seller_percentage", 0.70)
    family = SystemSetting.get_val(db, "family_percentage", 0.25)
    master = SystemSetting.get_val(db, "master_percentage", 0.05)
    price = SystemSetting.get_val(db, "activation_price", 20.0)
    
    try:
        seller = float(seller)
    except:
        seller = 0.70
        
    try:
        family = float(family)
    except:
        family = 0.25
        
    try:
        master = float(master)
    except:
        master = 0.05
        
    try:
        price = float(price)
    except:
        price = 20.0

    return {
        "seller_percentage": seller,
        "family_percentage": family,
        "master_percentage": master,
        "activation_price": price
    }


@router.get("/convert")
def convert_currency(amount: float, from_curr: str = "GHS", to_curr: str = "GHS"):
    """Converts amount from one currency to another."""
    converted = currency_engine.convert(amount, from_curr, to_curr)
    return {
        "amount": amount,
        "from": from_curr,
        "to": to_curr,
        "converted_amount": converted
    }


@router.get("/{course_id}")
def get_course_detail(
    course_id: str, 
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional)
):
    """Get full course detail with modules, videos, and reviews."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    modules = db.query(Module).filter(Module.course_id == course_id).order_by(Module.position).all()
    reviews = db.query(CourseReview).filter(CourseReview.course_id == course_id).order_by(desc(CourseReview.created_at)).limit(10).all()

    # Check if the user has full access (is enrolled, is course creator, or is admin)
    has_full_access = False
    if current_user:
        if current_user.rid == course.creator_rid:
            has_full_access = True
        elif current_user.role in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
            has_full_access = True
        else:
            enrollment = db.query(CourseEnrollment).filter(
                CourseEnrollment.user_rid == current_user.rid,
                CourseEnrollment.course_id == course_id
            ).first()
            if enrollment:
                has_full_access = True

    module_ids = [m.id for m in modules]
    all_videos = db.query(Video).filter(Video.module_id.in_(module_ids)).order_by(Video.position).all() if module_ids else []
    all_quizzes = db.query(Quiz).filter(Quiz.module_id.in_(module_ids)).all() if module_ids else []
    
    videos_by_module = {}
    for v in all_videos:
        videos_by_module.setdefault(v.module_id, []).append(v)
        
    quizzes_by_module = {}
    for q in all_quizzes:
        quizzes_by_module.setdefault(q.module_id, []).append(q)

    module_data = []
    for m in modules:
        videos = videos_by_module.get(m.id, [])
        quizzes = quizzes_by_module.get(m.id, [])
        module_data.append({
            "id": m.id, "title": m.title, "position": m.position,
            "videos": [{"id": v.id, "title": v.title, "youtube_id": v.youtube_id if (v.is_preview or has_full_access) else None, "duration": v.duration, "is_preview": v.is_preview} for v in videos],
            "quizzes": [{"id": q.id, "title": q.title, "question_count": len(q.questions)} for q in quizzes]
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
def create_course(
    body: CourseCreate, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Create a new course (creator must have an RID)."""
    if not current_user.rid:
        raise HTTPException(status_code=403, detail="Activate your account first")

    course = Course(
        title=body.title, description=body.description,
        creator_rid=current_user.rid, category=body.category,
        creator_name=body.creator_name,
        skill_level=body.skill_level, price=body.price,
        playlist_url=body.playlist_url,
        approval_status="pending", is_published=False
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    # ── Trigger Ingestion ──
    if body.playlist_url:
        background_tasks.add_task(ingestion_service.process_playlist, course.id)

    # ── Notification ──
    try:
        new_note = Notification(
            title="New Course Submitted",
            message=f"Creator {current_user.name} submitted '{course.title}' for review. Link: {course.playlist_url}",
            link=f"/admin/content",
            type="PENDING_COURSE"
        )
        db.add(new_note)
        db.commit()
    except:
        pass

    return course


class YoutubeMetadataRequest(BaseModel):
    url: str

@router.post("/youtube-metadata")
def get_youtube_metadata(body: YoutubeMetadataRequest, current_user: User = Depends(get_current_user)):
    """Fetch metadata (title, description, author) for a YouTube video or playlist."""
    import yt_dlp
    ydl_opts = {
        'quiet': True,
        'extract_flat': 'in_playlist',
        'skip_download': True,
        'ignoreerrors': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(body.url, download=False)
            if not info:
                raise HTTPException(status_code=400, detail="Could not extract info from URL")
            
            categories = info.get('categories', [])
            yt_category = categories[0] if categories else ''
            
            return {
                "title": info.get('title', ''),
                "description": info.get('description', ''),
                "creator_name": info.get('uploader', '') or info.get('channel', ''),
                "category": yt_category
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


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
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
        
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if course.creator_rid != current_user.rid and current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this module's course")

    video = Video(
        module_id=module_id, 
        title=body.title, 
        youtube_id=body.youtube_id, 
        duration=body.duration, 
        position=body.position,
        is_preview=body.is_preview
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"id": video.id, "title": video.title, "youtube_id": video.youtube_id, "is_preview": video.is_preview}


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
        
        from app.services.notification_service import notification_service
        notification_service.send_in_app_notification(
            db=db, user_rid=current_user.rid, 
            title="Course Enrollment", 
            message=f"You have successfully enrolled in {course.title}.", 
            type="ENROLLMENT", link=f"/learn/{course.id}"
        )
        
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
