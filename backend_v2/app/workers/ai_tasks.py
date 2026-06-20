"""
CediTrees 2.0 — AI Quiz Generation Celery Worker
===================================================
Executes slow generative AI quiz creation tasks in the background.
Downloads transcripts and invokes LLMs outside the FastAPI HTTP thread.
"""
import logging
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.course import Video, Module
from app.models.engagement import Quiz, QuizQuestion, QuizOption
from app.services.ai_engine import AITutorEngine
from app.services.ingestion_service import ingestion_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def generate_quiz_task(self, video_id: str, user_rid: str):
    """
    Asynchronous task to fetch YouTube transcript, generate questions,
    and persist a quiz to the database.
    """
    logger.info(f"Starting quiz generation task for video_id={video_id}, user_rid={user_rid}")
    
    db = SessionLocal()
    try:
        # 1. Look up video
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise ValueError(f"Video {video_id} not found")
        if not video.youtube_id:
            raise ValueError(f"Video {video_id} has no YouTube ID")

        # 2. Fetch transcript
        logger.info(f"Fetching YouTube transcript for youtube_id={video.youtube_id}")
        transcript = ingestion_service.fetch_youtube_transcript(video.youtube_id)
        if not transcript or len(transcript.strip()) < 50:
            raise ValueError("Could not extract a valid transcript for this video. Captions may be disabled.")

        # 3. Generate Questions
        logger.info(f"Generating quiz questions using AITutorEngine")
        questions_data = AITutorEngine.generate_video_quiz(db, video.title, transcript)
        if not questions_data or not isinstance(questions_data, list):
            raise ValueError("AI failed to generate a valid quiz format.")

        # 4. Save to DB
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
        logger.info(f"Successfully generated quiz_id={quiz.id} with {len(questions_data)} questions.")
        
        return {
            "status": "success",
            "quiz_id": quiz.id,
            "questions_generated": len(questions_data)
        }
        
    except Exception as exc:
        db.rollback()
        logger.error(f"Quiz generation task failed: {exc}")
        # Reraise exception so Celery marks task as FAILED
        raise exc
    finally:
        db.close()
