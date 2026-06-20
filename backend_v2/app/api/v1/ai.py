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
    1. Checks if video exists.
    2. Bills the user synchronously to verify credits.
    3. Triggers Celery task in the background (falls back to synchronous execution if Celery/Redis is offline).
    """
    # 1. Look up video
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video or not video.youtube_id:
        raise HTTPException(status_code=404, detail="Video not found or has no YouTube ID")

    # 2. Bill user
    if current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN", "CREATOR"]:
        success = AITutorEngine.bill_usage(db, current_user.rid, "GENERATE_QUIZ", tokens=1000)
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits to generate an AI quiz.")

    # 3. Trigger background task
    try:
        # Verify Redis connectivity first to avoid long broker-connection timeouts on Celery dispatch
        from app.core.redis import redis_client
        redis_client.ping()

        from app.workers.ai_tasks import generate_quiz_task
        task = generate_quiz_task.delay(video_id, current_user.rid)
        return {
            "status": "pending",
            "task_id": task.id,
            "message": "Quiz generation task queued."
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Celery/Redis check failed; executing synchronously: {e}")
        from app.workers.ai_tasks import generate_quiz_task
        res = generate_quiz_task(video_id, current_user.rid)
        return {
            "status": "success",
            "quiz_id": res.get("quiz_id"),
            "questions_generated": res.get("questions_generated"),
            "message": "Quiz generated synchronously (Celery fallback)."
        }

@router.get("/generate-quiz/status/{task_id}")
def get_quiz_generation_status(task_id: str, current_user: User = Depends(get_current_user)):
    """
    Check the status of a Celery background task for quiz generation.
    Returns status and results when completed.
    """
    from celery.result import AsyncResult
    from app.core.celery_app import celery_app
    
    res = AsyncResult(task_id, app=celery_app)
    state = res.state
    
    response = {"status": state, "task_id": task_id}
    
    if state == "SUCCESS":
        response.update({
            "result": res.result,
            "quiz_id": res.result.get("quiz_id") if isinstance(res.result, dict) else None
        })
    elif state == "FAILURE":
        response.update({
            "error": str(res.result)
        })
        
    return response
