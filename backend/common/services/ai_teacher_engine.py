import uuid
import json
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from common.models.education import AICourse, AITopic, AIAssignment
from common.models.wallet import Wallet, WalletTransaction

class AITeacherEngine:
    """
    The brain of the EarNnLearn AI Teacher System.
    Handles Roadmap Generation, Resource Discovery, and Automated Grading.
    """
    
    TEACHER_PERSONAS = {
        "math": "AI Mathematics Teacher",
        "coding": "AI Computer Science Teacher",
        "business": "AI Business Teacher",
        "engineering": "AI Engineering Teacher",
        "language": "AI Language Teacher"
    }

    def generate_roadmap(self, db: Session, user_rid: str, course_title: str, level: str = "Beginner") -> AICourse:
        """
        Simulates AI LLM generating a course roadmap.
        In production, this calls OpenAI/Claude to generate a structured JSON.
        """
        # 1. Determine teacher type based on title keywords
        teacher_type = "AI General Tutor"
        for key, persona in self.TEACHER_PERSONAS.items():
            if key in course_title.lower():
                teacher_type = persona
                break
        
        # 2. Skeleton Roadmap
        roadmap = [
            {"module": "Introduction", "topics": [f"Basics of {course_title}", f"Why {course_title} matters"]},
            {"module": "Core Concepts", "topics": ["The Fundamentals", "Practical Applications", "Common Pitfalls"]},
            {"module": "Advanced Techniques", "topics": ["Mastery Level 1", "Real-world Project"]},
            {"module": "Final Review", "topics": ["Exam Prep", "Final Quiz"]}
        ]

        # 3. Create Course Record
        new_course = AICourse(
            user_rid=user_rid,
            title=course_title,
            skill_level=level,
            teacher_type=teacher_type,
            roadmap_data=roadmap
        )
        db.add(new_course)
        db.flush() # Get ID

        # 4. Create Topics
        position = 0
        for module in roadmap:
            for topic_name in module["topics"]:
                topic = AITopic(
                    course_id=new_course.id,
                    title=topic_name,
                    position=position,
                    explanation=f"This is an AI-generated explanation for {topic_name}. In this lesson, we will cover the core principles of {course_title} at a {level} level.",
                    resources=[
                        {"type": "video", "title": f"Mastering {topic_name}", "url": "https://youtube.com/watch?v=example"},
                        {"type": "article", "title": f"{topic_name} Documentation", "url": "https://docs.example.com"}
                    ]
                )
                db.add(topic)
                position += 1
        
        db.commit()
        return new_course

    def generate_assignment(self, db: Session, topic_id: str) -> AIAssignment:
        """
        Generates a tailored assignment for a specific topic.
        """
        topic = db.query(AITopic).filter(AITopic.id == topic_id).first()
        if not topic:
            return None
            
        course = db.query(AICourse).filter(AICourse.id == topic.course_id).first()
        
        questions = [
            {"q": f"Define the primary goal of {topic.title}?", "type": "text"},
            {"q": f"How does {topic.title} relate to {course.title}?", "type": "text"},
            {"q": f"Provide a practical example of {topic.title}.", "type": "text"}
        ]
        
        assignment = AIAssignment(
            topic_id=topic_id,
            user_rid=course.user_rid,
            questions=questions
        )
        db.add(assignment)
        db.commit()
        
        # Link topic to assignment
        topic.assignment_id = assignment.id
        db.commit()
        
        return assignment

    def grade_assignment(self, db: Session, assignment_id: str, answers: dict) -> dict:
        """
        Simulates AI grading of user submissions.
        """
        assignment = db.query(AIAssignment).filter(AIAssignment.id == assignment_id).first()
        if not assignment:
            return {"error": "Assignment not found"}
            
        assignment.user_answers = answers
        assignment.submitted_at = datetime.utcnow()
        
        # AI Logic: Analyze answers (mocked)
        score = Decimal("85.00")
        feedback = "Great work! You demonstrated a solid understanding of the concepts. Focus on the relationship between variables in Topic 2 for further improvement."
        
        assignment.score = score
        assignment.ai_feedback = feedback
        
        # Check if course completion is triggered
        self.check_course_completion(db, assignment.user_rid, assignment.topic_id)
        
        db.commit()
        return {"score": float(score), "feedback": feedback}

    def check_course_completion(self, db: Session, user_rid: str, last_topic_id: str):
        """
        Calculates final grade and issues certificate if all topics are done.
        """
        # Logic to check if this was the last topic and all assignments are graded
        # For simulation, we assume completion after 5 topic grades
        pass

ai_teacher_engine = AITeacherEngine()
