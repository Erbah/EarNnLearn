from sqlalchemy.orm import Session
from app.models.course import Course, Module, Video
from app.models.progress import CourseProgress
from app.models.wallet import Wallet, WalletTransaction
from decimal import Decimal

class CourseEngine:

    @staticmethod
    def calculate_ppc(db: Session, course_id: str) -> Decimal:
        """
        Pay Per Class (PPC) formula:
        PPC = course_price / (videos_count - acceleration_factor_y)
        """
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course or course.price == Decimal('0.00'):
            return Decimal('0.00')

        # Count total videos in course (via module joins conceptually, simplified here)
        # Note: Proper join across `modules` to `videos` happens here in production
        video_count = db.query(Video).filter(
            Video.module_id.in_([m.id for m in db.query(Module).filter(Module.course_id == course_id).all()]),
            Video.is_preview == False
        ).count()

        if video_count <= course.acceleration_factor:
            return course.price # Fallback if params misconfigured
            
        return course.price / Decimal(str(video_count - course.acceleration_factor))

    @staticmethod
    def apply_deduction(db: Session, user_rid: str, course_id: str, video_id: str):
        """
        Pay-As-You-Learn atomic wallet deduction whenever a video hits the 90% threshold.
        """
        video = db.query(Video).filter(Video.id == video_id).first()
        if video and video.is_preview:
            return True # Explicitly free preview video

        ppc_cost = CourseEngine.calculate_ppc(db, course_id)
        if ppc_cost == Decimal('0.00'):
            return True # Free video / free course
            
        wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).with_for_update().first()
        
        if not wallet or wallet.balance < ppc_cost:
            return False # Insufficient funds to unlock/complete this lesson

        # Atomically deduct the partial payment
        wallet.balance -= ppc_cost
        wallet.withdrawable_balance -= ppc_cost
        
        tx = WalletTransaction(
            user_rid=user_rid,
            type="COURSE_PAYMENT",
            amount=-ppc_cost,
            description="Pay-as-you-learn deduction for video completion."
        )
        db.add(tx)
        
        progress = db.query(CourseProgress).filter(
            CourseProgress.user_rid == user_rid, 
            CourseProgress.video_id == video_id
        ).with_for_update().first()
        
        if progress:
            progress.deduction_applied = True
            progress.video_completed = True
            
        db.commit()
        return True

course_engine = CourseEngine()
