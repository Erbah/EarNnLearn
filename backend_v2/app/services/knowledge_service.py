from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.ai import SubjectRoadmap, AILesson, AIAsset
from typing import List, Optional
import uuid

class KnowledgeService:
    @staticmethod
    def find_similar_roadmaps(db: Session, subject: str, limit: int = 5) -> List[SubjectRoadmap]:
        """
        Find existing public roadmaps that match the subject.
        Uses a basic ilike search for now; in production, this should use vector search.
        """
        return db.query(SubjectRoadmap).filter(
            or_(
                SubjectRoadmap.subject.ilike(f"%{subject}%"),
                SubjectRoadmap.tags.op('->>')(0).ilike(f"%{subject}%") # Basic tag search if tags is JSON array
            ),
            SubjectRoadmap.is_public == True
        ).order_by(SubjectRoadmap.popularity_score.desc()).limit(limit).all()

    @staticmethod
    def find_similar_lessons(db: Session, topic: str, limit: int = 5) -> List[AILesson]:
        """
        Find existing public lessons that match the topic.
        """
        return db.query(AILesson).filter(
            or_(
                AILesson.topic.ilike(f"%{topic}%"),
                AILesson.title.ilike(f"%{topic}%")
            ),
            AILesson.is_public == True
        ).order_by(AILesson.popularity_score.desc()).limit(limit).all()

    @staticmethod
    def clone_roadmap(db: Session, roadmap_id: str, user_rid: str) -> SubjectRoadmap:
        """
        Clones an existing roadmap for a new user.
        """
        original = db.query(SubjectRoadmap).filter(SubjectRoadmap.id == roadmap_id).first()
        if not original:
            raise ValueError("Roadmap not found")

        if original.user_rid != user_rid and not original.is_public:
            raise ValueError("Roadmap not found or access denied")

        new_roadmap = SubjectRoadmap(
            user_rid=user_rid,
            subject=original.subject,
            roadmap_data=original.roadmap_data,
            dependency_graph=original.dependency_graph,
            difficulty_level=original.difficulty_level,
            learning_goal=original.learning_goal,
            parent_id=original.id,
            version=(original.version or 1) + 1,
            is_public=False,
            tags=original.tags
        )
        db.add(new_roadmap)
        
        # Update usage count on original
        original.usage_count = (original.usage_count or 0) + 1
        
        db.commit()
        db.refresh(new_roadmap)
        return new_roadmap

    @staticmethod
    def atomize_lesson(db: Session, lesson: AILesson):
        """
        Converts lesson scenes into reusable AIAsset chunks.
        """
        if not lesson.scenes:
            return

        for i, scene in enumerate(lesson.scenes):
            asset = AIAsset(
                id=str(uuid.uuid4()),
                user_rid=lesson.creator_rid,
                type="explanation", # or "whiteboard", "quiz"
                subject=lesson.topic,
                title=scene.get("title", f"Scene {i+1}"),
                content_markdown=scene.get("content", ""),
                is_public=lesson.is_public,
                version=1,
                extra_metadata={
                    "lesson_id": lesson.id,
                    "scene_index": i,
                    "style": lesson.style
                }
            )
            db.add(asset)
        
        db.commit()

knowledge_service = KnowledgeService()
