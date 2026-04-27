from sqlalchemy.orm import Session
from sqlalchemy import desc
from common.models.education import AICompanionSession, AICourse, AITopic, AIAssignment
from datetime import datetime

class LearningCompanionService:
    """
    Personalized AI tutor that understands the student's history.
    """

    def get_chat_response(self, db: Session, user_rid: str, message: str) -> dict:
        """
        Processes a chat message using student context.
        """
        # 1. FIND SESSION
        session = db.query(AICompanionSession).filter(AICompanionSession.user_rid == user_rid).first()
        if not session:
            session = AICompanionSession(user_rid=user_rid)
            db.add(session)
            db.flush()

        # 2. GATHER CONTEXT (Latest course, topic, and struggle)
        latest_course = db.query(AICourse).filter(AICourse.user_rid == user_rid).order_by(desc(AICourse.created_at)).first()
        context = "New Learner"
        if latest_course:
            context = f"Learning {latest_course.title}"

        # 3. GENERATE SIMULATED RESPONSE
        # In production, this would call OpenAI with the context buffer.
        answer = f"I see you're working on {context}. Regarding your question: '{message}' - that's a great point! "
        if "loop" in message.lower():
            answer += "In Python, a loop repeats code. Try: for i in range(3): print(i). Need a practice exercise?"
        else:
            answer += "Let me look into that for you. Based on your progress, you're 80% through the basics."

        # 4. UPDATE HISTORY
        history = list(session.message_history or [])
        history.append({"role": "user", "content": message, "time": str(datetime.utcnow())})
        history.append({"role": "assistant", "content": answer, "time": str(datetime.utcnow())})
        
        session.message_history = history
        session.last_active = datetime.utcnow()
        db.commit()

        return {
            "answer": answer,
            "session_id": session.id,
            "context": context
        }

companion_service = LearningCompanionService()
