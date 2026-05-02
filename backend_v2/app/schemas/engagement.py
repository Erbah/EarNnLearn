from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

class QuizOptionBase(BaseModel):
    option_text: str
    is_correct: bool = False

class QuizOptionCreate(QuizOptionBase):
    pass

class QuizOptionOut(QuizOptionBase):
    id: str
    model_config = ConfigDict(from_attributes=True)

class QuizQuestionBase(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    points: int = 1
    position: int = 0

class QuizQuestionCreate(QuizQuestionBase):
    options: List[QuizOptionCreate]

class QuizQuestionOut(QuizQuestionBase):
    id: str
    options: List[QuizOptionOut]
    model_config = ConfigDict(from_attributes=True)

class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    passing_score: int = 70

class QuizCreate(QuizBase):
    course_id: str
    module_id: Optional[str] = None

class QuizOut(QuizBase):
    id: str
    course_id: str
    module_id: Optional[str] = None
    created_at: datetime
    questions: List[QuizQuestionOut] = []
    model_config = ConfigDict(from_attributes=True)

class QuizAttemptCreate(BaseModel):
    answers: List[dict] # List of {question_id: str, option_id: str}

class QuizAttemptOut(BaseModel):
    id: str
    quiz_id: str
    score: int
    total_points: int
    passed: bool
    attempted_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DiscussionReplyBase(BaseModel):
    content: str

class DiscussionReplyCreate(DiscussionReplyBase):
    pass

class DiscussionReplyOut(DiscussionReplyBase):
    id: str
    user_rid: str
    is_instructor_reply: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DiscussionBase(BaseModel):
    title: str
    content: str

class DiscussionCreate(DiscussionBase):
    course_id: str
    video_id: Optional[str] = None

class DiscussionOut(DiscussionBase):
    id: str
    course_id: str
    video_id: Optional[str] = None
    user_rid: str
    created_at: datetime
    updated_at: datetime
    replies: List[DiscussionReplyOut] = []
    model_config = ConfigDict(from_attributes=True)
