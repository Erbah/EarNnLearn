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
import os, shutil, logging

logger = logging.getLogger(__name__)
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from app.core.permissions import require_education_admin, require_super_admin
from concurrent.futures import ThreadPoolExecutor, as_completed

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".docx", ".txt", ".pptx", ".csv"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

def validate_uploaded_file(file: UploadFile):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Validate file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum limit of 15 MB (uploaded: {file_size / (1024*1024):.2f} MB)."
        )

    # Validate magic bytes
    header = file.file.read(1024)
    file.file.seek(0)  # Reset pointer
    
    is_valid = False
    if ext == ".pdf":
        is_valid = header.startswith(b"%PDF")
    elif ext in [".epub", ".docx", ".pptx"]:
        is_valid = header.startswith(b"PK\x03\x04")
    elif ext in [".txt", ".csv"]:
        try:
            if b"\x00" in header:
                is_valid = False
            else:
                header.decode("utf-8")
                is_valid = True
        except UnicodeDecodeError:
            is_valid = False
            
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="File content integrity verification failed (magic bytes mismatch)."
        )
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

# 🛡️ Access Control validation helper to prevent IDOR on private lessons
def check_lesson_access(lesson: AILesson, user: User):
    if lesson.creator_rid != user.rid and not lesson.is_public and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied to this lesson")

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
    reuse_level: int = 1
    force: bool = False
    include_external_resources: bool = False

@router.get("/roadmaps")
def list_roadmaps(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all persisted subject roadmaps for the current user."""
    return db.query(SubjectRoadmap).filter(SubjectRoadmap.user_rid == current_user.rid).all()

@router.post("/roadmaps/generate")
def generate_subject_roadmap(
    subject: str,
    source_id: str | None = None,
    force: bool = False,
    reuse_level: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Phase 1: Generate or retrieve a subject roadmap."""
    roadmap = ai_tutor_engine.generate_roadmap(db, current_user.rid, subject, source_id=source_id, force=force, timeout=180, reuse_level=reuse_level)
    # Handle error dict if generation failed
    if isinstance(roadmap, dict) and "error" in roadmap:
        logger.error("Roadmap generation failed for user %s subject '%s': %s", current_user.rid, subject, roadmap)
        raise HTTPException(status_code=500, detail="Failed to generate roadmap. Please try again later.")
    
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
        if not isinstance(unit, dict):
            continue
        for topic in unit.get("topics", []):
            if not isinstance(topic, dict):
                continue
            t_id = topic.get("id")
            if not t_id:
                continue
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

def generate_deep_lesson_scenes(db: Session, user_rid: str, topic: str, difficulty: str, education_level: str, learner_goal: str, style: str, uai: str | None = None, source_id: str | None = None, reuse_level: int = 1, custom_plan: list | None = None):
    """
    Phase 3: Parallel Assembly Pipeline (Chapter Concurrency).
    Generates textbook-level lesson scenes for a specific topic with depth validation in parallel.
    Includes a Reuse-First step to check the global Knowledge Library.
    """
    # 1. Reuse Check
    if reuse_level > 0:
        from app.services.knowledge_service import knowledge_service
        similar_lessons = knowledge_service.find_similar_lessons(db, topic, limit=1)
        if similar_lessons:
            print(f"DEBUG: [OCE] Found similar public lesson for '{topic}'. Reusing.")
            return similar_lessons[0].scenes
    # Step 1: Generate a dynamic lesson plan or use custom one
    if custom_plan:
        print(f"DEBUG: Using custom roadmap plan for topic: {topic}")
        # Map roadmap units to expected plan format
        plan = []
        for unit in custom_plan:
            plan.append({
                "key": unit.get("id", "section"),
                "title": unit.get("title", "Untitled Section"),
                "instructions": unit.get("description", "Provide detailed content.")
            })
    else:
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an AI-powered interactive textbook-level lesson"""
    try:
        # --- 🚀 Serial Roadmap -> Parallel Scenes ---
        curriculum = None
        if body.roadmap_id:
            r_db = SessionLocal()
            try:
                curriculum = r_db.query(SubjectRoadmap).filter(SubjectRoadmap.id == body.roadmap_id).first()
            finally:
                r_db.close()

        # If we need to generate a roadmap first, do it here
        if not curriculum and not body.uai:
             r_db = SessionLocal()
             try:
                 curriculum = ai_tutor_engine.generate_roadmap(r_db, current_user.rid, body.topic, source_id=body.source_id, timeout=60)
             except Exception as e:
                 print(f"WARNING: Roadmap generation failed: {str(e)}")
             finally:
                 r_db.close()

        # Extract plan if available
        custom_plan = None
        if curriculum and hasattr(curriculum, 'roadmap_data'):
            custom_plan = curriculum.roadmap_data.get('units')

        scenes = generate_deep_lesson_scenes(
            db=db, 
            user_rid=current_user.rid, 
            topic=body.topic,
            difficulty=body.difficulty,
            education_level=body.education_level,
            learner_goal=body.learner_goal,
            style=body.style,
            uai=body.uai,
            source_id=body.source_id,
            reuse_level=body.reuse_level,
            custom_plan=custom_plan
        )

        # 🚀 External Resources Integration (v2.1)
        if body.include_external_resources:
            try:
                print(f"DEBUG: Generating external resources for topic: {body.topic}")
                resource_scene = ai_tutor_engine.generate_external_resources(db, current_user.rid, body.topic)
                if resource_scene:
                    scenes.append(resource_scene)
            except Exception as e:
                print(f"WARNING: External resource generation failed: {str(e)}")
        
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

        # --- 🧠 Atomize for Library Reusability ---
        from app.services.knowledge_service import knowledge_service
        background_tasks.add_task(knowledge_service.atomize_lesson, db, lesson)
        
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
        logger.error("Failed to generate deep lesson for roadmap %s", roadmap_id, exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to generate lesson content. Please try again later.")


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
    check_lesson_access(lesson, current_user)
    
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """List lessons (Admin sees all, User sees their own) with detailed progress stats"""
    query = db.query(AILesson)
    if current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        query = query.filter(AILesson.creator_rid == current_user.rid)
        
    lessons = query.offset(skip).limit(limit).all()
    
    # Fetch progress records for the user in a single query
    lesson_ids = [l.id for l in lessons]
    progress_records = db.query(LessonProgress).filter(
        LessonProgress.lesson_id.in_(lesson_ids),
        LessonProgress.user_rid == current_user.rid
    ).all()
    progress_map = {p.lesson_id: p for p in progress_records}
    
    lessons_data = []
    for l in lessons:
        p = progress_map.get(l.id)
        completed_scenes = p.completed_scenes if p else 0
        total_scenes = p.total_scenes if p else l.total_scenes or 0
        
        if p and p.completed:
            percent = 100
        elif p and total_scenes > 0:
            percent = int((completed_scenes / total_scenes) * 100)
        else:
            percent = 0

        lessons_data.append({
            "id": l.id,
            "title": l.title,
            "topic": l.topic,
            "difficulty": l.difficulty,
            "style": l.style or "interactive",
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "total_duration_minutes": l.target_duration_minutes or 30,
            "total_scenes": l.total_scenes or 0,
            "progress": {
                "completed_scenes": completed_scenes,
                "total_scenes": total_scenes,
                "completion_percent": percent
            }
        })

    return {
        "lessons": lessons_data,
        "total": len(lessons_data)
    }


@router.post("/material/parse")
async def parse_material(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parse uploaded material, extract text, and generate a document fingerprint.
    Equivalent to Express /api/material/parse endpoint from Edupath.
    """
    validate_uploaded_file(file)
    from app.services.document_agent import fingerprint_document, build_text_book_lesson
    import tempfile
    
    # Save the file temporarily
    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        temp_path = tmp.name
        
    try:
        pages_text = document_service.extract_text(temp_path, filename=file.filename)
        raw_content = "\n".join([page.get("content", "") for page in pages_text])
        page_count = len(pages_text)
        
        fingerprint = fingerprint_document(file.filename, raw_content, page_count)
        
        # If it's the arduino book, prepopulate lessons based on fingerprint
        lessons = []
        if fingerprint.get("detected_profile") == "C Programming for Arduino (Technical Textbook Profile)":
            l = build_text_book_lesson("Connecting the board and uploading blink", "Standard")
            if l:
                lessons.append(l)
            
        return {
            "status": "success",
            "file_name": file.filename,
            "fingerprint": fingerprint,
            "sample_lessons": lessons
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

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
    check_lesson_access(lesson, current_user)
        
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
            
            # Sync with SubjectRoadmap progress
            if lesson.module_id:
                roadmap = db.query(SubjectRoadmap).filter(
                    SubjectRoadmap.id == lesson.module_id,
                    SubjectRoadmap.user_rid == current_user.rid
                ).first()
                if roadmap:
                    # Find topic_id matching lesson.topic
                    topic_id = None
                    for unit in roadmap.roadmap_data.get("units", []):
                        for t in unit.get("topics", []):
                            if t.get("title", "").lower() == lesson.topic.lower() or t.get("id") == lesson.topic:
                                topic_id = t.get("id")
                                break
                        if topic_id: break
                    
                    if topic_id:
                        progress_map = dict(roadmap.progress or {})
                        if progress_map.get(topic_id, {}).get("status") != "completed":
                            progress_map[topic_id] = {
                                "status": "completed",
                                "score": float(progress.exercise_score),
                                "verified": True,
                                "completed_at": datetime.utcnow().isoformat()
                            }
                            roadmap.progress = progress_map
                            
                            # Also update aggregates
                            aggregates = dict(roadmap.roadmap_data.get("aggregates", {"learners_count": 0, "avg_score": 0}))
                            learners = aggregates.get("learners_count", 0) + 1
                            old_avg = aggregates.get("avg_score", 0)
                            new_avg = int((old_avg * (learners - 1) + float(progress.exercise_score)) / learners)
                            
                            aggregates["learners_count"] = learners
                            aggregates["avg_score"] = new_avg
                            
                            roadmap_data = dict(roadmap.roadmap_data)
                            roadmap_data["aggregates"] = aggregates
                            roadmap.roadmap_data = roadmap_data
                            
                            from sqlalchemy.orm.attributes import flag_modified
                            flag_modified(roadmap, "progress")
                            flag_modified(roadmap, "roadmap_data")
    
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
    check_lesson_access(lesson, current_user)
    
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
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    check_lesson_access(lesson, current_user)

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
    check_lesson_access(lesson, current_user)
    
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


@router.post("/knowledge/upload")
async def upload_knowledge_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Upload a book or document to the Global AI Library."""
    validate_uploaded_file(file)
    ext = os.path.splitext(file.filename)[1].lower()

    import uuid as _uuid
    safe_name = f"{_uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    file_size = os.path.getsize(file_path)
    title = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ").title()

    # 🛡️ Anti-Duplicate Logic: Check if this file already exists
    existing = db.query(KnowledgeSource).filter(
        KnowledgeSource.filename == file.filename,
        KnowledgeSource.file_size_bytes == file_size
    ).first()

    if existing:
        # If it exists, just return the existing one instead of creating a duplicate
        # Optional: delete the temp file we just wrote
        try: os.remove(file_path)
        except: pass
        return {
            "id": existing.id,
            "title": existing.title,
            "filename": existing.filename,
            "file_type": existing.file_type,
            "file_size_bytes": existing.file_size_bytes,
            "status": existing.status,
            "message": "Source already exists in library. Using existing record."
        }

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

    if not source.is_shared and source.uploader_rid != user.rid and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied to this knowledge source")

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

    if not source.is_shared and source.uploader_rid != user.rid and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied to this knowledge source")

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

    if not source.is_shared and source.uploader_rid != user.rid and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied to this knowledge source")

    from app.core.database import SessionLocal
    def run_indexing(sid):
        new_db = SessionLocal()
        try:
            document_service.index_document(new_db, sid)
        finally:
            new_db.close()

    background_tasks.add_task(run_indexing, source.id)
    return {"message": "Re-indexing started in the background."}

# ═══════════════════════════════════════
#  KNOWLEDGE LIBRARY & ASSET GOVERNANCE
# ═══════════════════════════════════════

@router.get("/library/roadmaps")
def list_public_roadmaps(
    subject: str | None = Query(None),
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Search the global Knowledge Library for high-quality subject roadmaps.
    """
    query = db.query(SubjectRoadmap).filter(SubjectRoadmap.is_public == True)
    if subject:
        query = query.filter(SubjectRoadmap.subject.ilike(f"%{subject}%"))
    
    return query.order_by(SubjectRoadmap.popularity_score.desc()).limit(limit).all()

@router.get("/library/lessons")
def list_public_lessons(
    topic: str | None = Query(None),
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Search the global Knowledge Library for high-quality AI lessons.
    """
    query = db.query(AILesson).filter(AILesson.is_public == True)
    if topic:
        query = query.filter(AILesson.topic.ilike(f"%{topic}%"))
        
    return query.order_by(AILesson.popularity_score.desc()).limit(limit).all()

@router.post("/library/roadmaps/{roadmap_id}/remix")
def remix_roadmap(
    roadmap_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fork an existing roadmap into the user's personal studio.
    """
    from app.services.knowledge_service import knowledge_service
    try:
        new_roadmap = knowledge_service.clone_roadmap(db, roadmap_id, user.rid)
        return {
            "status": "success",
            "message": "Roadmap remixed successfully",
            "roadmap_id": new_roadmap.id
        }
    except ValueError as e:
        logger.warning("Roadmap remix failed for roadmap %s: %s", roadmap_id, e)
        raise HTTPException(status_code=404, detail="Roadmap not found or cannot be remixed.")

@router.post("/library/lessons/{lesson_id}/remix")
def remix_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fork an existing lesson into the user's personal studio.
    """
    original = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Lesson not found")
    check_lesson_access(original, user)

    new_lesson = AILesson(
        creator_rid=user.rid,
        topic=original.topic,
        title=original.title,
        content_markdown=original.content_markdown,
        scenes=original.scenes,
        total_scenes=original.total_scenes,
        difficulty=original.difficulty,
        education_level=original.education_level,
        learner_goal=original.learner_goal,
        style=original.style,
        uai=original.uai,
        source_id=original.source_id,
        parent_id=original.id,
        version=(original.version or 1) + 1,
        is_public=False
    )
    db.add(new_lesson)
    original.usage_count = (original.usage_count or 0) + 1
    db.commit()
    db.refresh(new_lesson)
    
    return {
        "status": "success",
        "message": "Lesson remixed successfully",
        "lesson_id": new_lesson.id
    }

@router.post("/lessons/{lesson_id}/resources/regenerate")
def regenerate_resource(
    lesson_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate a specific resource in the lesson's resource hub"""
    resource_index = body.get("resource_index")
    if resource_index is None:
        raise HTTPException(status_code=400, detail="resource_index is required")
        
    lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    if lesson.creator_rid != current_user.rid and current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to modify resources for this lesson")
        
    # Find the resource hub scene
    scenes = list(lesson.scenes)
    hub_scene = next((s for s in scenes if s.get("semantic_type") == "resource_hub"), None)
    
    if not hub_scene:
        raise HTTPException(status_code=404, detail="Resource hub not found in this lesson")
        
    resources = hub_scene.get("resources", [])
    if resource_index >= len(resources):
        raise HTTPException(status_code=400, detail="Invalid resource index")
        
    old_resource = resources[resource_index]
    
    # Regenerate
    new_resource = ai_tutor_engine.regenerate_single_resource(db, lesson.topic, old_resource)
    
    if not new_resource:
        raise HTTPException(status_code=500, detail="Failed to regenerate resource")
        
    # Update structured list
    resources[resource_index] = new_resource
    hub_scene["resources"] = resources
    
    # Rebuild Markdown content (optional but good for consistency)
    content = f"To further your mastery of **{lesson.topic}**, I have curated these elite external resources for you. These will provide additional context, visual demonstrations, and technical depth.\n\n"
    for res in resources:
        icon = "🎥" if res.get('type') == 'video' else "📄" if res.get('type') == 'documentation' else "🛠️" if res.get('type') == 'tool' else "📚"
        content += f"### {icon} {res.get('title')}\n"
        content += f"*{res.get('description')}*\n\n"
        content += f"🔗 [Access Resource]({res.get('url')})\n\n---\n\n"
    
    hub_scene["content"] = content
    
    # Persist
    from sqlalchemy.orm.attributes import flag_modified
    lesson.scenes = scenes
    flag_modified(lesson, "scenes")
    db.commit()
    db.refresh(lesson)
    
    return {
        "status": "success",
        "new_resource": new_resource,
        "updated_scene": hub_scene
    }


# ═══════════════════════════════════════════════════════════════
# ─── SUBJECT DISCOVERY AGENT  ─────────────────────────────────
# ═══════════════════════════════════════════════════════════════

class SubjectDiscoverRequest(BaseModel):
    topic: str
    intent: str = "Full Course"
    style: str = "Standard"
    persist: bool = True  # Auto-save as a SubjectRoadmap for quick start


@router.post("/subject/discover")
def discover_subject(
    body: SubjectDiscoverRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    SUBJECT DISCOVERY AGENT
    =======================
    Classifies, designs, and builds an entire educational curriculum in a single
    multi-component pass for any topic not yet in the standard catalog.

    Returns five components:
      A) Classification & Metadata
      B) Sub-Subjects (4-8 branches)
      C) Topics per sub-subject (6-10 micro-topics each)
      D) Phased Roadmap nodes (Beginner → Intermediate → Advanced)
      E) Seed Lesson (textbook-quality, immediately readable)

    If `persist=True`, the roadmap component is also saved as a SubjectRoadmap
    and the roadmap_id is returned so the frontend can navigate directly to it.
    """
    if not body.topic or not body.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    try:
        data = ai_tutor_engine.generate_subject_discovery(
            db=db,
            topic=body.topic.strip(),
            intent=body.intent,
            style=body.style
        )
    except Exception as e:
        logger.error("Subject Discovery Agent error for topic '%s'", getattr(body, 'topic', '?'), exc_info=e)
        raise HTTPException(status_code=500, detail="Subject discovery failed. Please try again later.")

    # ── Optionally persist the roadmap component ──────────────────────────────
    persisted_roadmap_id = None
    if body.persist:
        try:
            roadmap_component = data.get("roadmap", {})
            metadata = data.get("metadata", {})
            sub_subjects = data.get("sub_subjects", [])
            topics_map = data.get("topics", {})

            # Build a SubjectRoadmap-compatible `roadmap_data` structure
            # Convert the EduPath node-based roadmap into the units/topics format
            # that the existing RoadmapPage frontend understands.
            units = []
            for sub in sub_subjects:
                sub_topics = topics_map.get(sub, [])
                units.append({
                    "id": sub.lower().replace(" ", "_").replace("&", "and")[:30],
                    "title": sub,
                    "description": f"Core coverage of {sub}",
                    "topics": [
                        {
                            "id": f"t_{i}_{sub[:10].lower().replace(' ', '_')}",
                            "title": t,
                            "difficulty": "beginner" if i < 2 else "intermediate" if i < 5 else "advanced"
                        }
                        for i, t in enumerate(sub_topics)
                    ]
                })

            # Also store the phased nodes as a separate key for the Discovery UI
            roadmap_data_full = {
                "section_a": {
                    "subject": metadata.get("title", body.topic),
                    "academic_level": metadata.get("difficulty_range", "Beginner to Advanced"),
                    "source": "subject-discovery-agent",
                    "estimated_total_hours": metadata.get("estimated_total_hours", 45),
                    "description": metadata.get("description", ""),
                    "parent_tags": metadata.get("parent_tags", []),
                },
                "units": units,
                "discovery_nodes": roadmap_component.get("nodes", []),
                "seed_lesson": data.get("seed_lesson", {}),
                "classification": data.get("classification", {}),
                "dependency_graph": {}
            }

            # Build a simple linear dependency graph from the units
            flat_topic_ids = []
            for unit in units:
                for t in unit.get("topics", []):
                    flat_topic_ids.append(t["id"])
            graph = {}
            for i, tid in enumerate(flat_topic_ids):
                graph[tid] = [flat_topic_ids[i - 1]] if i > 0 else []
            roadmap_data_full["dependency_graph"] = graph

            # Check for an existing roadmap with the same subject to avoid duplicates
            existing = db.query(SubjectRoadmap).filter(
                SubjectRoadmap.user_rid == current_user.rid,
                SubjectRoadmap.subject.ilike(metadata.get("title", body.topic))
            ).first()

            if existing:
                from sqlalchemy.orm.attributes import flag_modified
                existing.roadmap_data = roadmap_data_full
                existing.dependency_graph = graph
                existing.updated_at = datetime.utcnow()
                flag_modified(existing, "roadmap_data")
                db.commit()
                db.refresh(existing)
                persisted_roadmap_id = str(existing.id)
            else:
                new_roadmap = SubjectRoadmap(
                    user_rid=current_user.rid,
                    subject=metadata.get("title", body.topic),
                    roadmap_data=roadmap_data_full,
                    dependency_graph=graph,
                    difficulty_level=metadata.get("difficulty_range", "Beginner to Advanced"),
                    tags=metadata.get("parent_tags", [])
                )
                db.add(new_roadmap)
                db.commit()
                db.refresh(new_roadmap)
                persisted_roadmap_id = str(new_roadmap.id)

        except Exception as persist_err:
            # Persistence failure is non-fatal; we still return the discovery data
            print(f"WARNING: [SDA] Failed to persist roadmap for '{body.topic}': {persist_err}")

    return {
        **data,
        "roadmap_id": persisted_roadmap_id
    }


# ═══════════════════════════════════════════════════════════════
# ─── EDUPATH EXTRA INTEGRATED ENDPOINTS ───────────────────────
# ═══════════════════════════════════════════════════════════════

class QuizGenerateRequest(BaseModel):
    phase: str
    topicName: str
    style: str = "Standard"
    completed_nodes: list[str] = []

@router.post("/quiz/generate")
def generate_phase_quiz(
    body: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a 4-question phase evaluation quiz.
    """
    phase = body.phase
    topic_name = body.topicName
    completed_nodes = body.completed_nodes

    # Intercept for C Programming/Arduino topics
    is_arduino = (topic_name and "arduino" in topic_name.lower()) or any("arduino" in node.lower() for node in completed_nodes)
    if is_arduino:
        from app.services.document_agent import build_text_book_quiz
        return {"quiz": build_text_book_quiz(phase)}

    quiz_data = ai_tutor_engine.generate_phase_quiz(db, phase, topic_name, completed_nodes)
    return {"quiz": quiz_data}


class StudyBuddyChatRequest(BaseModel):
    message: str
    completed_nodes: list[str] = []
    current_node_title: str = ""
    history: list = []
    style: str = "Standard"

@router.post("/study-buddy/chat")
def study_buddy_chat(
    body: StudyBuddyChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI STUDY BUDDY SIDE-CAR CHAT
    Restricted to completed nodes and current node to prevent spoilers.
    """
    message = body.message
    completed_nodes = body.completed_nodes
    current_node_title = body.current_node_title
    history = body.history
    style = body.style

    completed_str = f"The student has COMPLETED only these milestones: '{', '.join(completed_nodes)}'." if completed_nodes else "The student has not completed any milestones yet."
    active_str = f"They are currently reading: '{current_node_title}'." if current_node_title else "They are focusing on their primary dashboard."

    system_prompt = f"""You are the AI Study Buddy sidecar counselor in the EduPath application.
Your goal is to answer study queries and clarify uncertainties.
CONSTRAINTS:
- You must ONLY discuss, explain, or answer topics that fall under:
  1. Completed Milestones: "{', '.join(completed_nodes)}"
  2. Currently active learning node: "{current_node_title}"
- CRITICAL: Never spoil, preview, or introduce algorithms, codes, or terms from future milestones of the roadmap that are NOT completed yet! 
- If the user asks about an upcoming topic, politely decline and let them know: "That milestone is locked until you complete the current sections. Let's master what we have right now first!"
- Tone: Extremely encouraging, pedagogical, and adaptive to the style: "{style}" (ELIF5, Standard, or Technical).
- Focus on the content outline. Keep responses to 2 or 3 concise, readable paragraphs maximum."""

    user_content = f"""[STUDENT CONTEXT]
{completed_str}
{active_str}
Current Study Style: {style}

[STUDENT QUESTION]
"{message}"
"""

    # We reuse AITutorEngine's LLM connection
    from app.core.config import Settings
    import litellm
    import os

    settings = Settings()
    active_provider, active_model, active_api_key, active_base_url = ai_tutor_engine._get_active_model(db)

    # Fallback response if mock
    if active_provider == "mock":
        fallback_reply = f"Hey! I'm your AI Study Buddy. Currently, we can talk about: {', '.join(completed_nodes) if completed_nodes else 'general goals'}. (Style: {style} Mode)\n\nSince the server is running without an active LLM key, I am in offline sandbox guidelines. Ask me any question, and I'll help you focus on your unlocked prerequisites!"
        return {"reply": fallback_reply}

    api_keys = {
        "google": settings.GOOGLE_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "deepseek": settings.DEEPSEEK_API_KEY,
    }
    
    model = active_model or settings.AI_MODEL
    api_key = active_api_key or api_keys.get(active_provider)
    
    env_key_map = {
        "google": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY"
    }
    if active_provider in env_key_map:
        os.environ[env_key_map[active_provider]] = api_key or ""

    if not api_key and active_provider not in ["google", "openai", "anthropic", "deepseek"]:
         api_key = settings.AI_API_KEY

    # Map message history format
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    for h in history:
        messages.append({
            "role": "assistant" if h.get("role") != "user" else "user",
            "content": h.get("text", "")
        })
    messages.append({"role": "user", "content": user_content})

    completion_args = {
        "model": model,
        "messages": messages,
        "max_tokens": 1000
    }
    if active_base_url:
        completion_args["api_base"] = active_base_url

    try:
        response = litellm.completion(**completion_args)
        reply = response.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        print(f"Study Buddy Agent Error: {e}")
        return {"reply": f"Sorry, I had an issue contacting my thinking core. Let's try again! (Error: {e})"}


@router.post("/roadmaps/{roadmap_id}/topics/{topic_id}/complete")
def complete_roadmap_topic(
    roadmap_id: str,
    topic_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log completion of a roadmap topic and recalculate averages.
    """
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.id == roadmap_id,
        SubjectRoadmap.user_rid == current_user.rid
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    score = body.get("score", 100)
    
    # Initialize progress map if empty
    progress_map = dict(roadmap.progress or {})
    
    # Check if previously completed
    prev_status = progress_map.get(topic_id, {}).get("status", "not_started")
    
    progress_map[topic_id] = {
        "status": "completed",
        "score": score,
        "verified": True,
        "completed_at": datetime.utcnow().isoformat()
    }
    
    # If not previously completed, update aggregates
    aggregates = dict(roadmap.roadmap_data.get("aggregates", {"learners_count": 0, "avg_score": 0}))
    if prev_status != "completed":
        learners = aggregates.get("learners_count", 0) + 1
        old_avg = aggregates.get("avg_score", 0)
        new_avg = int((old_avg * (learners - 1) + score) / learners)
        
        aggregates["learners_count"] = learners
        aggregates["avg_score"] = new_avg
        
        roadmap_data = dict(roadmap.roadmap_data)
        roadmap_data["aggregates"] = aggregates
        roadmap.roadmap_data = roadmap_data
        
    roadmap.progress = progress_map
    
    # Force save
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(roadmap, "progress")
    flag_modified(roadmap, "roadmap_data")
    db.commit()
    db.refresh(roadmap)

    return {"status": "success", "progress": roadmap.progress, "aggregates": aggregates}


@router.post("/roadmaps/{roadmap_id}/topics/{topic_id}/review")
def review_roadmap_topic(
    roadmap_id: str,
    topic_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update Spaced Repetition review log for a roadmap topic.
    """
    roadmap = db.query(SubjectRoadmap).filter(
        SubjectRoadmap.id == roadmap_id,
        SubjectRoadmap.user_rid == current_user.rid
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    progress_map = dict(roadmap.progress or {})
    topic_progress = progress_map.get(topic_id, {})
    
    if not topic_progress:
        topic_progress = {"status": "not_started"}
        
    spaced_info = topic_progress.get("spaced_repetition", {})
    if not spaced_info:
        # Schedule Day 1, 3, 7 review target intervals
        from datetime import timedelta
        now = datetime.utcnow()
        scheduled = [
            (now + timedelta(days=1)).isoformat()[:10],
            (now + timedelta(days=3)).isoformat()[:10],
            (now + timedelta(days=7)).isoformat()[:10]
        ]
        spaced_info = {
            "scheduled_dates": scheduled,
            "completed_reviews": 0
        }

    reviews_done = spaced_info.get("completed_reviews", 0)
    action = body.get("action", "log") # log or reset
    
    if action == "log":
        reviews_done = min(3, reviews_done + 1)
    elif action == "reset":
        reviews_done = 0
        
    spaced_info["completed_reviews"] = reviews_done
    topic_progress["spaced_repetition"] = spaced_info
    progress_map[topic_id] = topic_progress
    roadmap.progress = progress_map
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(roadmap, "progress")
    db.commit()
    db.refresh(roadmap)

    return {"status": "success", "progress": roadmap.progress}

