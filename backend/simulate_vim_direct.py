from common.database.db_session import SessionLocal, engine, Base
from common.models.user import User
from common.models.code import Code
from common.models.wallet import Wallet
from common.models.course import Course
from common.models.learning import CoursePayment
from common.models.marketplace import CourseEnrollment
from common.models.viral import ViralMomentum, CourseScholarship
from common.models.transaction import ReferralIndex
from common.core.security import get_password_hash
from common.services.code_engine import generate_rid, generate_product_code
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from decimal import Decimal
import uuid

def simulate_vim():
    print("--- STARTING SINGLE-PROCESS VIM SIMULATION ---")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Root Setup
        root_rid = "ACNIRP"
        root = User(email="admin@ceditrees.com", password_hash="hash", name="Root", rid=root_rid, is_active=True)
        db.add(root)
        db.add(Wallet(user_rid=root_rid, balance=10000))
        db.add(ReferralIndex(user_rid=root_rid, path=root_rid, depth=0))
        seed_code = Code(product_code="WELCOME2026", owner_rid=root_rid, parent_rid=root_rid, price=100, tier_type="public")
        db.add(seed_code)
        db.commit()
        print("Root seeded.")

        # 2. User A Activation
        user_a = User(email="a@example.com", name="User A", password_hash="hash")
        db.add(user_a)
        db.commit()
        
        # ACTIVATE A
        seller_rid = seed_code.owner_rid
        new_rid = "ACNIRP.001"
        user_a.rid = new_rid
        user_a.parent_rid = seller_rid
        seed_code.used = True
        db.add(ReferralIndex(user_rid=new_rid, parent_rid=seller_rid, path=f"{root_rid}.{new_rid}", depth=1))
        db.add(Wallet(user_rid=new_rid))
        db.add(ViralMomentum(user_rid=new_rid, activated_at=datetime.utcnow()))
        
        a_codes = []
        for _ in range(5):
            c = Code(product_code=f"CODE-{uuid.uuid4().hex[:4]}", owner_rid=new_rid, parent_rid=seller_rid)
            db.add(c)
            a_codes.append(c)
        db.commit()
        print(f"User A activated with RID {new_rid}")

        # 3. Momentum Bonus (3 refs)
        for i in range(3):
            ref = User(email=f"ref_{i}@ex.com", name=f"Ref {i}", password_hash="hash")
            db.add(ref)
            db.commit()
            
            # Activate ref
            seller_rid = new_rid
            ref_rid = f"{new_rid}.{i}"
            ref.rid = ref_rid
            ref.parent_rid = seller_rid
            a_codes[i].used = True
            db.add(ViralMomentum(user_rid=ref_rid, activated_at=datetime.utcnow()))
            
            # Momentum logic
            mom = db.query(ViralMomentum).filter(ViralMomentum.user_rid == seller_rid).first()
            mom.referral_count_72h += 1
            if mom.referral_count_72h >= 3 and not mom.bonus_awarded:
                mom.bonus_awarded = True
                print("Momentum Bonus Milestone reached!")
                for _ in range(3):
                    db.add(Code(product_code=f"BONUS-{uuid.uuid4().hex[:4]}", owner_rid=seller_rid, is_bonus=True))
        db.commit()

        # 4. Course Scholarship (5 ref enrollments)
        course = Course(title="Viral Tech", creator_rid=new_rid, price=100)
        db.add(course)
        db.commit()
        
        # User A Enroll
        db.add(CoursePayment(user_rid=new_rid, course_id=course.id, total_price=100, remaining=100, payment_method="earn_to_learn"))
        db.commit()
        print(f"User A enrolled in course {course.id}")

        # Scholars (5 needed)
        for i in range(5):
            schol = User(email=f"schol_{i}@ex.com", name=f"Schol {i}", parent_rid=new_rid, rid=f"SCHOL.{i}")
            db.add(schol)
            # Enroll scholarship
            db.add(CoursePayment(user_rid=schol.rid, course_id=course.id, total_price=100, remaining=100, payment_method="earn_to_learn"))
            
            # Scholarship Trigger logic
            parent_rid = schol.parent_rid
            shol = db.query(CourseScholarship).filter(CourseScholarship.user_rid == parent_rid, CourseScholarship.course_id == course.id).first()
            if not shol:
                shol = CourseScholarship(user_rid=parent_rid, course_id=course.id, referral_enrollment_count=0)
                db.add(shol)
            
            shol.referral_enrollment_count += 1
            print(f"Scholar {i} enrolled. Parent count: {shol.referral_enrollment_count}")
            
            if shol.referral_enrollment_count >= 5:
                shol.scholarship_active = True
                print("AWARDING SCHOLARSHIP!")
                # Update parent payment
                parent_pay = db.query(CoursePayment).filter(CoursePayment.user_rid == parent_rid, CoursePayment.course_id == course.id).first()
                if parent_pay:
                    print(f"  FOUND PARENT PAYMENT: ID={parent_pay.id}, Old Status={parent_pay.status}")
                    parent_pay.status = "completed"
                    parent_pay.payment_method = "scholarship"
                    db.flush()
                    print(f"  UPDATED PARENT PAYMENT: New Status={parent_pay.status}")
                else:
                    print(f"  ERROR: PARENT PAYMENT NOT FOUND for rid={parent_rid} and course={course.id}")
        db.commit()

        # Final Verification
        db.expire_all() # Ensure we fetch fresh from DB
        final_pay = db.query(CoursePayment).filter(CoursePayment.user_rid == new_rid).first()
        print(f"User A Payment Final Status: {final_pay.status}, Method: {final_pay.payment_method}")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    simulate_vim()
