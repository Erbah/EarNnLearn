from passlib.context import CryptContext
import jwt
import os
import logging
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.session import get_db

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# --- Bootstrap Safety Interlocks ---
ADMIN_SECRET = os.getenv("ADMIN_MASTER_PASSWORD", "erbah1983")
if ADMIN_SECRET == "erbah1983":
    logger.warning("⚠️ SECURITY WARNING: Using default ADMIN_MASTER_PASSWORD ('erbah1983'). Please set a secure environment variable.")

import bcrypt

def verify_password(plain_password, hashed_password):
    print(f"DEBUG: verify_password called with hash {hashed_password[:10]}...")
    try:
        if hashed_password.startswith("$2"):
            print("DEBUG: entering bcrypt.checkpw")
            res = bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
            print("DEBUG: checkpw returned", res)
            return res
        print("DEBUG: entering pwd_context.verify")
        res = pwd_context.verify(plain_password, hashed_password)
        print("DEBUG: pwd_context returned", res)
        return res
    except Exception as e:
        print("DEBUG: Exception in verify_password:", e)
        return False

def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Ensure sub and role are present
    if "sub" not in to_encode:
        to_encode["sub"] = "anonymous"
    if "role" not in to_encode:
        to_encode["role"] = "user"
        
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

class SystemAdmin:
    def __init__(self):
        self.id = 0
        self.email = "superadmin@system"
        self.username = "superadmin"
        self.role = "admin"
        self.display_name = "System Admin"
        self.is_active = True

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
            
        if sub == "superadmin":
            return SystemAdmin()
            
    except jwt.PyJWTError:
        raise credentials_exception
        
    from app.models import User
    user = db.query(User).filter(User.email == sub).first()
    if user is None:
        raise credentials_exception
    return user
