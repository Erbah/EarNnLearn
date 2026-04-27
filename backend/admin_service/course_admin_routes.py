from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from pydantic import BaseModel

from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.course import Course
from common.models.admin import AdminLog

router = APIRouter()

# --- Helper: Course-Admin-Only Guard ---
def require_course_admin(user: User):
    if user.tier_type not in ["admin", "course_admin", "staff"]:
        raise HTTPException(status_code=403, detail="Course Admin access required")

# --- SCHEMAS ---
class ReviewAction(BaseModel):
    action: str # APPROVE, REJECT, CHANGES_REQUESTED
    notes: str | None = None

@router.get("/submissions")
def list_submitted_courses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    List all courses pending review.
    """
    require_course_admin(current_user)
    return db.query(Course).filter(Course.status == "PENDING").order_by(desc(Course.created_at)).all()

@router.post("/review/{course_id}")
def review_course(course_id: str, body: ReviewAction, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Approve or Reject a course submission.
    """
    require_course_admin(current_user)
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if body.action == "APPROVE":
        course.status = "APPROVED"
        course.approved_by = current_user.id
        course.approved_at = datetime.utcnow()
        log_msg = f"Approved course: {course.title}"
    elif body.action == "REJECT":
        course.status = "REJECTED"
        log_msg = f"Rejected course: {course.title} (Reason: {body.notes})"
    elif body.action == "CHANGES_REQUESTED":
        course.status = "CHANGES_REQUESTED"
        log_msg = f"Requested changes for: {course.title}"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.add(AdminLog(admin_rid=current_user.rid, action=log_msg, details={"notes": body.notes}))
    db.commit()
    return {"status": course.status, "course_id": course_id}
