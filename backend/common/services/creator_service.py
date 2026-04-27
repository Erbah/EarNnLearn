from sqlalchemy.orm import Session
from common.models.marketplace import CreatorProfile
from common.models.education import AICourse
import uuid

class CreatorService:
    """
    Handles expert onboarding and course publishing.
    """

    def apply_as_creator(self, db: Session, user_rid: str, expert_bio: str, tags: list) -> CreatorProfile:
        """
        Registers a user as a potential creator.
        """
        profile = db.query(CreatorProfile).filter(CreatorProfile.user_rid == user_rid).first()
        if not profile:
            profile = CreatorProfile(
                user_rid=user_rid,
                expert_bio=expert_bio,
                expertise_tags=tags
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    def publish_expert_course(self, db: Session, creator_rid: str, title: str, knowledge_base: str) -> AICourse:
        """
        Expert publishes a specialized course. AI Teacher uses the 'knowledge_base'
        as a grounding for its roadmap generation.
        """
        # Simulation: AI Roadmap generation influenced by creator content
        from common.services.ai_teacher_engine import ai_teacher_engine
        
        # We record that this course came from an expert
        course = ai_teacher_engine.generate_roadmap(db, creator_rid, title, skill_level="Expert-Led")
        # In reality, we'd store the knowledge_base mapping here too.
        
        return course

creator_service = CreatorService()
