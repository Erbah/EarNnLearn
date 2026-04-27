from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.learning_tree import LearningNode, LearningPrerequisite
from common.models.progress import CourseProgress
from common.schemas.learning_schema import LearningNodeResponse, UserHUDResponse
from common.services.gamification_service import GamificationService

router = APIRouter()

@router.get("/tree", response_model=List[LearningNodeResponse])
def get_learning_tree(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns the visual forest nodes with status calculated for the specific user.
    """
    nodes = db.query(LearningNode).all()
    
    # Get all courses the user has interacted with
    completed_courses = db.query(CourseProgress.course_id).filter(
        CourseProgress.user_rid == current_user.rid,
        CourseProgress.video_completed == True
    ).distinct().all()
    completed_course_ids = {str(c[0]) for c in completed_courses}
    
    # Map nodes by ID for prerequisite lookup
    node_map = {n.id: n for n in nodes}
    
    resp = []
    for node in nodes:
        node_data = LearningNodeResponse.from_orm(node)
        
        # 1. Check if course is completed
        is_completed = str(node.course_id) in completed_course_ids
        
        # 2. Check if prerequisites are met
        prereqs_met = True
        for prereq in node.prerequisites:
            # For simplicity, a prereq is met if its course is completed
            prereq_node = node_map.get(prereq.required_node_id)
            if prereq_node and str(prereq_node.course_id) not in completed_course_ids:
                prereqs_met = False
                break
        
        if is_completed:
            node_data.status = "COMPLETED"
        elif prereqs_met:
            node_data.status = "UNLOCKED"
        else:
            node_data.status = "LOCKED"
            
        resp.append(node_data)
        
    return resp

@router.get("/hud", response_model=UserHUDResponse)
def get_user_hud(current_user: User = Depends(get_current_user)):
    """
    Returns the real-time stats for the Topbar HUD.
    """
    next_level_xp = 100 * (current_user.level ** 1.5)
    current_level_xp = 100 * ((current_user.level - 1) ** 1.5) if current_user.level > 1 else 0
    
    progress = 0
    if next_level_xp > current_level_xp:
        progress = (current_user.total_xp - current_level_xp) / (next_level_xp - current_level_xp)
    
    return UserHUDResponse(
        total_xp=current_user.total_xp,
        level=current_user.level,
        current_streak=current_user.current_streak,
        hearts=current_user.hearts,
        xp_to_next_level=int(next_level_xp),
        progress_percent=min(100, progress * 100)
    )

@router.post("/heart-beat")
def user_heart_beat(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Called periodically or on site load to update streaks and regenerate hearts.
    """
    GamificationService.update_streak(db, current_user)
    GamificationService.regenerate_hearts(db, current_user)
    db.commit()
    return {"status": "synced"}
