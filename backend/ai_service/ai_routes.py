from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from typing import List
from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.services.ai_teacher_engine import ai_teacher_engine
from common.schemas.education_schema import CourseCreate, CourseResponse, TopicResponse, AssignmentResponse, AssignmentSubmit
from common.models.education import AICourse, AITopic, AIAssignment

from common.services.subscription_service import subscription_service

router = APIRouter()

@router.post("/generate-roadmap", response_model=CourseResponse)
def generate_course(body: CourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subscription_service.verify_active_subscription(db, current_user.rid)
    course = ai_teacher_engine.generate_roadmap(db, current_user.rid, body.title, body.skill_level)
    return course

@router.get("/course/{course_id}", response_model=CourseResponse)
def get_ai_course(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(AICourse).filter(AICourse.id == course_id, AICourse.user_rid == current_user.rid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Load topics
    topics = db.query(AITopic).filter(AITopic.course_id == course_id).order_by(AITopic.position).all()
    course.topics = topics
    return course

@router.get("/topic/{topic_id}/assignment", response_model=AssignmentResponse)
def get_topic_assignment(topic_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = db.query(AITopic).filter(AITopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    assignment = db.query(AIAssignment).filter(AIAssignment.id == topic.assignment_id).first()
    if not assignment:
        assignment = ai_teacher_engine.generate_assignment(db, topic_id)
        
    return assignment

from common.services.skill_tree_service import skill_tree_service
from common.schemas.education_schema import SkillNodeResponse, CareerPathCreate, CareerPathResponse
from ai_service.companion_service import companion_service
from ai_service.project_builder_engine import project_builder_engine
from common.schemas.education_schema import CompanionChatRequest, CompanionChatResponse, ProjectSuggestResponse, ProjectReviewRequest, ProjectReviewResponse

@router.get("/skill-tree", response_model=List[SkillNodeResponse])
def get_my_skill_tree(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch the student's personalized skill tree with lock/unlock status.
    """
    return skill_tree_service.get_user_tree(db, current_user.rid, category)

@router.post("/career-path", response_model=CareerPathResponse)
def generate_career_path(body: CareerPathCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Generate a multi-phase learning path for a specific career goal.
    """
    subscription_service.verify_active_subscription(db, current_user.rid)
    return skill_tree_service.generate_career_roadmap(db, current_user.rid, body.goal)

@router.post("/companion/chat", response_model=CompanionChatResponse)
def chat_with_companion(body: CompanionChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    24/7 Context-aware AI tutor chat.
    """
    subscription_service.verify_active_subscription(db, current_user.rid)
    return companion_service.get_chat_response(db, current_user.rid, body.message)

@router.get("/course/{course_id}/project", response_model=ProjectSuggestResponse)
def get_suggested_project(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get an AI-generated real-world project for a specific course.
    """
    subscription_service.verify_active_subscription(db, current_user.rid)
    return project_builder_engine.suggest_project(db, course_id)

@router.post("/project/review", response_model=ProjectReviewResponse)
def submit_project_for_review(body: ProjectReviewRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Submit project code for automated AI review and grading.
    """
    subscription_service.verify_active_subscription(db, current_user.rid)
    return project_builder_engine.review_project(db, current_user.rid, body.project_id, body.code_submission)

from common.services.creator_service import creator_service
from common.services.dashboard_service import dashboard_service
from common.schemas.education_schema import CreatorApplyRequest, CreatorResponse, ExpertCourseCreate, DashboardSummaryResponse

@router.post("/creator/apply", response_model=CreatorResponse)
def apply_to_teach(body: CreatorApplyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Expert applies to become a creator on the platform.
    """
    return creator_service.apply_as_creator(db, current_user.rid, body.expert_bio, body.expertise_tags)

@router.post("/creator/publish", response_model=CourseResponse)
def publish_course(body: ExpertCourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Expert publishes a course with a specialized knowledge base.
    """
    return creator_service.publish_expert_course(db, current_user.rid, body.title, body.knowledge_base)

@router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_my_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch a unified view of the student's learning progress and achievements.
    """
    return dashboard_service.get_student_summary(db, current_user.rid)

from common.services.continuity_service import continuity_service

class RestoreRequest(BaseModel):
    previous_product_code: str

@router.post("/verify-season-access")
def verify_season_access(body: RestoreRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Checks if the user has an active subscription for the current season.
    """
    result = continuity_service.get_user_learning_continuity(db, current_user.rid, "default")
    return result
