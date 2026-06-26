"""
CediTrees 2.0 — Admin API Router
==================================
Full control center for the platform:
- System settings CRUD
- Code generation
- User management
- Tier configuration
- Season control
- Analytics overview
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from pydantic import BaseModel
from typing import Annotated
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import get_current_user, create_access_token, verify_password, get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.models.code import Code
from app.models.transaction import Transaction, ReferralIndex
from app.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season, CodeGenerationSession
from app.models.course import Course
from app.models.notification import Notification
from app.services.code_engine import generate_admin_rid
from app.services.ai_engine import ai_tutor_engine
from app.core.permissions import require_super_admin, require_education_admin, ROLE_SUPER_ADMIN, ROLE_EDUCATION_ADMIN

from app.schemas.admin_schema import *

router = APIRouter()


# ─── Elevation / Auth Logic ───
class AdminLoginRequest(BaseModel):
    admin_password: str

class CredentialUpdateRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/login")
def login_admin(body: AdminLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Log in strictly as a Super Admin bypass using the master password."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        # Default fallback using environment variable
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.admin_password != initial_password:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
        # Initialize the setting if missing
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(initial_password), description="Admin Dashboard Login"))
        db.commit()
    
    # Find the actual super admin user to issue a real token
    admin_user = db.query(User).filter(User.role == ROLE_SUPER_ADMIN).first()
    if not admin_user:
        raise HTTPException(status_code=500, detail="No Super Admin user found in database")

    new_token = create_access_token(
        data={"sub": admin_user.rid, "tier_type": "admin", "role": admin_user.role, "status": admin_user.status, "user_id": str(admin_user.id)}
    )
    
    # Set secure cookie
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=True
    )
    
    return {"status": "authenticated", "tier_type": "admin", "token": new_token}

@router.put("/credentials")
def update_admin_credentials(
    body: CredentialUpdateRequest, 
    current_user: Annotated[User, Depends(require_super_admin)], 
    db: Session = Depends(get_db)
):
    """Update the root admin master password."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.current_password, setting.value):
            raise HTTPException(status_code=403, detail="Current password incorrect")
        setting.value = get_password_hash(body.new_password)
    else:
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.current_password != initial_password:
            raise HTTPException(status_code=403, detail="Current password incorrect")
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(body.new_password), description="Admin Dashboard Login"))
        
    db.commit()
    return {"status": "success", "detail": "Admin credentials updated"}

class ElevateRequest(BaseModel):
    admin_password: str

@router.post("/elevate")
def elevate_to_admin(body: ElevateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elevate the current user to SUPER_ADMIN if the correct master password is provided."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(body.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        # Default fallback using environment variable
        initial_password = settings.INITIAL_ADMIN_PASSWORD
        if not initial_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials are not initialized. Please set INITIAL_ADMIN_PASSWORD in environment."
            )
        if body.admin_password != initial_password:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
        # Initialize the setting if missing
        db.add(SystemSetting(key="ADMIN_PASSWORD", value=get_password_hash(initial_password), description="Admin Dashboard Login"))
        db.commit()
    
    current_user.role = ROLE_SUPER_ADMIN
    db.commit()
    
    # Issue a fresh token so next requests pass the role check correctly if needed
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    sub_claim = current_user.rid if current_user.rid else current_user.email
    new_token = create_access_token(
        data={"sub": sub_claim, "role": ROLE_SUPER_ADMIN}, expires_delta=access_token_expires
    )
    
    return {"status": "elevated", "role": ROLE_SUPER_ADMIN, "token": new_token}


