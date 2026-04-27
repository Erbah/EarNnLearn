from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class CourseCreate(BaseModel):
    title: str
    skill_level: str = "Beginner"

class TopicResponse(BaseModel):
    id: str
    title: str
    explanation: str
    resources: List[Dict[str, str]]
    is_completed: bool
    position: int
    assignment_id: Optional[str] = None

    class Config:
        from_attributes = True

class CourseResponse(BaseModel):
    id: str
    title: str
    skill_level: str
    teacher_type: str
    roadmap_data: List[Dict[str, Any]]
    is_completed: bool
    final_grade: Optional[float] = None
    certificate_id: Optional[str] = None
    created_at: datetime
    topics: List[TopicResponse] = []

    class Config:
        from_attributes = True

class AssignmentResponse(BaseModel):
    id: str
    topic_id: str
    questions: List[Dict[str, str]]
    user_answers: Optional[Dict[str, str]] = None
    ai_feedback: Optional[str] = None
    score: Optional[float] = None

    class Config:
        from_attributes = True

class AssignmentSubmit(BaseModel):
    answers: Dict[str, str]

class SkillNodeResponse(BaseModel):
    id: str
    title: str
    category: str
    status: str
    ui_metadata: Optional[Dict[str, Any]] = None

class CareerPathCreate(BaseModel):
    goal: str

class CareerPathResponse(BaseModel):
    id: str
    title: str
    course_sequence: List[str]
    progress_percentage: int
    created_at: datetime

    class Config:
        from_attributes = True

class CompanionChatRequest(BaseModel):
    message: str

class CompanionChatResponse(BaseModel):
    answer: str
    session_id: str
    context: str

class ProjectSuggestResponse(BaseModel):
    project_title: str
    project_description: str
    project_id: str

class ProjectReviewRequest(BaseModel):
    project_id: str
    code_submission: str

class ProjectReviewResponse(BaseModel):
    project_id: str
    score: float
    ai_review: str
    status: str

class CreatorApplyRequest(BaseModel):
    expert_bio: str
    expertise_tags: List[str]

class CreatorResponse(BaseModel):
    user_rid: str
    is_verified: bool
    revenue_share: float

class ExpertCourseCreate(BaseModel):
    title: str
    knowledge_base: str

class DashboardSummaryResponse(BaseModel):
    active_courses_count: int
    completed_courses_count: int
    certificates_count: int
    mastered_skills_count: int
    active_career_paths_count: int
    recent_certificates: List[Dict[str, Any]]
