from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import get_current_user
from app.models import User

router = APIRouter(prefix="/education", tags=["education"])

@router.get("/resume")
def check_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Stub: Return no resume available to prevent 404s on the dashboard
    return {"can_resume": False}
