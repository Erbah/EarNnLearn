from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.course import LearningTrack, TrackCourse, Course
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

class TrackCourseOut(BaseModel):
    id: str
    course_id: str
    position: int
    course_title: Optional[str] = None
    course_thumbnail: Optional[str] = None
    
    class Config:
        from_attributes = True

class TrackOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    badge_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    courses: Optional[List[TrackCourseOut]] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[TrackOut])
def get_all_tracks(db: Session = Depends(get_db)):
    """Fetch all published learning tracks."""
    tracks = db.query(LearningTrack).filter(LearningTrack.is_published == True).all()
    return tracks

@router.get("/{track_id}", response_model=TrackOut)
def get_track_details(track_id: str, db: Session = Depends(get_db)):
    """Fetch a specific track and its courses in order."""
    track = db.query(LearningTrack).filter(LearningTrack.id == track_id, LearningTrack.is_published == True).first()
    if not track:
        raise HTTPException(status_code=404, detail="Learning track not found")
        
    track_courses = db.query(TrackCourse).filter(TrackCourse.track_id == track_id).order_by(TrackCourse.position.asc()).all()
    
    # Enrich with course details
    enriched_courses = []
    for tc in track_courses:
        course = db.query(Course).filter(Course.id == tc.course_id).first()
        if course:
            enriched_courses.append({
                "id": tc.id,
                "course_id": tc.course_id,
                "position": tc.position,
                "course_title": course.title,
                "course_thumbnail": course.thumbnail_url
            })
            
    # Need to return an object matching the Pydantic schema
    # Pydantic from_attributes works with dictionaries too or objects
    result = TrackOut.from_orm(track)
    # We construct manually to inject courses
    return {
        "id": track.id,
        "title": track.title,
        "description": track.description,
        "badge_name": track.badge_name,
        "is_published": track.is_published,
        "created_at": track.created_at,
        "courses": enriched_courses
    }
