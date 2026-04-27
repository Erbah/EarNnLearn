from common.database.db_session import SessionLocal, engine
from sqlalchemy import text
from common.models.user import User
from common.models.code import Code
from common.models.wallet import Wallet

def inspect():
    print("--- CoursePayment Schema Inspection ---")
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA table_info(course_payments);"))
        for row in res:
            print(f"  Col: {row[1]}, Type: {row[2]}, NotNull: {row[3]}, PK: {row[5]}")
    
    db = SessionLocal()
    users = db.query(User).filter(User.email.like("%schol%")).all()
    print(f"Scholars found: {len(users)}")
    for u in users:
        print(f" - {u.email}: RID='{u.rid}', PARENT='{u.parent_rid}'")
    
    print("\n--- Deep User Inspection ---")
    all_users = db.query(User).all()
    for u in all_users:
        print(f"User: {u.email} | RID: '{u.rid}' | Parent: '{u.parent_rid}'")
        
    print("\n--- Deep Payment Inspection ---")
    # Note: CoursePayment is imported later, but we need it here for deep inspection.
    # Moving the import up or ensuring it's available. For now, assuming it's available.
    from common.models.learning import CoursePayment
    payments = db.query(CoursePayment).all()
    for p in payments:
        print(f"Payment: UserRID: '{p.user_rid}' | CourseID: '{p.course_id}' | Method: {p.payment_method} | Status: {p.status}")

    print("\n--- Deep Scholarship Inspection ---")
    # Note: CourseScholarship is imported later, but we need it here for deep inspection.
    # Moving the import up or ensuring it's available. For now, assuming it's available.
    from common.models.viral import CourseScholarship
    scholars = db.query(CourseScholarship).all()
    for s in scholars:
        print(f"Scholarship: ParentRID: '{s.user_rid}' | Count: {s.referral_enrollment_count} | Active: {s.scholarship_active}")

    codes = db.query(Code).all()
    print(f"Codes: {len(codes)}")
    for c in codes:
        print(f" - {c.product_code}: OWNER='{c.owner_rid}', USED={c.used}")
    
    from common.models.course import Course
    courses = db.query(Course).all()
    print(f"Courses: {len(courses)}")
    for c in courses:
        print(f" - '{c.title}': ENROLLMENTS={c.enrollment_count}")

    from common.models.marketplace import CourseEnrollment
    enrolls = db.query(CourseEnrollment).all()
    print(f"CourseEnrollments total: {len(enrolls)}")

    from common.models.learning import CoursePayment
    payments = db.query(CoursePayment).all()
    print(f"CoursePayments: {len(payments)}")
    for p in payments:
        print(f" - {p.user_rid}: COURSE={p.course_id}, METHOD={p.payment_method}, STATUS={p.status}")

    from common.models.viral import CourseScholarship
    shols = db.query(CourseScholarship).all()
    print(f"Scholarships: {len(shols)}")
    for s in shols:
        print(f" - {s.user_rid}: COURSE={s.course_id}, COUNT={s.referral_enrollment_count}, ACTIVE={s.scholarship_active}")
    
    db.close()

if __name__ == "__main__":
    inspect()
