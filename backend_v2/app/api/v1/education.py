"""
CediTrees 2.0 — Education Admin API Router
============================================
Management of educational content:
- Course oversight
- Lesson & Video management
- Quiz administration
- Student progress monitoring
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Annotated
from datetime import datetime
import os, shutil
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from app.core.permissions import require_education_admin, require_super_admin
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.models.user import User
from app.models.course import Course, Module, Video
from app.models.marketplace import CourseEnrollment, CourseReview
from app.models.engagement import Quiz, QuizAttempt
from app.models.progress import CourseProgress
from app.models.ai import AILesson, LessonProgress, LessonChat, SubjectRoadmap, KnowledgeSource
from app.services.ai_engine import ai_tutor_engine
from app.services.document_service import document_service
from app.services.ai_prompts import SECTION_INSTRUCTIONS

router = APIRouter()

# ═══════════════════════════════════════
#  COURSE MANAGEMENT
# ═══════════════════════════════════════
@router.get("/courses")
def list_all_courses(current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    return db.query(Course).all()

@router.get("/courses/{course_id}/stats")
def get_course_admin_stats(course_id: str, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    
    enrollments = db.query(func.count(CourseEnrollment.id)).filter(CourseEnrollment.course_id == course_id).scalar() or 0
    completions = db.query(func.count(CourseEnrollment.id)).filter(
        CourseEnrollment.course_id == course_id, 
        CourseEnrollment.completed == True
    ).scalar() or 0
    
    avg_rating = db.query(func.avg(CourseReview.rating)).filter(CourseReview.course_id == course_id).scalar() or 0
    
    return {
        "enrollments": enrollments,
        "completions": completions,
        "avg_rating": round(float(avg_rating), 2)
    }

# ═══════════════════════════════════════
#  STUDENT PROGRESS MONITORING
# ═══════════════════════════════════════
@router.get("/students/progress")
def monitor_all_progress(
    current_user: Annotated[User, Depends(require_education_admin)], 
    course_id: str | None = None, 
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db)
):
    q = db.query(CourseProgress)
    if course_id:
        q = q.filter(CourseProgress.course_id == course_id)
        
    return q.offset(skip).limit(limit).all()

# ═══════════════════════════════════════
#  QUIZ MANAGEMENT
# ═══════════════════════════════════════
class QuizCreate(BaseModel):
    course_id: str
    module_id: str | None = None
    title: str
    description: str | None = None
    passing_score: int = 70

@router.post("/quizzes")
def create_quiz(body: QuizCreate, current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    quiz = Quiz(**body.dict())
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.get("/quizzes")
def list_all_quizzes(
    current_user: Annotated[User, Depends(require_education_admin)],
    course_id: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Quiz)
    if course_id:
        query = query.filter(Quiz.course_id == course_id)
    
    quizzes = query.all()
    
    # Enrich with stats
    result = []
    for q in quizzes:
        attempts = db.query(func.count(QuizAttempt.id)).filter(QuizAttempt.quiz_id == q.id).scalar() or 0
        passes = db.query(func.count(QuizAttempt.id)).filter(QuizAttempt.quiz_id == q.id, QuizAttempt.passed == True).scalar() or 0
        result.append({
            "id": q.id,
            "title": q.title,
            "course_id": q.course_id,
            "module_id": q.module_id,
            "passing_score": q.passing_score,
            "total_attempts": attempts,
            "pass_rate": round((passes / attempts * 100), 1) if attempts > 0 else 0
        })
    return result

@router.get("/quizzes/stats")
def get_global_quiz_stats(current_user: Annotated[User, Depends(require_education_admin)], db: Session = Depends(get_db)):
    total_quizzes = db.query(func.count(Quiz.id)).scalar() or 0
    total_attempts = db.query(func.count(QuizAttempt.id)).scalar() or 0
    passed_attempts = db.query(func.count(QuizAttempt.id)).filter(QuizAttempt.passed == True).scalar() or 0
    
    pass_rate = (passed_attempts / total_attempts * 100) if total_attempts > 0 else 0
    
    return {
        "total_quizzes": total_quizzes,
        "total_attempts": total_attempts,
        "avg_pass_rate": round(pass_rate, 1)
    }


# ═══════════════════════════════════════
#  AI LESSON GENERATION & ROADMAPS
# ═══════════════════════════════════════

class GenerateLessonRequest(BaseModel):
    title: str
    topic: str
    difficulty: str  # beginner, intermediate, advanced
    education_level: str # Primary School, Junior High, etc.
    learner_goal: str # Pass exams, Career preparation, etc.
    objectives: list[str]
    style: str  # socratic, problem-based, lecture, interactive
    target_duration_minutes: int
    uai: str | None = None
    roadmap_id: str | None = None
    source_id: str | None = None

@router.get("/roadmaps")
def list_roadmaps(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all persisted subject roadmaps for the current user."""
    return db.query(SubjectRoadmap).filter(SubjectRoadmap.user_rid == current_user.rid).all()

@router.post("/roadmaps/generate")
def generate_subject_roadmap(
    subject: str,
    source_id: str | None = None,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Phase 1: Generate or retrieve a subject roadmap."""
    roadmap = ai_tutor_engine.generate_roadmap(db, current_user.rid, subject, source_id=source_id, force=force, timeout=180)
    # Handle error dict if generation failed
    if isinstance(roadmap, dict) and "error" in roadmap:
        raise HTTPException(status_code=500, detail=roadmap.get("details", roadmap["error"]))
    
    return {
        "id": roadmap.id,
        "subject": roadmap.subject,
        "roadmap_data": roadmap.roadmap_data
    }

@router.get("/roadmaps/{roadmap_id}")
def get_roadmap_details(
    roadmap_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve detailed roadmap with unit-level progress and metadata."""
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.id == roadmap_id,
        SubjectRoadmap.user_rid == current_user.rid
    ).first()
    
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
        
    # Calculate Unit-Level Stats
    units = roadmap.roadmap_data.get("units", [])
    unit_stats = []
    total_topics = 0
    completed_topics = 0
    
    for unit in units:
        if not isinstance(unit, dict):
            continue
            
        unit_topics = unit.get("topics", [])
        total_topics += len(unit_topics)
        unit_completed = 0
        
        for topic in unit_topics:
            tid = None
            if isinstance(topic, dict):
                tid = topic.get("id")
            
            if not tid: continue

            status = (roadmap.progress or {}).get(tid, {}).get("status", "not_started")
            if status == "completed":
                unit_completed += 1
                completed_topics += 1
        
        unit_stats.append({
            "title": unit.get("title", "Untitled Unit"),
            "total_topics": len(unit_topics),
            "completed_topics": unit_completed,
            "is_completed": (unit_completed == len(unit_topics)) if unit_topics else False
        })
        
    # --- 🧠 Elite: Smart Next-Action Engine ---
    recommendation_reason = "Continue your learning journey."
    confidence_basis = "Starting fresh."
    recommended_topic_id = None
    
    progress_map = roadmap.progress or {}
    
    for unit in units:
        for topic in unit.get("topics", []):
            t_id = topic.get("id")
            status = progress_map.get(t_id, {}).get("status", "not_started")
            if status != "completed":
                recommended_topic_id = t_id
                
                # Logic: If user struggled (score < 60), recommend mastery
                last_score = progress_map.get(t_id, {}).get("exercise_score", 100)
                if last_score < 60:
                    recommendation_reason = f"Recommended: Re-master '{topic.get('title')}' because you struggled with the concepts in your last attempt."
                    confidence_basis = "Struggling detected."
                else:
                    recommendation_reason = f"Recommended: Start '{topic.get('title')}' to build on your current foundation."
                    confidence_basis = "Natural progression."
                break
        if recommended_topic_id: break

    return {
        "id": str(roadmap.id),
        "subject": roadmap.subject,
        "difficulty": roadmap.difficulty_level,
        "goal": roadmap.learning_goal,
        "roadmap_data": roadmap.roadmap_data,
        "units": units,
        "unit_stats": unit_stats,
        "progress_percent": int((completed_topics / total_topics) * 100) if total_topics else 0,
        "progress_data": roadmap.progress or {},
        "guided_mode": roadmap.guided_mode,
        "total_topics": total_topics,
        "completed_topics": completed_topics,
        "recommended_topic_id": recommended_topic_id,
        "recommendation_reason": recommendation_reason,
        "confidence_basis": confidence_basis
    }

@router.patch("/roadmaps/{roadmap_id}/config")
def update_roadmap_config(
    roadmap_id: str,
    guided_mode: bool = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle guided mode or other local roadmap config."""
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.id == roadmap_id,
        SubjectRoadmap.user_rid == current_user.rid
    ).first()
    
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
        
    if guided_mode is not None:
        roadmap.guided_mode = guided_mode
        
    db.commit()
    return {"status": "success", "guided_mode": roadmap.guided_mode}

def generate_deep_lesson_scenes(db: Session, user_rid: str, topic: str, difficulty: str, education_level: str, learner_goal: str, style: str, uai: str | None = None, source_id: str | None = None):
    """
    Phase 3: Parallel Assembly Pipeline (Chapter Concurrency).
    Generates textbook-level lesson scenes for a specific topic with depth validation in parallel.
    Uses a dynamic lesson plan (outline) generated by the AI first.
    """
    # Step 1: Generate a dynamic lesson plan
    print(f"DEBUG: Generating dynamic lesson plan for topic: {topic}")
    plan = ai_tutor_engine.generate_lesson_plan(db, topic, source_id=source_id)
    
    def generate_chapter(section):
        key = section.get("key", "section")
        title = section.get("title", "Untitled Section")
        instructions = section.get("instructions", "")
        
        # Create a thread-local session for safety
        thread_db = SessionLocal()
        try:
            print(f"DEBUG: Parallel Streaming Chapter: {title} ({key}) for topic: {topic}")
            scenes = ai_tutor_engine.generate_lesson_chapter(
                db=thread_db, 
                user_rid=user_rid, 
                topic=topic, 
                section_key=key,
                custom_instructions=instructions,
                section_title=title,
                difficulty=difficulty,
                education_level=education_level,
                learner_goal=learner_goal,
                style=style,
                uai=uai,
                source_id=source_id,
                timeout=60
            )
            thread_db.commit()
            return key, scenes
        except Exception as e:
            print(f"ERROR in parallel generation for {title}: {str(e)}")
            return key, [] 
        finally:
            thread_db.close()

    results = {}
    # Use ThreadPoolExecutor for I/O bound LLM calls
    with ThreadPoolExecutor(max_workers=len(plan)) as executor:
        futures = {executor.submit(generate_chapter, section): section.get("key") for section in plan}
        try:
            for future in as_completed(futures, timeout=120):
                key, scenes = future.result()
                results[key] = scenes
        except Exception as e:
            print(f"CRITICAL: Parallel generation timed out or failed: {e}")
    
    # Assemble in order of the plan
    all_scenes = []
    for section in plan:
        key = section.get("key")
        all_scenes.extend(results.get(key, []))
    
    # --- 🛡️ Safety: Fallback Scene (v17) ---
    if not all_scenes:
        print(f"WARNING: All parallel chapters failed for {topic}. Generating safety scene.")
        all_scenes = [{
            "id": "safety_intro",
            "type": "text_explanation",
            "semantic_type": "explanation",
            "title": f"Introduction to {topic}",
            "content": f"Welcome to the module on {topic}. We are currently architecting the deep technical layers of this subject. Let's start with the first principles.",
            "actions": [],
            "quiz_questions": []
        }]
        
    return all_scenes

@router.post("/lessons/generate")
def generate_lesson(
    body: GenerateLessonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an AI-powered interactive textbook-level lesson"""
    try:
        # --- 🚀 Parallel Generation: Scenes & Roadmap ---
        def generate_roadmap_threaded():
            if body.roadmap_id:
                r_db = SessionLocal()
                try:
                    return r_db.query(SubjectRoadmap).filter(SubjectRoadmap.id == body.roadmap_id).first()
                finally:
                    r_db.close()

            r_db = SessionLocal()
            try:
                return ai_tutor_engine.generate_roadmap(r_db, current_user.rid, body.topic, source_id=body.source_id, timeout=60)
            except Exception as e:
                print(f"WARNING: Roadmap generation failed (non-fatal): {str(e)}")
                return None
            finally:
                r_db.close()

        with ThreadPoolExecutor(max_workers=2) as outer_executor:
            scenes_future = outer_executor.submit(
                generate_deep_lesson_scenes,
                db=db, 
                user_rid=current_user.rid, 
                topic=body.topic,
                difficulty=body.difficulty,
                education_level=body.education_level,
                learner_goal=body.learner_goal,
                style=body.style,
                uai=body.uai,
                source_id=body.source_id
            )
            roadmap_future = outer_executor.submit(generate_roadmap_threaded)
            
            scenes = scenes_future.result()
            curriculum = roadmap_future.result()
        
        # 🛡️ Elite: Process curriculum metadata
        roadmap_id = None
        if curriculum and hasattr(curriculum, 'id'):
            roadmap_id = curriculum.id
        elif isinstance(curriculum, dict) and "error" in curriculum:
            print(f"WARNING: Roadmap generation error: {curriculum['error']}")
            curriculum = None
        
        # 🛡️ Elite: Ensure metadata has structure even if roadmap is missing
        metadata = {}
        if curriculum and hasattr(curriculum, 'roadmap_data'):
            metadata = curriculum.roadmap_data
        
        # Create lesson record
        lesson = AILesson(
            creator_rid=current_user.rid,
            title=body.title,
            topic=body.topic,
            difficulty=body.difficulty,
            style=body.style,
            objectives=body.objectives,
            scenes=scenes,
            curriculum_metadata=metadata,
            module_id=body.uai or body.roadmap_id, # Link to roadmap
            target_duration_minutes=body.target_duration_minutes,
            total_scenes=len(scenes),
            status="published",
            is_partially_generated=False
        )
        
        db.add(lesson)
        db.commit()
        db.refresh(lesson)
        
        return {
            "status": "success",
            "lesson_id": lesson.id,
            "roadmap_id": roadmap_id,
            "id": lesson.id,
            "title": lesson.title,
            "topic": lesson.topic,
            "scenes_count": len(scenes)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate deep lesson: {str(e)}")


@router.get("/lessons/{lesson_id}")
def get_lesson(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get lesson details"""
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # --- 🛡️ Elite: Dynamic Metadata Recovery (v17) ---
    # Fallback to Subject Roadmaps if the lesson metadata is missing
    metadata = lesson.curriculum_metadata
    if not metadata or not metadata.get("section_a"):
        roadmap = db.query(SubjectRoadmap).filter(
            SubjectRoadmap.user_rid == current_user.rid,
            SubjectRoadmap.subject.ilike(lesson.topic)
        ).first()
        if roadmap:
            metadata = roadmap.roadmap_data
            
    return {
        "id": lesson.id,
        "title": lesson.title,
        "topic": lesson.topic,
        "difficulty": lesson.difficulty,
        "style": lesson.style,
        "objectives": lesson.objectives,
        "scenes": lesson.scenes,
        "target_duration_minutes": lesson.target_duration_minutes,
        "total_scenes": lesson.total_scenes,
        "curriculum_metadata": metadata,
        "roadmap_id": lesson.module_id, # Link back to roadmap
        "created_at": lesson.created_at
    }


@router.get("/lessons")
def list_lessons(
    current_user: Annotated[User, Depends(require_education_admin)],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """List all lessons (Admin View)"""
    lessons = db.query(AILesson).offset(skip).limit(limit).all()
    return {
        "lessons": [
            {
                "id": l.id,
                "title": l.title,
                "topic": l.topic,
                "difficulty": l.difficulty,
                "created_at": l.created_at
            }
            for l in lessons
        ],
        "total": len(lessons)
    }


from pydantic import BaseModel
import uuid

class ProgressUpdate(BaseModel):
    scene_id: str | None = None
    completed: bool = False

@router.post("/lessons/{lesson_id}/progress")
def update_lesson_progress(
    lesson_id: str,
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user progress in lesson"""
    try:
        uuid_obj = uuid.UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    scene_id = payload.scene_id
    completed = payload.completed
    
    # Get or create progress record
    progress = db.query(LessonProgress).filter(
        LessonProgress.user_rid == current_user.rid,
        LessonProgress.lesson_id == lesson_id
    ).first()
    
    if not progress:
        progress = LessonProgress(
            user_rid=current_user.rid,
            lesson_id=lesson_id,
            module_id=lesson.module_id,
            total_scenes=lesson.total_scenes or 0,
            current_scene=0,
            completed_scenes=0
        )
        db.add(progress)
    
    if scene_id:
        try:
            parts = scene_id.split("_")
            if len(parts) > 1 and parts[-1].isdigit():
                progress.current_scene = int(parts[-1])
            else:
                # Fallback: if it's a named scene like 'practice', keep current or use logic to find index
                # For now, let's just not crash. 
                pass
        except (ValueError, IndexError):
            pass
    
    if completed:
        progress.completed = True
        progress.completion_date = datetime.utcnow()
    
    # Ensure no NoneType comparisons
    safe_current = progress.current_scene or 0
    safe_completed = progress.completed_scenes or 0
    safe_total = progress.total_scenes or 0
    
    progress.completed_scenes = max(safe_completed, safe_current)
    progress.last_accessed = datetime.utcnow()
    
    # Update last successful scene for recovery
    if lesson.is_partially_generated:
        lesson.last_successful_scene_index = safe_current
    
    # Rigorous Completion Validation
    if progress.completed_scenes >= safe_total:
        progress.completed = True
        # Verified only if all scenes viewed AND average score >= 60%
        if progress.exercise_score >= 60:
            progress.completion_verified = True
            progress.completion_date = datetime.utcnow()
    
    db.commit()
    db.refresh(progress)
    
    return {
        "status": "updated", 
        "progress": progress.completed_scenes,
        "verified": progress.completion_verified,
        "score": float(progress.exercise_score)
    }


@router.post("/lessons/{lesson_id}/scenes/{scene_id}/quiz/submit")
def submit_quiz_answer(
    lesson_id: str,
    scene_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit quiz answer with Anti-Gaming Penalties and Confidence Scoring"""
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    submitted_answers = body.get("answers", {})
    start_time = body.get("start_time") # ISO format from frontend
    
    # 1. Track Attempts (Anti-Gaming)
    progress = db.query(LessonProgress).filter(
        LessonProgress.user_rid == current_user.rid,
        LessonProgress.lesson_id == lesson_id
    ).first()
    
    if not progress:
        # Should not happen if player is active
        raise HTTPException(status_code=400, detail="Progress record missing")

    # Ensure metadata fields are initialized
    attr_list = ["attempt_history", "performance_metrics", "weak_areas"]
    for attr in attr_list:
        if getattr(progress, attr) is None:
            setattr(progress, attr, {} if attr != "weak_areas" else [])

    attempts = (progress.attempt_history or {}).get(scene_id, [])
    attempts.append(datetime.utcnow().isoformat())
    
    # Create a new dict for assignment to trigger SQLAlchemy update
    new_history = dict(progress.attempt_history or {})
    new_history[scene_id] = attempts
    progress.attempt_history = new_history
    
    # 2. Calculate Penalty Multiplier
    # 1-2 attempts: 1.0, 3rd: 0.8, 4th: 0.6, 5th+: 0.4
    attempt_count = len(attempts)
    penalty = 1.0
    if attempt_count == 3: penalty = 0.8
    elif attempt_count == 4: penalty = 0.6
    elif attempt_count >= 5: penalty = 0.4
    
    progress.penalty_multiplier = float(penalty)
    
    # 3. Grade the Quiz
    scene = next((s for s in lesson.scenes if s.get("id") == scene_id), None)
    quiz_questions = (scene or {}).get("quiz_questions", [])
    
    correct_count = 0
    results = []
    for q in quiz_questions:
        is_correct = submitted_answers.get(q["id"]) == q["correct_answer"]
        if is_correct: correct_count += 1
        results.append({
            "question_id": q["id"],
            "correct": is_correct,
            "correct_answer": q["correct_answer"],
            "explanation": q.get("explanation", "")
        })
    
    raw_score = (correct_count / len(quiz_questions)) * 100 if quiz_questions else 0
    weighted_score = raw_score * penalty
    
    # 4. Confidence Scoring (Speed + Accuracy)
    time_taken = 0
    if start_time:
        try:
            dt_start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            time_taken = (datetime.utcnow() - dt_start).total_seconds()
        except Exception: pass
    
    # High confidence = Correct on 1st attempt + Fast (< 60s total)
    confidence = 0
    if raw_score >= 80 and attempt_count == 1:
        confidence = 100 if time_taken < 30 else 80
    elif raw_score >= 60:
        confidence = 50
    progress.confidence_score = float(confidence)
    
    # 5. Persist Metrics & Reinforcement Trigger
    progress.exercise_score = max(float(progress.exercise_score), float(weighted_score))
    
    new_metrics = dict(progress.performance_metrics or {})
    new_metrics[scene_id] = {
        "score": weighted_score,
        "raw_score": raw_score,
        "attempts": attempt_count,
        "time_s": time_taken,
        "confidence": confidence,
        "timestamp": datetime.utcnow().isoformat()
    }
    progress.performance_metrics = new_metrics
    
    # Hybrid Reinforcement Injection Logic
    needs_reinforcement = False
    if weighted_score < 50:
        needs_reinforcement = True
        current_weak = set(progress.weak_areas or [])
        current_weak.add(lesson.topic) 
        progress.weak_areas = list(current_weak)
    
    db.commit()
    
    return {
        "submitted": True,
        "score": weighted_score,
        "raw_score": raw_score,
        "penalty_applied": penalty < 1.0,
        "results": results,
        "needs_reinforcement": needs_reinforcement,
        "should_suggest_reinforcement": 50 <= weighted_score < 60
    }


@router.get("/lessons/{lesson_id}/chat/history")
def get_chat_history(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for lesson"""
    history = db.query(LessonChat).filter(
        LessonChat.user_rid == current_user.rid,
        LessonChat.lesson_id == lesson_id
    ).order_by(LessonChat.created_at).all()
    
    return {
        "messages": [
            {
                "id": h.id,
                "role": h.role,
                "content": h.message,
                "timestamp": h.created_at.isoformat() if h.created_at else None
            }
            for h in history
        ]
    }


@router.post("/lessons/{lesson_id}/chat")
def send_chat_message(
    lesson_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send message to AI tutor"""
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    user_message = body.get("message", "")
    tutor_role = body.get("tutor_role", "tutor")  # teacher, tutor, or peer
    
    # Store user message
    user_chat = LessonChat(
        user_rid=current_user.rid,
        lesson_id=lesson_id,
        role="user",
        message=user_message
    )
    db.add(user_chat)
    db.commit()
    
    # Fetch recent history (last 15 messages) for context
    history_records = db.query(LessonChat).filter(
        LessonChat.user_rid == current_user.rid,
        LessonChat.lesson_id == lesson_id
    ).order_by(LessonChat.created_at.desc()).limit(15).all()
    
    # Reverse to chronological order for the AI
    history = []
    for h in reversed(history_records):
        history.append({
            "role": h.role,
            "content": h.message
        })

    # Generate AI response
    try:
        ai_response = ai_tutor_engine.chat(
            user_message=user_message,
            history=history,
            context={"topic": lesson.topic, "tutor_role": tutor_role},
            user=current_user,
            db=db
        )
    except Exception as e:
        print(f"Education API Chat Error: {str(e)}")
        ai_response = f"As your {tutor_role}, I'd like to help you explore this topic further: {user_message}"
    
    # Store AI response
    ai_chat = LessonChat(
        user_rid=current_user.rid,
        lesson_id=lesson_id,
        role=tutor_role,
        message=ai_response
    )
    db.add(ai_chat)
    db.commit()
    
    return {
        "user_message": user_message,
        "response": ai_response,
        "tutor_role": tutor_role
    }

@router.get("/resume")
def get_resume_state(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Global 'Resume Learning' logic. Finds the most recently accessed unfinished lesson."""
    last_progress = db.query(LessonProgress).filter(
        LessonProgress.user_rid == current_user.rid,
        LessonProgress.completion_verified == False
    ).order_by(desc(LessonProgress.last_accessed)).first()
    
    if not last_progress:
        return {"can_resume": False}
    
    lesson = db.query(AILesson).filter(AILesson.id == last_progress.lesson_id).first()
    if not lesson:
        return {"can_resume": False}
        
    return {
        "can_resume": True,
        "lesson_id": lesson.id,
        "title": lesson.title,
        "topic": lesson.topic,
        "current_scene": last_progress.current_scene,
        "total_scenes": last_progress.total_scenes,
        "progress_percent": round((last_progress.completed_scenes / last_progress.total_scenes) * 100, 1) if last_progress.total_scenes else 0
    }



# ═══════════════════════════════════════════════════════════════
# ─── KNOWLEDGE SOURCE / AI LIBRARY ENDPOINTS ─────────────────
# ═══════════════════════════════════════════════════════════════

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "knowledge")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".docx", ".txt", ".pptx", ".csv"}


@router.post("/knowledge/upload")
async def upload_knowledge_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Upload a book or document to the Global AI Library."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    import uuid as _uuid
    safe_name = f"{_uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    file_size = os.path.getsize(file_path)
    title = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ").title()

    source = KnowledgeSource(
        uploader_rid=user.rid,
        title=title,
        filename=file.filename,
        file_type=ext.lstrip("."),
        file_size_bytes=file_size,
        file_path=file_path,
        status="uploaded",
        source_type="user_upload",
        is_shared=True
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    # 🚀 Trigger Indexing in the Background
    # We pass a fresh session for the background task
    from app.core.database import SessionLocal
    def run_indexing(source_id):
        new_db = SessionLocal()
        try:
            document_service.index_document(new_db, source_id)
        finally:
            new_db.close()

    background_tasks.add_task(run_indexing, source.id)

    return {
        "id": source.id,
        "title": source.title,
        "filename": source.filename,
        "file_type": source.file_type,
        "file_size_bytes": source.file_size_bytes,
        "status": source.status,
        "message": "Source uploaded successfully. Indexing will begin shortly."
    }


@router.get("/knowledge/library")
async def list_knowledge_library(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    subject: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List available sources from the Global AI Library."""
    query = db.query(KnowledgeSource).filter(
        KnowledgeSource.is_shared == True,
        KnowledgeSource.status.in_(["uploaded", "indexed"])
    )
    if subject:
        query = query.filter(KnowledgeSource.subject.ilike(f"%{subject}%"))

    total = query.count()
    sources = query.order_by(desc(KnowledgeSource.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "sources": [
            {
                "id": s.id,
                "title": s.title,
                "filename": s.filename,
                "file_type": s.file_type,
                "subject": s.subject,
                "author": s.author,
                "status": s.status,
                "source_type": s.source_type,
                "is_ai_generated": s.is_ai_generated,
                "quality_score": float(s.quality_score) if s.quality_score else 0,
                "usage_count": s.usage_count,
                "uploaded_by": s.uploader_rid,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in sources
        ]
    }


@router.get("/knowledge/{source_id}")
async def get_knowledge_source(
    source_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get details for a specific knowledge source."""
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    return {
        "id": source.id,
        "title": source.title,
        "filename": source.filename,
        "file_type": source.file_type,
        "file_size_bytes": source.file_size_bytes,
        "author": source.author,
        "isbn": source.isbn,
        "subject": source.subject,
        "description": source.description,
        "status": source.status,
        "chunk_count": source.chunk_count,
        "page_count": source.page_count,
        "source_type": source.source_type,
        "is_ai_generated": source.is_ai_generated,
        "is_approved": source.is_approved,
        "quality_score": float(source.quality_score) if source.quality_score else 0,
        "usage_count": source.usage_count,
        "created_at": source.created_at.isoformat() if source.created_at else None
    }


@router.get("/knowledge/{source_id}/topics")
async def get_source_topics(
    source_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Retrieves or generates a Table of Contents (Units/Topics) for a specific book.
    Used for the dynamic Topic Explorer in the Knowledge Forge.
    """
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    # 1. Check for existing SubjectRoadmap for this specific source/subject
    # (Note: In this implementation, we treat the roadmap as the source of truth for TOC)
    subject = source.subject or source.title
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.user_rid == user.rid,
        SubjectRoadmap.subject.ilike(subject)
    ).first()

    if not roadmap:
        # 🚀 Phase 1: Fast Roadmap Generation (Curriculum-Only)
        # We use a 45s timeout to ensure the user isn't waiting indefinitely
        roadmap = ai_tutor_engine.generate_roadmap(db, user.rid, subject, source_id=source_id, timeout=45)
        
        if isinstance(roadmap, dict) and "error" in roadmap:
            # Fallback: return a basic structure if AI fails
            return {
                "source_id": source_id,
                "title": source.title,
                "units": [
                    {
                        "title": "General Concepts",
                        "topics": [source.title]
                    }
                ]
            }

    # Extract clean units/topics for the frontend
    roadmap_data = roadmap.roadmap_data if hasattr(roadmap, 'roadmap_data') else roadmap
    units = roadmap_data.get("units", [])
    
    # 🛡️ Elite: Map legacy data structures if needed
    formatted_units = []
    for unit in units:
        if not isinstance(unit, dict):
            formatted_units.append({
                "name": str(unit),
                "topics": []
            })
            continue

        topics = []
        for topic in unit.get("topics", []):
            if isinstance(topic, dict):
                topics.append(topic.get("title", "Untitled Topic"))
            else:
                topics.append(str(topic))
        
        formatted_units.append({
            "name": unit.get("title", "Untitled Unit"),
            "topics": topics
        })

    return {
        "source_id": source_id,
        "title": source.title,
        "units": formatted_units
    }


@router.post("/knowledge/{source_id}/reindex")
async def reindex_knowledge_source(
    source_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Manually trigger re-indexing of a knowledge source."""
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    from app.core.database import SessionLocal
    def run_indexing(sid):
        new_db = SessionLocal()
        try:
            document_service.index_document(new_db, sid)
        finally:
            new_db.close()

    background_tasks.add_task(run_indexing, source.id)
    return {"message": "Re-indexing started in the background."}
