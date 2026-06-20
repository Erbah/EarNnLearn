from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json
import sys
import os

# Set up DB connection
db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
engine = create_engine(f"sqlite:///{db_path}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def inspect_lesson(lesson_id):
    db = SessionLocal()
    try:
        from app.models.ai import AILesson, KnowledgeSource
        lesson = db.query(AILesson).filter(AILesson.id == lesson_id).first()
        if not lesson:
            print(f"Lesson {lesson_id} not found")
            return
            
        print(f"Title: {lesson.title}")
        print(f"Topic: {lesson.topic}")
        print(f"Difficulty: {lesson.difficulty}")
        print(f"Status: {lesson.status}")
        
        # Check if it was generated from a source
        # Look in curriculum_metadata or if there's any mention
        print("\nCurriculum Metadata Keys:", lesson.curriculum_metadata.keys())
        
        # Check if there are any knowledge sources uploaded by the same creator
        sources = db.query(KnowledgeSource).filter(KnowledgeSource.uploader_rid == lesson.creator_rid).all()
        print(f"\nKnowledge Sources by creator ({lesson.creator_rid}):")
        for s in sources:
            print(f"- {s.title} ({s.filename}), Status: {s.status}")
            
        # Inspect first scene content
        if lesson.scenes:
            first_scene = lesson.scenes[0]
            print("\nFirst Scene Content Preview:")
            print(first_scene.get('content', 'No content field')[:500])
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    lesson_id = "de532908-b676-45a7-bf79-1dc923a8c248"
    inspect_lesson(lesson_id)
