from fastapi import HTTPException, status, Depends
from typing import Annotated
from app.core.security import get_current_user
from app.models.user import User
from app.models.admin import AdminLog
from app.core.database import get_db
from sqlalchemy.orm import Session

# Role Constants
ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_EDUCATION_ADMIN = "EDUCATION_ADMIN"
ROLE_USER = "USER"

def require_super_admin(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)):
    """Guard that strictly requires SUPER_ADMIN role."""
    if user.role != ROLE_SUPER_ADMIN:
        # Log the denial
        db.add(AdminLog(
            admin_rid=user.rid, 
            action="SECURITY_DENIAL", 
            details={"required": ROLE_SUPER_ADMIN, "actual": user.role, "email": user.email}
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required"
        )
    return user

def require_education_admin(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)):
    """Guard that requires either EDUCATION_ADMIN or SUPER_ADMIN role."""
    if user.role not in [ROLE_SUPER_ADMIN, ROLE_EDUCATION_ADMIN]:
        # Log the denial
        db.add(AdminLog(
            admin_rid=user.rid, 
            action="SECURITY_DENIAL", 
            details={"required": ROLE_EDUCATION_ADMIN, "actual": user.role, "email": user.email}
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Education Admin access required"
        )
    return user
