from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_engine import ai_tutor_engine

router = APIRouter()

class AIAskRequest(BaseModel):
    video_id: str
    question: str

@router.post("/ask")
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
