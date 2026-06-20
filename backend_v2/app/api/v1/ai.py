from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rate_limit import ai_rate_limiter
from app.models.user import User
from app.models.course import Video
from app.models.engagement import Quiz, QuizQuestion, QuizOption
from app.services.ai_engine import AITutorEngine, ai_tutor_engine
from app.services.ingestion_service import ingestion_service

router = APIRouter()

class AIAskRequest(BaseModel):
    video_id: str
    question: str

@router.post("/ask", dependencies=[Depends(ai_rate_limiter)])
def ask_ai_tutor(body: AIAskRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Ask the AI Tutor a question about a specific video.
    Deducts AI tokens from the user's wallet.
    """
    # 1. Simulate token count (approx 200 tokens for simple Q&A)
    tokens = 250 
    
    # 2. Bill the user
    success = ai_tutor_engine.bill_usage(
        db, 
        current_user.rid, 
        feature="TUTOR", 
        tokens=tokens,
        prompt_data={"video_id": body.video_id, "question": body.question}
    )
    
    if not success:
        raise HTTPException(status_code=402, detail="Insufficient credits for AI Tutor. Please top up your wallet.")

    # 3. Return mock response (In prod, this calls OpenAI/Claude)
    answer = f"Hello {current_user.name}! Regarding your question on '{body.question}': This concept relates to the core principles of the lesson. You should focus on how the variables interact at the 3-minute mark."
    
    return {
        "status": "success",
        "tokens_billed": tokens,
        "answer": answer
    }

@router.post("/generate-quiz/{video_id}", dependencies=[Depends(ai_rate_limiter)])
def auto_generate_quiz(video_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    1. Fetches YouTube transcript for a video.
    2. Uses AI to generate a 5-question multiple choice quiz.
    3. Saves it directly to the database.
    """
    if current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN", "CREATOR"]:
        # Standard users should be billed to use this feature, or restricted. 
        # For this version, we'll allow anyone to trigger it but bill them.
        success = AITutorEngine.bill_usage(db, current_user.rid, "GENERATE_QUIZ", tokens=1000)
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits to generate an AI quiz.")

    # 1. Look up video
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video or not video.youtube_id:
        raise HTTPException(status_code=404, detail="Video not found or has no YouTube ID")

    # 2. Fetch transcript
    transcript = ingestion_service.fetch_youtube_transcript(video.youtube_id)
    if not transcript or len(transcript.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract a valid transcript for this video. Captions may be disabled.")

    # 3. Generate Questions
    questions_data = AITutorEngine.generate_video_quiz(db, video.title, transcript)
    if not questions_data or not isinstance(questions_data, list):
        raise HTTPException(status_code=500, detail="AI failed to generate a valid quiz format. Please try again.")

    # 4. Save to DB
    import uuid
    from app.models.course import Module
    module = db.query(Module).filter(Module.id == video.module_id).first()
    course_id = module.course_id if module else "unknown"

    quiz = Quiz(
        course_id=course_id,
        module_id=video.module_id,
        title=f"AI Generated Quiz: {video.title}",
        description="This quiz was automatically generated from the video transcript by AI.",
        passing_score=70
    )
    db.add(quiz)
    db.flush()

    for q_idx, q_data in enumerate(questions_data, start=1):
        q_text = q_data.get("question_text")
        q_type = q_data.get("question_type", "multiple_choice")
        if not q_text: continue
        
        db_question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_text,
            question_type=q_type,
            points=10,
            position=q_idx
        )
        db.add(db_question)
        db.flush()
        
        for opt_data in q_data.get("options", []):
            db_opt = QuizOption(
                question_id=db_question.id,
                option_text=opt_data.get("option_text", "Unknown Option"),
                is_correct=bool(opt_data.get("is_correct", False))
            )
            db.add(db_opt)

    db.commit()

    return {
        "status": "success",
        "message": "Quiz generated successfully",
        "quiz_id": quiz.id,
        "questions_generated": len(questions_data)
    }
