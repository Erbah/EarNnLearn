"""
CediTrees 2.0 — Education Admin API Router
============================================
Management of educational content:
- Course oversight
- Lesson & Video management
- Quiz administration
- Student progress monitoring
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from datetime import datetime
import json

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.course import Course, Module, Video
from app.models.marketplace import CourseEnrollment, CourseReview, Quiz
from app.models.progress import CourseProgress
from app.models.ai import AILesson, LessonProgress, LessonChat, SubjectRoadmap
from app.services.ai_engine import ai_tutor_engine
from app.services.ai_prompts import SECTION_INSTRUCTIONS

router = APIRouter()

# ─── Helpers: Role Guard ───
def require_education_admin(user: User):
    if user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Education Admin access required")

# ═══════════════════════════════════════
#  COURSE MANAGEMENT
# ═══════════════════════════════════════
@router.get("/courses")
def list_all_courses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_education_admin(current_user)
    return db.query(Course).all()

@router.get("/courses/{course_id}/stats")
def get_course_admin_stats(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_education_admin(current_user)
    
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
    course_id: str | None = None, 
    skip: int = 0, limit: int = 50,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    require_education_admin(current_user)
    q = db.query(CourseProgress)
    if course_id:
        q = q.filter(CourseProgress.course_id == course_id)
        
    return q.offset(skip).limit(limit).all()

# ═══════════════════════════════════════
#  QUIZ MANAGEMENT
# ═══════════════════════════════════════
class QuizCreate(BaseModel):
    module_id: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str # a, b, c, d
    position: int = 0

@router.post("/quizzes")
def create_quiz(body: QuizCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_education_admin(current_user)
    quiz = Quiz(**body.dict())
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


# ═══════════════════════════════════════
#  AI LESSON GENERATION & ROADMAPS
# ═══════════════════════════════════════

class GenerateLessonRequest(BaseModel):
    title: str
    topic: str
    difficulty: str  # beginner, intermediate, advanced
    objectives: list[str]
    style: str  # socratic, problem-based, lecture, interactive
    target_duration_minutes: int

@router.get("/roadmaps")
def list_roadmaps(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all persisted subject roadmaps for the current user."""
    return db.query(SubjectRoadmap).filter(SubjectRoadmap.user_rid == current_user.rid).all()

@router.post("/roadmaps/generate")
def generate_subject_roadmap(
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Phase 1: Generate or retrieve a subject roadmap."""
    roadmap = ai_tutor_engine.generate_roadmap(db, current_user.rid, subject)
    return roadmap

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
        unit_topics = unit.get("topics", [])
        total_topics += len(unit_topics)
        unit_completed = 0
        
        for topic in unit_topics:
            tid = topic.get("id")
            status = (roadmap.progress or {}).get(tid, {}).get("status", "not_started")
            if status == "completed":
                unit_completed += 1
                completed_topics += 1
        
        unit_stats.append({
            "title": unit.get("title"),
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
        "title": roadmap.title,
        "units": units,
        "unit_stats": unit_stats,
        "overall_progress": int((completed_topics / total_topics) * 100) if total_topics else 0,
        "config": roadmap.config or {},
        "recommended_topic_id": recommended_topic_id,
        "recommendation_reason": recommendation_reason,
        "confidence_basis": confidence_basis
    }

    # Find "Resume" Topic (Last accessed or first incomplete)
    resume_topic_id = None
    # 1. Check if any topic was 'started'
    for tid, pdata in (roadmap.progress or {}).items():
        if pdata.get("status") == "in_progress":
            resume_topic_id = tid
            break
            
    # 2. Fallback: First 'not_started' topic that isn't locked (guided mode)
    if not resume_topic_id:
        for unit in units:
            for topic in unit.get("topics", []):
                tid = topic.get("id")
                status = (roadmap.progress or {}).get(tid, {}).get("status", "not_started")
                if status == "not_started":
                    resume_topic_id = tid
                    break
            if resume_topic_id: break

    return {
        "id": roadmap.id,
        "subject": roadmap.subject,
        "roadmap_data": roadmap.roadmap_data,
        "progress": roadmap.progress,
        "unit_stats": unit_stats,
        "dependency_graph": roadmap.dependency_graph,
        "guided_mode": roadmap.guided_mode,
        "teacher_id": roadmap.teacher_id,
        "overall_progress": round((completed_topics / total_topics * 100) if total_topics > 0 else 0, 1),
        "resume_topic_id": resume_topic_id
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

def generate_deep_lesson_scenes(db: Session, user_rid: str, topic: str):
    """
    Phase 3: Sequential Assembly Pipeline (Chapter Streaming).
    Generates textbook-level lesson scenes for a specific topic with depth validation.
    """
    all_scenes = []
    
    # Sections to generate in order (MANDATORY STRUCTURE)
    section_keys = [
        "introduction",
        "core_concepts",
        "technical_detail",
        "examples",
        "exercises",
        "summary"
    ]
    
    for key in section_keys:
        print(f"DEBUG: Streaming Chapter: {key} for topic: {topic}")
        # Each chapter returns a LIST of micro-scenes
        chapter_scenes = ai_tutor_engine.generate_lesson_chapter(db, user_rid, topic, key)
        all_scenes.extend(chapter_scenes)
        
    return all_scenes

@router.post("/lessons/generate")
def generate_lesson(
    body: GenerateLessonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an AI-powered interactive textbook-level lesson"""
    try:
        # Generate deep textbook-level scenes via Chapter Streaming
        scenes = generate_deep_lesson_scenes(db=db, user_rid=current_user.rid, topic=body.topic)
        
        # Create lesson record
        lesson = AILesson(
            creator_rid=current_user.rid,
            title=body.title,
            topic=body.topic,
            difficulty=body.difficulty,
            style=body.style,
            objectives=body.objectives,
            scenes=scenes,
            target_duration_minutes=body.target_duration_minutes,
            total_scenes=len(scenes),
            status="published",
            is_partially_generated=False # Set to True if you want true streaming async
        )
        
        db.add(lesson)
        db.commit()
        db.refresh(lesson)
        
        return {
            "status": "success",
            "lesson_id": lesson.id,
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
        "created_at": lesson.created_at
    }


@router.get("/lessons")
def list_lessons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """List all lessons"""
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
            user=current_user
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


@router.get("/roadmaps")
def get_roadmaps(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all AI roadmaps for the user"""
    roadmaps = db.query(SubjectRoadmap).filter(SubjectRoadmap.user_rid == current_user.rid).all()
    return [{"id": r.id, "subject": r.subject, "difficulty": r.difficulty_level, "goal": r.learning_goal, "updated_at": r.updated_at} for r in roadmaps]


@router.get("/roadmaps/{roadmap_id}")
def get_roadmap_details(roadmap_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get full details/progress for a specific roadmap"""
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.id == roadmap_id,
        SubjectRoadmap.user_rid == current_user.rid
    ).first()
    
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
        
    # Calculate global subject progress based on topic statuses
    topics_progress = roadmap.progress or {}
    total_topics = 0
    completed_topics = 0
    
    roadmap_data = roadmap.roadmap_data or {}
    dependency_graph = roadmap.dependency_graph or {}
    
    active_topic_id = None
    prereqs_met = True
    missing_prereqs = []

    for unit in roadmap_data.get("units", []):
        for topic in unit.get("topics", []):
            total_topics += 1
            topic_id = topic["id"]
            status = topics_progress.get(topic_id, {}).get("status")
            
            if status == "completed":
                completed_topics += 1
            elif not active_topic_id:
                # This is the current topic the user should be on
                active_topic_id = topic_id
                # Check prerequisites
                prereqs = dependency_graph.get(topic_id, [])
                for p_id in prereqs:
                    if topics_progress.get(p_id, {}).get("status") != "completed":
                        prereqs_met = False
                        missing_prereqs.append(p_id)
                
    progress_percent = round((completed_topics / total_topics) * 100, 1) if total_topics else 0
    
    return {
        "id": roadmap.id,
        "subject": roadmap.subject,
        "difficulty": roadmap.difficulty_level,
        "goal": roadmap.learning_goal,
        "guided_mode": roadmap.guided_mode,
        "roadmap_data": roadmap_data,
        "progress_data": topics_progress,
        "progress_percent": progress_percent,
        "total_topics": total_topics,
        "completed_topics": completed_topics,
        "next_recommended_topic": active_topic_id,
        "prerequisites_met": prereqs_met,
        "missing_prerequisites": missing_prereqs
    }
