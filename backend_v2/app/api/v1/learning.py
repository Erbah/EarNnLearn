"""
CediTrees 2.0 — Pay-As-You-Learn API Router
==============================================
Implements the earn-to-learn economic engine:
- PPC formula: course_price / (videos - y)
- Upfront or earn-to-learn payment methods
- Auto-deduction on video watch
- Debt threshold pausing
- Feasibility estimation
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from decimal import Decimal, ROUND_DOWN
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction
from app.models.course import Course, Module, Video
from app.models.marketplace import CourseEnrollment
from app.models.learning import CoursePayment, VideoProgress, SkillNode, generate_uuid, get_now
from app.models.marketplace import Certificate
from app.models.engagement import Quiz, QuizAttempt
from app.models.transaction import Transaction
from app.services.paystack_service import paystack_service
from app.models.admin import Season, Tier
from app.services.gamification_service import GamificationService

router = APIRouter()

# Platform share of PPC deductions
PLATFORM_CUT = Decimal("0.20")
CREATOR_CUT = Decimal("0.70")
NETWORK_CUT = Decimal("0.10")


# ═══════════════════════════════════════
#  SCHEMAS
# ═══════════════════════════════════════
class EnrollRequest(BaseModel):
    payment_method: str = "upfront"  # "upfront" | "earn_to_learn"

class WatchVideoRequest(BaseModel):
    video_id: str
    duration: int  # Total duration of the video in seconds
    watch_time: int  # Seconds actually watched by the user

# ═══════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════
def count_course_videos(db: Session, course_id: str) -> int:
    """Count total videos in a course across all modules."""
    module_ids = [m.id for m in db.query(Module).filter(Module.course_id == course_id).all()]
    if not module_ids:
        return 0
    return db.query(func.count(Video.id)).filter(Video.module_id.in_(module_ids)).scalar() or 0

def get_course_videos_ordered(db: Session, course_id: str) -> list[str]:
    """Get all video IDs in a course, ordered by module position then video position."""
    modules = db.query(Module).filter(Module.course_id == course_id).order_by(Module.position).all()
    video_ids = []
    for m in modules:
        videos = db.query(Video).filter(Video.module_id == m.id).order_by(Video.position).all()
        video_ids.extend([v.id for v in videos])
    return video_ids

def calculate_ppc(course_price: Decimal, total_videos: int, acceleration_factor: int) -> Decimal:
    """
    PPC = course_price / (videos - y)
    """
    effective_videos = total_videos - acceleration_factor
    if effective_videos <= 0:
        effective_videos = 1  # Safety: at least 1 payment event
    return (course_price / Decimal(str(effective_videos))).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

def get_active_season(db: Session) -> int:
    """Get the current active season number."""
    season = db.query(Season).filter(Season.is_active == True).order_by(Season.season_number.desc()).first()
    return season.season_number if season else 1

# ═══════════════════════════════════════
#  FEASIBILITY CHECK
# ═══════════════════════════════════════
@router.get("/feasibility/{course_id}")
def check_feasibility(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Estimate whether the user's earning rate can cover the course cost.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if float(course.price) == 0:
        return {"feasible": True, "course_type": "free", "message": "This course is free!"}

    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    balance = float(wallet.balance) if wallet else 0

    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    total_earned = db.query(func.sum(WalletTransaction.amount)).filter(
        WalletTransaction.user_rid == current_user.rid,
        WalletTransaction.type.like("CREDIT%"),
        WalletTransaction.created_at >= thirty_days_ago
    ).scalar() or 0

    daily_earning = float(total_earned) / 30.0
    course_price = float(course.price)
    min_balance = course_price * 0.10  # 10% minimum

    estimated_days = round((course_price - balance) / daily_earning, 1) if daily_earning > 0 else 999
    return {
        "feasible": estimated_days <= 90,
        "can_pay_upfront": balance >= course_price,
        "balance": balance,
        "course_price": course_price,
        "daily_earning": round(daily_earning, 2),
        "estimated_days": estimated_days,
        "meets_minimum": balance >= min_balance,
        "message": f"Estimated {estimated_days} days to complete payment from earnings."
    }

# ═══════════════════════════════════════
#  ENROLL (UPFRONT OR EARN-TO-LEARN)
# ═══════════════════════════════════════
@router.post("/enroll/{course_id}")
def enroll_paid_course(course_id: str, body: EnrollRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Enroll in a paid course.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(CoursePayment).filter(
        CoursePayment.user_rid == current_user.rid,
        CoursePayment.course_id == course_id
    ).first()
    if existing:
        return {"status": "Already enrolled", "payment_status": existing.status}

    price = Decimal(str(course.price))
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet found")

    current_season = get_active_season(db)

    # ── FREE COURSE ──
    if price <= 0:
        db.add(CoursePayment(
            id=generate_uuid(),
            user_rid=current_user.rid, course_id=course_id,
            total_price=0, amount_paid=0, remaining=0,
            payment_method="free", status="completed", ppc=0,
            start_season=current_season,
            created_at=get_now()
        ))
        db.add(CourseEnrollment(course_id=course_id, user_rid=current_user.rid))
        course.enrollment_count = (course.enrollment_count or 0) + 1
        db.commit()
        
        from app.services.notification_service import notification_service
        notification_service.send_in_app_notification(
            db=db, user_rid=current_user.rid, 
            title="Course Enrollment", 
            message=f"You have successfully enrolled in {course.title}.", 
            type="ENROLLMENT", link=f"/learn/{course.id}"
        )
        return {"status": "Enrolled (free)", "payment_method": "free"}

    total_videos = count_course_videos(db, course_id)
    ppc = calculate_ppc(price, total_videos, course.acceleration_factor or 5)

    # ── UPFRONT PAYMENT ──
    if body.payment_method == "upfront":
        if wallet.balance < price:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Need {price} GHS.")
        
        wallet.balance -= price
        wallet.withdrawable_balance -= min(wallet.withdrawable_balance, price)
        db.add(WalletTransaction(
            user_rid=current_user.rid, type="DEBIT_COURSE",
            amount=-price, description=f"Course: {course.title}"
        ))

        creator_wallet = db.query(Wallet).filter(Wallet.user_rid == course.creator_rid).first()
        if creator_wallet:
            creator_share = (price * CREATOR_CUT).quantize(Decimal("0.01"))
            creator_wallet.balance += creator_share
            creator_wallet.withdrawable_balance += creator_share
            db.add(WalletTransaction(
                user_rid=course.creator_rid, type="CREDIT_COURSE_SALE",
                amount=creator_share, description=f"Course sale: {course.title}"
            ))
            
            # Notify the creator
            from app.models.user import User
            from app.services.notification_service import notification_service
            creator = db.query(User).filter(User.rid == course.creator_rid).first()
            if creator:
                msg = f"Good news! You just earned {creator_share} GHS from an upfront purchase of '{course.title}'."
                notification_service.send_alert(creator, "New Course Sale!", msg)
                notification_service.send_in_app_notification(db, creator.rid, "New Earnings! 💰", msg, type="WALLET")

        db.add(CoursePayment(
            id=generate_uuid(),
            user_rid=current_user.rid, course_id=course_id,
            total_price=price, amount_paid=price, remaining=0,
            payment_method="upfront", status="completed", ppc=ppc,
            start_season=current_season,
            created_at=get_now()
        ))
        db.add(CourseEnrollment(course_id=course_id, user_rid=current_user.rid))
        course.enrollment_count = (course.enrollment_count or 0) + 1
        db.commit()
        
        from app.services.notification_service import notification_service
        notification_service.send_in_app_notification(
            db=db, user_rid=current_user.rid, 
            title="Course Enrollment", 
            message=f"You have successfully enrolled in {course.title}.", 
            type="ENROLLMENT", link=f"/learn/{course.id}"
        )
        return {"status": "Enrolled (paid upfront)", "amount": float(price)}

    # ── EARN-TO-LEARN ──
    min_balance = price * Decimal("0.10")
    if wallet.balance < min_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum 10% balance required ({float(min_balance)} GHS)."
        )

    db.add(CoursePayment(
        id=generate_uuid(),
        user_rid=current_user.rid, course_id=course_id,
        total_price=price, amount_paid=0, remaining=price,
        payment_method="earn_to_learn", status="active", ppc=ppc,
        start_season=current_season,
        created_at=get_now()
    ))
    db.add(CourseEnrollment(course_id=course_id, user_rid=current_user.rid))
    course.enrollment_count = (course.enrollment_count or 0) + 1
    db.commit()
    
    from app.services.notification_service import notification_service
    notification_service.send_in_app_notification(
        db=db, user_rid=current_user.rid, 
        title="Earn-to-Learn Enrolled", 
        message=f"You are now enrolled in {course.title} using Earn-to-Learn.", 
        type="ENROLLMENT", link=f"/learn/{course.id}"
    )
    
    return {
        "status": "Enrolled (earn-to-learn)",
        "ppc": float(ppc),
        "total_price": float(price),
        "videos": total_videos,
        "message": f"{float(ppc)} GHS deducted per video watched"
    }

@router.post("/checkout/{course_id}")
def initialize_course_checkout(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Initialize a direct course purchase via Paystack.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if Decimal(str(course.price)) <= 0:
        raise HTTPException(status_code=400, detail="This course is free. Use the enroll endpoint.")

    # Check if already enrolled
    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course.id,
        CourseEnrollment.user_rid == current_user.rid
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    metadata = {
        "user_id": str(current_user.id),
        "user_rid": current_user.rid,
        "course_id": str(course.id),
        "type": "COURSE_PURCHASE"
    }
    
    paystack_res = paystack_service.initialize_transaction(
        email=current_user.email,
        amount=course.price,
        metadata=metadata
    )

    if not paystack_res.get("status"):
        raise HTTPException(status_code=400, detail="Payment gateway failed to initialize")

    # Create pending transaction
    new_tx = Transaction(
        buyer_rid=current_user.rid,
        amount=course.price,
        currency="GHS",
        payment_method="PAYSTACK",
        payment_reference=paystack_res["data"]["reference"],
        status="pending"
    )
    db.add(new_tx)
    db.commit()

    return {
        "authorization_url": paystack_res["data"]["authorization_url"],
        "reference": paystack_res["data"]["reference"]
    }

# ═══════════════════════════════════════
#  WATCH VIDEO (AUTO-DEDUCTION & ANTI-CHEAT)
# ═══════════════════════════════════════
@router.post("/watch/{course_id}")
def watch_video(course_id: str, body: WatchVideoRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Record a video watch event. Enforces:
    - 90% watch time requirement
    - Sequential video unlocking
    - Auto-deduction from wallet (PPC) for earn-to-learn courses
    - Seasonal carry-over enforcement (2-season limit)
    """
    payment = db.query(CoursePayment).filter(
        CoursePayment.user_rid == current_user.rid,
        CoursePayment.course_id == course_id
    ).first()

    if not payment:
        raise HTTPException(status_code=400, detail="Not enrolled in this course")

    if payment.status == "paused":
        raise HTTPException(status_code=403, detail="Course paused: earn more or pay to continue")

    # 1. SEASONAL CARRY-OVER CHECK
    current_season = get_active_season(db)
    if current_season - (payment.start_season or 1) >= 2:
         payment.status = "expired"
         db.commit()
         raise HTTPException(status_code=403, detail="Course access expired after 2 seasons. Please re-enroll.")

    # 2. SEQUENTIAL UNLOCK VALIDATION
    all_video_ids = get_course_videos_ordered(db, course_id)
    try:
        current_index = all_video_ids.index(body.video_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Video not found in course")

    if current_index > 0:
        prev_video_id = all_video_ids[current_index - 1]
        prev_progress = db.query(VideoProgress).filter(
            VideoProgress.user_rid == current_user.rid,
            VideoProgress.video_id == prev_video_id,
            VideoProgress.watched == True
        ).first()
        if not prev_progress:
            raise HTTPException(status_code=403, detail="Sequential unlock violation: Previous video not completed")

    # 3. CHECK EXISTING PROGRESS
    progress = db.query(VideoProgress).filter(
        VideoProgress.user_rid == current_user.rid,
        VideoProgress.video_id == body.video_id
    ).first()

    if progress and progress.watched:
        return {"status": "Already completely watched", "deduction": 0}

    if not progress:
        progress = VideoProgress(
            user_rid=current_user.rid, course_id=course_id,
            video_id=body.video_id, watch_time=0, watched=False
        )
        db.add(progress)

    # 4. UPDATE WATCH TIME
    # We allow the client to report incremental watch time (or final).
    progress.watch_time = max(progress.watch_time or 0, body.watch_time)
    
    # 5. CHECK 90% COMPLETION THRESHOLD
    completion_threshold = body.duration * 0.90
    if progress.watch_time < completion_threshold:
        db.commit()
        return {
            "status": "watching", 
            "watch_time": progress.watch_time, 
            "required": completion_threshold,
            "message": "Progress saved. Keep watching to complete."
        }

    # Mark as completely watched!
    progress.watched = True
    deduction = Decimal("0")
    
    # Gamification: Reward learning
    GamificationService.award_xp(db, current_user, amount=50, difficulty="easy")
    GamificationService.update_streak(db, current_user)

    # 6. PPC DEDUCTION (earn-to-learn only & still has remaining)
    if payment.payment_method == "earn_to_learn" and payment.remaining > 0 and not progress.deduction_applied:
        ppc = Decimal(str(payment.ppc))
        wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()

        if wallet and wallet.balance >= ppc:
            wallet.balance -= ppc
            deduction = min(ppc, payment.remaining)
            payment.amount_paid += deduction
            payment.remaining -= deduction
            progress.deduction_applied = True
            progress.deduction_amount = deduction

            db.add(WalletTransaction(
                user_rid=current_user.rid, type="DEBIT_PPC",
                amount=-deduction, description=f"PPC: {course_id[:8]}"
            ))

            course = db.query(Course).filter(Course.id == course_id).first()
            if course:
                creator_wallet = db.query(Wallet).filter(Wallet.user_rid == course.creator_rid).first()
                if creator_wallet:
                    creator_share = (deduction * CREATOR_CUT).quantize(Decimal("0.01"))
                    creator_wallet.balance += creator_share
                    creator_wallet.withdrawable_balance += creator_share
                    db.add(WalletTransaction(
                        user_rid=course.creator_rid, type="CREDIT_PPC",
                        amount=creator_share, description="PPC from learner"
                    ))
                    
                    # Notify the creator
                    from app.models.user import User
                    from app.services.notification_service import notification_service
                    creator = db.query(User).filter(User.rid == course.creator_rid).first()
                    if creator:
                        msg = f"You earned {creator_share} GHS from a student learning '{course.title}' (Earn-To-Learn)."
                        notification_service.send_alert(creator, "New Learning Earnings!", msg)
                        notification_service.send_in_app_notification(db, creator.rid, "Learning Earnings 📈", msg, type="WALLET")

            if payment.remaining <= 0:
                payment.status = "completed"
        else:
            payment.unpaid_videos = (payment.unpaid_videos or 0) + 1
            if payment.unpaid_videos >= payment.debt_threshold:
                payment.status = "paused"

    db.commit()

    return {
        "status": "completed",
        "deduction": float(deduction),
        "remaining": float(payment.remaining),
        "payment_status": payment.status,
        "videos_watched": db.query(func.count(VideoProgress.id)).filter(
            VideoProgress.user_rid == current_user.rid,
            VideoProgress.course_id == course_id,
            VideoProgress.watched == True
        ).scalar()
    }


# ═══════════════════════════════════════
#  PAYMENT STATUS
# ═══════════════════════════════════════
@router.get("/status/{course_id}")
def payment_status(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current payment status for a course."""
    payment = db.query(CoursePayment).filter(
        CoursePayment.user_rid == current_user.rid,
        CoursePayment.course_id == course_id
    ).first()

    if not payment:
        return {"enrolled": False}

    current_season = get_active_season(db)
    if current_season - (payment.start_season or 1) >= 2:
        payment.status = "expired"
        db.commit()

    watched_videos = db.query(VideoProgress.video_id).filter(
        VideoProgress.user_rid == current_user.rid,
        VideoProgress.course_id == course_id,
        VideoProgress.watched == True
    ).all()
    watched_video_ids = [wv[0] for wv in watched_videos]

    return {
        "enrolled": True,
        "payment_method": payment.payment_method,
        "status": payment.status,
        "total_price": float(payment.total_price),
        "amount_paid": float(payment.amount_paid),
        "remaining": float(payment.remaining),
        "ppc": float(payment.ppc),
        "videos_watched": len(watched_video_ids),
        "watched_video_ids": watched_video_ids,
        "unpaid_videos": payment.unpaid_videos,
        "starts_at_season": payment.start_season,
        "current_season": current_season
    }


# ═══════════════════════════════════════
#  MY LEARNING
# ═══════════════════════════════════════
@router.get("/my-courses")
def my_learning(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all courses the user is enrolled in with payment status."""
    payments = db.query(CoursePayment).filter(CoursePayment.user_rid == current_user.rid).all()
    result = []
    current_season = get_active_season(db)
    for p in payments:
        # Auto-expire check
        if current_season - (p.start_season or 1) >= 2 and p.status != "expired":
            p.status = "expired"
        
        course = db.query(Course).filter(Course.id == p.course_id).first()
        videos_watched = db.query(func.count(VideoProgress.id)).filter(
            VideoProgress.user_rid == current_user.rid,
            VideoProgress.course_id == p.course_id,
            VideoProgress.watched == True
        ).scalar()
        total_videos = count_course_videos(db, p.course_id) if course else 0

        result.append({
            "course_id": p.course_id,
            "title": course.title if course else "Unknown",
            "payment_method": p.payment_method,
            "status": p.status,
            "progress": round(videos_watched / max(total_videos, 1) * 100, 1),
            "amount_paid": float(p.amount_paid),
            "remaining": float(p.remaining)
        })
    return result

# ═══════════════════════════════════════
#  GAMIFICATION HUD
# ═══════════════════════════════════════
@router.get("/hud")
def get_gamification_hud(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get current user's gamification statistics.
    """
    # Regenerate hearts passively
    GamificationService.regenerate_hearts(db, current_user)
    db.commit()
    
    # Calculate progress percent to next level
    next_level_xp = int(100 * (current_user.level ** 1.5))
    prev_level_xp = int(100 * ((current_user.level - 1) ** 1.5)) if current_user.level > 1 else 0
    
    range_xp = next_level_xp - prev_level_xp
    progress_xp = (current_user.total_xp or 0) - prev_level_xp
    
    progress_percent = (progress_xp / range_xp) if range_xp > 0 else 0
    
    return {
        "total_xp": current_user.total_xp or 0,
        "level": current_user.level or 1,
        "current_streak": current_user.current_streak or 0,
        "hearts": current_user.hearts if current_user.hearts is not None else 5,
        "xp_to_next_level": next_level_xp - (current_user.total_xp or 0),
        "progress_percent": round(progress_percent * 100, 1)
    }

@router.post("/heart-beat")
def heartbeat_sync(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Sync user's online state and heartbeat.
    Updates streaks and regenerates hearts.
    """
    streak = GamificationService.update_streak(db, current_user)
    GamificationService.regenerate_hearts(db, current_user)
    db.commit()
    return {"streak": streak, "status": "synced"}

# ═══════════════════════════════════════
#  CERTIFICATES
# ═══════════════════════════════════════
@router.post("/claim-certificate/{course_id}")
def claim_certificate(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Check if user has finished all videos and passed all quizzes.
    If yes, issue a certificate.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    existing_cert = db.query(Certificate).filter(
        Certificate.user_rid == current_user.rid,
        Certificate.course_id == course_id
    ).first()
    
    if existing_cert:
        return {"status": "Already claimed", "certificate_id": existing_cert.id}
        
    # 1. Check Video Completion
    total_videos = count_course_videos(db, course_id)
    videos_watched = db.query(func.count(VideoProgress.id)).filter(
        VideoProgress.user_rid == current_user.rid,
        VideoProgress.course_id == course_id,
        VideoProgress.watched == True
    ).scalar() or 0
    
    if total_videos > 0 and videos_watched < total_videos:
        raise HTTPException(
            status_code=400, 
            detail=f"Incomplete video progress: {videos_watched}/{total_videos} watched."
        )
        
    # 2. Check Quiz Completion & Grade
    course_quizzes = db.query(Quiz).filter(Quiz.course_id == course_id).all()
    total_grade = 0.0
    passed_quizzes = 0
    
    if course_quizzes:
        for q in course_quizzes:
            # Find their best passed attempt
            best_attempt = db.query(QuizAttempt).filter(
                QuizAttempt.user_rid == current_user.rid,
                QuizAttempt.quiz_id == q.id,
                QuizAttempt.passed == True
            ).order_by(QuizAttempt.score.desc()).first()
            
            if not best_attempt:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Incomplete quizzes: You have not passed the quiz '{q.title}'."
                )
            
            score_pct = (best_attempt.score / best_attempt.total_points * 100) if best_attempt.total_points > 0 else 0
            total_grade += score_pct
            passed_quizzes += 1
            
    final_grade = (total_grade / passed_quizzes) if passed_quizzes > 0 else 100.0
    
    # 3. Issue Certificate
    import uuid
    cert = Certificate(
        user_rid=current_user.rid,
        course_id=course_id,
        course_title=course.title,
        user_name=current_user.name or "User",
        certificate_code=str(uuid.uuid4())[:8].upper(),
        grade_percentage=round(final_grade, 2)
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    
    from app.services.notification_service import notification_service
    notification_service.send_in_app_notification(
        db=db, user_rid=current_user.rid, 
        title="Certificate Earned! 🎉", 
        message=f"Congratulations! You have completed {course.title} with a grade of {cert.grade_percentage}%.", 
        type="CERTIFICATE", link=f"/certificates/{cert.id}"
    )
    
    return {
        "status": "Success",
        "message": "Certificate claimed successfully!",
        "certificate_id": cert.id,
        "grade": cert.grade_percentage
    }
