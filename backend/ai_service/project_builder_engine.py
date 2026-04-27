from sqlalchemy.orm import Session
from common.models.education import AICourse, AICompanionSession
import uuid

class ProjectBuilderEngine:
    """
    AI assistant that suggested and reviews real-world projects.
    """

    def suggest_project(self, db: Session, course_id: str) -> dict:
        """
        AI generates a project idea based on the course roadmap.
        """
        course = db.query(AICourse).filter(AICourse.id == course_id).first()
        if not course:
            return {"error": "Course not found"}

        # Simulated AI logic
        if "python" in course.title.lower():
            title = "Personal Finance Tracker"
            desc = "Build a CLI app that tracks income and expenses using Python loops and lists."
        elif "web" in course.title.lower() or "javascript" in course.title.lower():
            title = "Task Management Dashboard"
            desc = "Build a React-based todo list with local storage persistence."
        else:
            title = f"{course.title} Capstone Project"
            desc = f"Build a comprehensive application applying all concepts from {course.title}."

        return {
            "project_title": title,
            "project_description": desc,
            "project_id": str(uuid.uuid4())
        }

    def review_project(self, db: Session, user_rid: str, project_id: str, code_submission: str) -> dict:
        """
        AI performs an automated code review on the user's project.
        """
        # Simulated AI feedback
        score = 85.0
        feedback = "Great job with the logic! You followed the PEP 8 guidelines well. "
        if len(code_submission) < 50:
             score = 40.0
             feedback = "The submission seems too short. Try to implement more of the core requirements."
        elif "import" not in code_submission:
             feedback += "Consider using external libraries for advanced data handling."

        return {
            "project_id": project_id,
            "score": score,
            "ai_review": feedback,
            "status": "passed" if score >= 60 else "resubmit"
        }

project_builder_engine = ProjectBuilderEngine()
