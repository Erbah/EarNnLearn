from sqlalchemy.orm import Session
from common.models.education import AICourse, Certificate
from common.models.skill_tree import UserSkill, CareerPath

class DashboardService:
    """
    Aggregates learning metrics for the student dashboard.
    """

    def get_student_summary(self, db: Session, user_rid: str) -> dict:
        """
        Gathers stats on courses, certificates, and skills.
        """
        # 1. COURSES
        courses = db.query(AICourse).filter(AICourse.user_rid == user_rid).all()
        active_courses = [c for c in courses if not c.is_completed]
        completed_count = len(courses) - len(active_courses)

        # 2. CERTIFICATES
        certificates = db.query(Certificate).filter(Certificate.user_rid == user_rid).all()

        # 3. SKILLS
        mastered_skills = db.query(UserSkill).filter(
            UserSkill.user_rid == user_rid, 
            UserSkill.is_mastered == True
        ).count()

        # 4. CAREER PATHS
        paths = db.query(CareerPath).filter(CareerPath.user_rid == user_rid).all()

        return {
            "active_courses_count": len(active_courses),
            "completed_courses_count": completed_count,
            "certificates_count": len(certificates),
            "mastered_skills_count": mastered_skills,
            "active_career_paths_count": len(paths),
            "recent_certificates": [
                {"title": cert.course_title, "date": str(cert.issued_at)} for cert in certificates[:5]
            ]
        }

dashboard_service = DashboardService()
