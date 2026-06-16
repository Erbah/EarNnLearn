from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.course import Course
from app.models.engagement import (
    Quiz, QuizQuestion, QuizOption, QuizAttempt, Discussion, DiscussionReply
)
from app.schemas.engagement import (
    QuizCreate, QuizOut, QuizQuestionCreate, QuizAttemptCreate, QuizAttemptOut,
    DiscussionCreate, DiscussionOut, DiscussionReplyCreate, DiscussionReplyOut
)
from app.services.gamification_service import GamificationService

router = APIRouter()

# --- QUIZZES ---

@router.post("/quizzes", response_model=QuizOut)
def create_quiz(
    body: QuizCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user is the creator of the course
    course = db.query(Course).filter(Course.id == body.course_id, Course.creator_rid == current_user.rid).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to create quizzes for this course")
    
    quiz = Quiz(
        course_id=body.course_id,
        module_id=body.module_id,
        title=body.title,
        description=body.description,
        passing_score=body.passing_score
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.post("/quizzes/{quiz_id}/questions", response_model=QuizOut)
def add_questions_to_quiz(
    quiz_id: str,
    questions: List[QuizQuestionCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check creator
    course = db.query(Course).filter(Course.id == quiz.course_id, Course.creator_rid == current_user.rid).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized")

    for q_data in questions:
        question = QuizQuestion(
            quiz_id=quiz_id,
            question_text=q_data.question_text,
            question_type=q_data.question_type,
            points=q_data.points,
            position=q_data.position
        )
        db.add(question)
        db.flush() # Get question ID
        
        for o_data in q_data.options:
            option = QuizOption(
                question_id=question.id,
                option_text=o_data.option_text,
                is_correct=o_data.is_correct
            )
            db.add(option)
            
    db.commit()
    db.refresh(quiz)
    return quiz

@router.get("/quizzes/course/{course_id}", response_model=List[QuizOut])
def list_course_quizzes(course_id: str, db: Session = Depends(get_db)):
    return db.query(Quiz).filter(Quiz.course_id == course_id).all()

@router.get("/quizzes/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@router.post("/quizzes/{quiz_id}/submit", response_model=QuizAttemptOut)
def submit_quiz(
    quiz_id: str,
    body: QuizAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    total_points = 0
    earned_points = 0
    
    # Simple grading logic
    for answer in body.answers:
        q_id = answer.get("question_id")
        o_id = answer.get("option_id")
        
        question = db.query(QuizQuestion).filter(QuizQuestion.id == q_id, QuizQuestion.quiz_id == quiz_id).first()
        if question:
            total_points += question.points
            correct_option = db.query(QuizOption).filter(QuizOption.question_id == q_id, QuizOption.is_correct == True).first()
            if correct_option and correct_option.id == o_id:
                earned_points += question.points
                
    # If no questions provided in attempt but they exist in quiz, calculate total correctly
    actual_total = sum(q.points for q in quiz.questions)
    if actual_total > total_points:
        total_points = actual_total

    score_pct = (earned_points / total_points * 100) if total_points > 0 else 0
    passed = score_pct >= quiz.passing_score
    
    # Check if this is the user's first time passing this quiz
    is_first_pass = False
    if passed:
        previous_pass = db.query(QuizAttempt).filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_rid == current_user.rid,
            QuizAttempt.passed == True
        ).first()
        is_first_pass = previous_pass is None
    
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_rid=current_user.rid,
        score=earned_points,
        total_points=total_points,
        passed=passed
    )
    db.add(attempt)
    
    if passed and is_first_pass:
        GamificationService.award_xp(db, current_user, amount=100, difficulty="medium", is_first_attempt=True)
        GamificationService.update_streak(db, current_user)
        
    db.commit()
    db.refresh(attempt)
    return attempt

# --- DISCUSSIONS ---

@router.post("/discussions", response_model=DiscussionOut)
def create_discussion(
    body: DiscussionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    discussion = Discussion(
        course_id=body.course_id,
        video_id=body.video_id,
        user_rid=current_user.rid,
        title=body.title,
        content=body.content
    )
    db.add(discussion)
    db.commit()
    db.refresh(discussion)
    return discussion

@router.get("/discussions/course/{course_id}", response_model=List[DiscussionOut])
def list_discussions(course_id: str, db: Session = Depends(get_db)):
    return db.query(Discussion).filter(Discussion.course_id == course_id).order_by(Discussion.created_at.desc()).all()

@router.post("/discussions/{discussion_id}/replies", response_model=DiscussionReplyOut)
def reply_to_discussion(
    discussion_id: str,
    body: DiscussionReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    discussion = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    # Check if instructor
    course = db.query(Course).filter(Course.id == discussion.course_id).first()
    is_instructor = course.creator_rid == current_user.rid if course else False
    
    reply = DiscussionReply(
        discussion_id=discussion_id,
        user_rid=current_user.rid,
        content=body.content,
        is_instructor_reply=is_instructor
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply
