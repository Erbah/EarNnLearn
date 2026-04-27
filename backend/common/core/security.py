from datetime import datetime, timedelta
import logging
import bcrypt
from jose import jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from common.core.config import settings
from common.database.db_session import get_db
from common.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
            
        if sub == "superadmin" and payload.get("tier_type") == "admin":
            return User(email="superadmin", tier_type="admin", rid="A", name="Super Admin")
            
    except jwt.JWTError:
        raise credentials_exception
    
    # sub can be either email (pre-activation) or rid (post-activation)
    logging.info(f"get_current_user for sub='{sub}'")
    user = db.query(User).filter(
        (User.rid == sub) | (User.email == sub)
    ).first()
    if user is None:
        logging.warning(f"User not found for sub='{sub}'")
        raise credentials_exception
    logging.info(f"User found: {user.email}, RID={user.rid}")
    return user
