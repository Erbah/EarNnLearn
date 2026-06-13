from datetime import datetime, timedelta
import bcrypt
from jose import jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

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
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = None
) -> User:
    token_source = "header"
    
    # 1. Try to get token from header via oauth2_scheme
    # Note: oauth2_scheme (OAuth2PasswordBearer) is a callable that looks at the Authorization header
    try:
        from fastapi.security.utils import get_authorization_scheme_param
        authorization = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if scheme.lower() == "bearer":
            token = param
    except Exception:
        pass

    # 2. If no header token, try to get from cookie
    if not token:
        token = request.cookies.get("access_token")
        token_source = "cookie"

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

    # CSRF protection: Reject cookie-based authentication for state-changing HTTP methods
    if token_source == "cookie" and request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="State-changing requests must be authenticated via the Authorization header to prevent CSRF."
        )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    # sub can be either email (pre-activation) or rid (post-activation)
    user = db.query(User).filter(
        (User.rid == sub) | (User.email == sub)
    ).first()
    if user is None:
        raise credentials_exception

    # Enforce active check for all routes except auth/me and auth/logout
    if user.status != "active" and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        allowed_suffixes = ["/auth/me", "/auth/logout"]
        if not any(request.url.path.endswith(s) for s in allowed_suffixes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account activation pending. Please complete transaction."
            )

    return user
