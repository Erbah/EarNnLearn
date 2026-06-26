from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import InstructorProfile, User
from app.models.course import Course
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

router = APIRouter()

class InstructorOut(BaseModel):
    user_rid: str
    name: str
    title: Optional[str] = None
    bio: Optional[str] = None
    credentials: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class CourseSimpleOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    price: float
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

@router.get("/{instructor_rid}", response_model=InstructorOut)
def get_instructor_profile(instructor_rid: str, db: Session = Depends(get_db)):
    """Fetch an instructor's public profile."""
    user = db.query(User).filter(User.rid == instructor_rid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Instructor not found")
        
    profile = db.query(InstructorProfile).filter(InstructorProfile.user_rid == instructor_rid).first()
    
    return {
        "user_rid": user.rid,
        "name": user.name,
        "title": profile.title if profile else None,
        "bio": profile.bio if profile else None,
        "credentials": profile.credentials if profile else None,
        "avatar_url": profile.avatar_url if profile else None
    }

@router.get("/{instructor_rid}/courses", response_model=List[CourseSimpleOut])
def get_instructor_courses(instructor_rid: str, db: Session = Depends(get_db)):
    """Fetch all published courses authored by this instructor."""
    courses = db.query(Course).filter(
        Course.creator_rid == instructor_rid,
        Course.is_published == True
    ).order_by(Course.created_at.desc()).all()
    
    return courses
