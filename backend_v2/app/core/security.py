from datetime import datetime, timedelta
import bcrypt
from jose import jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.core.redis import redis_client
import uuid

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
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now, "jti": str(uuid.uuid4())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def generate_refresh_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)

def hash_refresh_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

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
        
        jti: str = payload.get("jti")
        if jti:
            try:
                if redis_client.get(f"blacklist:token:{jti}"):
                    raise credentials_exception
            except Exception as e:
                # Fail open if Redis is down temporarily, but log it
                import logging
                logging.getLogger(__name__).warning(f"Redis blocklist check failed: {e}")

        sub: str = payload.get("sub")
        role: str = payload.get("role", "USER")
        status_val: str = payload.get("status", "pending")
        user_id_str: str = payload.get("user_id")
        
        if sub is None:
            raise credentials_exception
            
        import uuid
        user_id = uuid.UUID(user_id_str) if user_id_str else None
        
        # Query database for fresh user state (resolves stale stateless token status issue)
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = db.query(User).filter(
                (User.email == sub) | (User.phone == sub) | (User.rid == sub)
            ).first()
            
        if not user:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception

    # Enforce active check for all routes except auth/me and auth/logout
    if user.status != "active" and user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        allowed_paths = [
            "/auth/me", 
            "/auth/logout", 
            "/auth/retry-activation",
            "/codes/seller-payment",
            "/codes/submit-payment",
            "/codes/activate",
            "/wallet/"
        ]
        is_allowed = False
        for p in allowed_paths:
            if p in request.url.path:
                is_allowed = True
                break
                
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account activation pending. Please complete transaction."
            )

    return user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> User | None:
    token = None
    try:
        from fastapi.security.utils import get_authorization_scheme_param
        authorization = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if scheme.lower() == "bearer":
            token = param
    except Exception:
        pass

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        
        jti: str = payload.get("jti")
        if jti:
            try:
                if redis_client.get(f"blacklist:token:{jti}"):
                    return None
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Redis blocklist check failed: {e}")

        sub: str = payload.get("sub")
        if sub is None:
            return None
            
        role: str = payload.get("role", "USER")
        status_val: str = payload.get("status", "pending")
        user_id_str: str = payload.get("user_id")
        
        import uuid
        user_id = uuid.UUID(user_id_str) if user_id_str else None
        
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = db.query(User).filter(
                (User.email == sub) | (User.phone == sub) | (User.rid == sub)
            ).first()
            
        return user
    except Exception:
        return None
