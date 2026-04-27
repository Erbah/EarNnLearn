from sqlalchemy.orm import Session
from common.models.ai import AIUsageLog
from common.models.wallet import Wallet, WalletTransaction
from decimal import Decimal

# Cost constants per 1000 tokens (e.g., matching OpenAI GPT-4o-mini pricing)
COST_PER_1K_TOKENS = Decimal('0.005') 

class AITutorEngine:
    
    @staticmethod
    def bill_usage(db: Session, user_rid: str, feature: str, tokens: int, prompt_data: dict = None) -> bool:
        """
        Calculates the AI token cost and securely deducts it from the user's wallet.
        Returns False if the user lacks the funds to complete the AI request.
        """
        # Calculate exact cost for this translation
        cost = (Decimal(str(tokens)) / Decimal('1000')) * COST_PER_1K_TOKENS
        
        # Free use for infinitesimally small tasks or dev environments
        if cost <= Decimal('0.0000'):
            return True

        wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).first()
        if not wallet or wallet.balance < cost:
            return False # Payment Required - AI Access Denied
            
        # Deduct Cost
        wallet.balance -= cost
        wallet.withdrawable_balance -= cost
        
        # Log AI explicit transaction
        db.add(WalletTransaction(
            user_rid=user_rid,
            type="AI_USAGE",
            amount=-cost,
            description=f"AI Token Usage: {feature} ({tokens} tokens)"
        ))
        
        # Log AI metric
        db.add(AIUsageLog(
            user_rid=user_rid,
            feature_used=feature,
            tokens_used=tokens,
            cost=cost,
            prompt_metadata=prompt_data
        ))
        
        db.commit()
        return True

    @staticmethod
    def generate_quiz_prompt(video_title: str, duration: int) -> str:
        """
        Helper to construct the LLM prompt for the Quiz Feature.
        In production, this strings together with `openai` or `anthropic` clients.
        """
        return f"Generate a 5-question multiple choice quiz for the educational video titled '{video_title}'. Make it challenging but fair."

ai_tutor_engine = AITutorEngine()
