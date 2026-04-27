from sqlalchemy.orm import Session
from datetime import datetime
from common.models.education import AICourse
from common.models.subscription import SeasonActivation

class ContinuityService:
    """
    Handles cross-season learning persistence under the Permanent Identity model.
    Since accounts are now permanent, progress is inherently stable.
    This service now primarily manages season-based access control.
    """

    def get_user_learning_continuity(self, db: Session, user_rid: str, current_season_id: str) -> dict:
        """
        Identifies uncompleted courses and verifies if the user has unlocked the current season.
        """
        # 1. Check for Active Subscription
        activation = db.query(SeasonActivation).filter(
            SeasonActivation.user_rid == user_rid,
            SeasonActivation.season_id == current_season_id
        ).first()
        
        has_access = activation is not None
        
        # 2. Find Unfinished Courses (from any season)
        unfinished_courses = db.query(AICourse).filter(
            AICourse.user_rid == user_rid,
            AICourse.is_completed == False
        ).all()
        
        return {
            "has_active_season": has_access,
            "unfinished_count": len(unfinished_courses),
            "courses": [
                {
                    "course_id": str(c.id),
                    "title": c.title,
                    "progress": c.progress_percent, # Assuming this exists or is calculated
                    "last_accessed": c.updated_at
                } for c in unfinished_courses
            ]
        }

continuity_service = ContinuityService()
