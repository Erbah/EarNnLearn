import sys
import os
import uuid
from datetime import datetime

# Add backend_v2 to path
sys.path.append(os.path.join(os.getcwd(), "backend_v2"))

from app.core.database import SessionLocal, engine
from app.models.ai import AILesson, LessonProgress

def smoke_test():
    db = SessionLocal()
    try:
        print("Starting Smoke Test: OCE v2.0 Persistence")
        
        # 1. Create a mock deep lesson payload
        test_lesson_id = str(uuid.uuid4())
        mock_scenes = [
            {"id": "scene_1", "type": "text_explanation", "title": "Introduction to GR", "content": "Einstein's field equations..."},
            {"id": "scene_2", "type": "quiz", "title": "Quick Check", "quiz_questions": []}
        ]
        mock_metadata = {
            "section_a": "Abstract Principles",
            "section_b": {"parts": []},
            "uai_index": "UAI-PHY-GR-001"
        }
        
        # 2. Attempt to save the lesson
        print(f"Attempting to insert AILesson with ID: {test_lesson_id}")
        lesson = AILesson(
            id=test_lesson_id,
            creator_rid="TEST_USER",
            title="General Relativity Node",
            topic="General Relativity",
            difficulty="advanced",
            style="interactive",
            objectives=["Understand spacetime curvature"],
            scenes=mock_scenes,
            curriculum_metadata=mock_metadata,
            module_id="UAI-PHY-GR-001",
            target_duration_minutes=45,
            total_scenes=2,
            status="published"
        )
        
        db.add(lesson)
        db.commit()
        print("SUCCESS: AILesson persisted successfully with curriculum_metadata and module_id.")
        
        # 3. Attempt to create progress for this lesson
        print("Attempting to create LessonProgress...")
        progress = LessonProgress(
            user_rid="TEST_USER",
            lesson_id=test_lesson_id,
            module_id=lesson.module_id,
            total_scenes=lesson.total_scenes,
            current_scene=0,
            completed_scenes=0
        )
        db.add(progress)
        db.commit()
        print("SUCCESS: LessonProgress persisted successfully with module_id.")
        
        # 4. Verify retrieval
        retrieved = db.query(AILesson).filter(AILesson.id == test_lesson_id).first()
        if retrieved and retrieved.curriculum_metadata.get("uai_index") == "UAI-PHY-GR-001":
            print("VERIFIED: Data integrity confirmed.")
        else:
            print("FAILURE: Data mismatch on retrieval.")
            
    except Exception as e:
        print(f"SMOKE TEST FAILED: {e}")
        db.rollback()
    finally:
        # Cleanup
        try:
            db.query(LessonProgress).filter(db.query(LessonProgress.lesson_id == test_lesson_id)).delete(synchronize_session=False)
            db.query(AILesson).filter(AILesson.id == test_lesson_id).delete()
            db.commit()
            print("Cleanup complete.")
        except:
            pass
        db.close()

if __name__ == "__main__":
    smoke_test()
