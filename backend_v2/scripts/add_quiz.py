from app.core.database import SessionLocal
from app.models.engagement import Quiz, QuizQuestion, QuizOption
from app.models.course import Module
import uuid

db = SessionLocal()
try:
    # Find module
    course_id = '43e79efb-e4a7-47a9-9ebe-b1fae88a3ad9'
    module = db.query(Module).filter(Module.course_id == course_id).first()
    if not module:
        print("Module not found")
    else:
        print(f"Adding quiz to module: {module.title} ({module.id})")
        quiz = Quiz(
            course_id=course_id,
            module_id=module.id,
            title="FastAPI Fundamentals Quiz",
            description="Test your knowledge of FastAPI basics.",
            passing_score=80
        )
        db.add(quiz)
        db.flush()
        
        q1 = QuizQuestion(
            quiz_id=quiz.id,
            question_text="What command is used to run a FastAPI app with Uvicorn?",
            points=10,
            position=0
        )
        db.add(q1)
        db.flush()
        
        db.add(QuizOption(question_id=q1.id, option_text="uvicorn main:app --reload", is_correct=True))
        db.add(QuizOption(question_id=q1.id, option_text="python main.py", is_correct=False))
        db.add(QuizOption(question_id=q1.id, option_text="fastapi run", is_correct=False))
        
        db.commit()
        print(f"Quiz added successfully! ID: {quiz.id}")
finally:
    db.close()
