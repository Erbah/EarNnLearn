import uuid
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from app.core.database import get_db, SessionLocal
from app.core.rate_limit import login_rate_limiter, register_rate_limiter
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user, generate_refresh_token, hash_refresh_token
from app.core.config import settings
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.wallet import Wallet
from app.models.code import Code
from app.models.transaction import Transaction
from app.models.analytics import OnboardingMetric
from app.schemas.user_schema import UserCreate, UserResponse, Token, RegistrationResponse, LoginRequest
from app.services.activation_service import run_activation_engine
from app.services.paystack_service import paystack_service

router = APIRouter()
logger = logging.getLogger(__name__)

def simulate_payment_webhook(tx_id: str, code_id: str, user_id: str):
    """Background task to simulate a successful payment after 5 seconds."""
    import time
    time.sleep(5)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        code = db.query(Code).filter(Code.id == uuid.UUID(code_id)).first()
        tx = db.query(Transaction).filter(Transaction.id == uuid.UUID(tx_id)).first()
        if user and code and tx and tx.status == "pending":
            run_activation_engine(db, user, code, tx)
    except Exception as e:
        print(f"Auto-activation failed: {e}")
    finally:
        db.close()

@router.post("/register", response_model=RegistrationResponse, dependencies=[Depends(register_rate_limiter)])
def register_user(request: Request, response: Response, user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.utils.phone import normalize_phone
    normalized_phone = normalize_phone(user_in.phone) if user_in.phone else None
    
    if normalized_phone:
        existing_phone = db.query(User).filter(
            (User.phone == normalized_phone) | (User.phone == user_in.phone)
        ).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone number already registered")

    if user_in.email:
        from email_validator import validate_email, EmailNotValidError
        try:
            # check_deliverability=True performs DNS lookups to ensure the domain has valid MX records.
            valid_email = validate_email(user_in.email, check_deliverability=True)
            user_in.email = valid_email.normalized
        except EmailNotValidError as e:
            raise HTTPException(status_code=400, detail=f"Invalid or inactive email: {str(e)}")
            
        if db.query(User).filter(User.email == user_in.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Validate activation code
    code = db.query(Code).filter(
        (Code.generated_rid == user_in.activation_code) | 
        (Code.product_code == user_in.activation_code)
    ).first()
    
    if not code:
        raise HTTPException(status_code=404, detail="Activation code not found")
    
    if code.used:
        raise HTTPException(status_code=400, detail="Activation code already used")

    # 3. Handle Paystack/MOMO Identifiers
    paystack_id = user_in.payment_number if user_in.payment_method == "paystack" else None
    momo_number = user_in.payment_number if user_in.payment_method == "mobile_money" else None
    momo_provider = user_in.payment_provider if user_in.payment_method == "mobile_money" else None

    # 4. Create Inactive User
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        phone=normalized_phone,
        password_hash=get_password_hash(user_in.password),
        parent_rid=code.owner_rid,
        tier_type="public", # Default for new users
        status="pending", # Pending activation
        preferred_payment_method=user_in.payment_method,
        paystack_id=paystack_id,
        momo_number=momo_number,
        momo_provider=momo_provider,
        momo_name=user_in.name, # Use legal name as default momo name
        # Payout Details
        payout_method=user_in.payout_method,
        payout_number=user_in.payout_number,
        payout_provider=user_in.payout_provider,
        payout_name=user_in.payout_name or user_in.name
    )
    db.add(new_user)
    db.flush() # Get the ID without committing yet

    # 4b. Initialize Onboarding Metrics
    new_metric = OnboardingMetric(
        user_rid=str(new_user.id), # Using ID as placeholder until RID is generated via activation
        step_reached=1,
        action_taken="registered",
        device_type="desktop", # Default for now
    )
    db.add(new_metric)

    # 5. Create Pending Transaction for Payment Tracking
    from app.models.admin import SystemSetting
    activation_price_val = SystemSetting.get_val(db, "activation_price", 20.0)
    try:
        activation_price = float(activation_price_val)
    except (TypeError, ValueError):
        activation_price = 20.0

    is_rid = code.generated_rid is not None
    effective_code_price = activation_price if is_rid else max(float(code.price), activation_price)
    tx_amount = max(float(user_in.purchase_amount or effective_code_price), effective_code_price)

    new_tx = Transaction(
        code_id=code.id,
        buyer_rid=f"PENDING_ACT_{new_user.id}",
        seller_rid=code.owner_rid,
        amount=tx_amount,
        currency=user_in.preferred_currency or code.currency,
        payment_method=user_in.payment_method,
        payment_reference=f"REG-{uuid.uuid4().hex[:8].upper()}",
        status="pending"
    )
    db.add(new_tx)
    
    # 6. Final Commit (Atomic)
    db.commit()
    db.refresh(new_user)
    db.refresh(new_tx)

    # 7. Generate Token for Activation Polling
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    sub_identifier = new_user.email or new_user.phone
    access_token = create_access_token(
        data={"sub": sub_identifier, "role": new_user.role, "status": new_user.status, "user_id": str(new_user.id)}, expires_delta=access_token_expires
    )
    
    refresh_token = generate_refresh_token()
    hashed_refresh_token = hash_refresh_token(refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_refresh_token = RefreshToken(
        user_id=new_user.id,
        token=hashed_refresh_token,
        expires_at=expires_at,
        is_used=False
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set secure cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=not settings.TESTING
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=not settings.TESTING
    )

    paystack_url = None

    if user_in.payment_method == "paystack":
        # Initialize a real Paystack transaction for the activation fee
        metadata = {
            "type": "ACTIVATION",
            "user_id": str(new_user.id),
            "code_id": str(code.id),
            "tx_id": str(new_tx.id),
        }
        from decimal import Decimal
        
        dynamic_paystack_email = new_user.email
        if not dynamic_paystack_email and new_user.phone:
            clean_phone = new_user.phone.replace('+', '')
            dynamic_paystack_email = f"u{clean_phone}@users.learnnearn.com"
            
        origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
        # Optional: default to a known URL if missing, but it's usually present in browsers.
        callback_url = f"{origin}/dashboard" if origin else None

        ps_res = paystack_service.initialize_transaction(
            email=dynamic_paystack_email,
            amount=Decimal(str(new_tx.amount)),
            metadata=metadata,
            callback_url=callback_url
        )
        if ps_res.get("status") and ps_res["data"].get("authorization_url"):
            # Update the pending transaction with the real Paystack reference
            new_tx.payment_reference = ps_res["data"]["reference"]
            db.commit()
            paystack_url = ps_res["data"]["authorization_url"]
    else:
        # For mobile_money and other methods: simulate activation after 5 seconds
        background_tasks.add_task(simulate_payment_webhook, str(new_tx.id), str(code.id), str(new_user.id))
    
    return {
        "user": new_user,
        "token": {"access_token": access_token, "token_type": "bearer"},
        "paystack_url": paystack_url
    }

@router.post("/login", response_model=Token, dependencies=[Depends(login_rate_limiter)])
def login_for_access_token(response: Response, login_data: LoginRequest, db: Session = Depends(get_db)):
    from app.utils.phone import normalize_phone
    # Strip whitespace to prevent accidental keyboard trailing spaces on mobile
    identifier = login_data.identifier.strip()
    
    # Try normalizing as a phone number
    is_phone = identifier.replace('+', '').replace(' ', '').replace('-', '').isdigit()
    normalized_phone = normalize_phone(identifier) if is_phone else identifier
    
    # Normalize email casing for case-insensitive logins (both DB field and input)
    from sqlalchemy import func
    user = db.query(User).filter(func.lower(User.email) == identifier.lower()).first()
    
    if not user and is_phone and normalized_phone:
        user = db.query(User).filter(User.phone == normalized_phone).first()
        
    if not user:
        user = db.query(User).filter(User.phone == identifier).first()
    
    # Debug logging that does not leak user PII
    logger.debug("[LOGIN] Auth attempt start", extra={"is_phone": is_phone})
    if user:
        pwd_verified = verify_password(login_data.password, user.password_hash)
        stripped_pwd_verified = False
        if not pwd_verified and login_data.password != login_data.password.strip():
            stripped_pwd_verified = verify_password(login_data.password.strip(), user.password_hash)
            if stripped_pwd_verified:
                pwd_verified = True
        logger.debug("[LOGIN] User record found", extra={"status": user.status, "pwd_verified": pwd_verified})
    else:
        logger.debug("[LOGIN] User record not found")
        pwd_verified = False

    if user:
        if user.locked_until and user.locked_until > datetime.utcnow():
            remaining_seconds = int((user.locked_until - datetime.utcnow()).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked. Try again in {remaining_seconds} seconds.",
            )
            
    if not user or not pwd_verified:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail="Account locked due to too many failed login attempts. Try again in 15 minutes.",
                )
            db.commit()
            
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Reset lock state on successful login
    if (user.failed_login_attempts or 0) > 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # We use user.rid for the sub if activated, otherwise email or phone for pre-activation login
    sub_claim = user.rid if user.rid else (user.email or user.phone)
    
    access_token = create_access_token(
        data={"sub": sub_claim, "role": user.role, "status": user.status, "user_id": str(user.id)}, expires_delta=access_token_expires
    )
    
    refresh_token = generate_refresh_token()
    hashed_refresh_token = hash_refresh_token(refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token=hashed_refresh_token,
        expires_at=expires_at,
        is_used=False
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set secure cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=not settings.TESTING
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=not settings.TESTING
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Extract just the codes as strings
    resp = UserResponse.model_validate(current_user)
    resp_dict = resp.model_dump()
    
    codes = db.query(Code).filter(Code.owner_rid == current_user.rid).all()
    resp_dict["product_codes"] = [c.product_code for c in codes if c.product_code]
    
    from app.models.admin import SystemSetting
    settings_dict = {s.key: s.value for s in db.query(SystemSetting).all()}
    
    if "seller_percentage" in settings_dict: resp_dict["seller_percentage"] = float(settings_dict["seller_percentage"])
    if "activation_price" in settings_dict: resp_dict["activation_price"] = float(settings_dict["activation_price"])
    if "min_withdrawal" in settings_dict: resp_dict["min_withdrawal"] = float(settings_dict["min_withdrawal"])
    if "withdrawal_fee" in settings_dict: resp_dict["withdrawal_fee"] = float(settings_dict["withdrawal_fee"])
    if "default_currency" in settings_dict: resp_dict["default_currency"] = settings_dict["default_currency"]
        
    return resp_dict

@router.post("/retry-activation")
def retry_activation(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Allows a user stuck in 'pending' status to retry their activation.
    If Mobile Money, it forces the simulated activation synchronously.
    If Paystack, it generates a new checkout URL.
    """
    if current_user.status == "active":
        return {"status": "success", "message": "User is already active."}
        
    buyer_rid = f"PENDING_ACT_{current_user.id}"
    
    tx = db.query(Transaction).filter(
        Transaction.buyer_rid == buyer_rid,
        Transaction.status == "pending"
    ).order_by(Transaction.created_at.desc()).first()
    
    if not tx:
        raise HTTPException(status_code=404, detail="No pending activation transaction found.")
        
    code = db.query(Code).filter(Code.id == tx.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Activation code not found.")
        
    if current_user.preferred_payment_method == "paystack":
        # 1. Try to verify the existing transaction first
        if tx.payment_reference:
            verify_res = paystack_service.verify_transaction(tx.payment_reference)
            if verify_res.get("status"):
                payment_status = verify_res.get("data", {}).get("status")
                if payment_status == "success":
                    try:
                        run_activation_engine(db, current_user, code, tx)
                        return {"status": "success", "message": "Activation successful."}
                    except Exception as e:
                        db.rollback()
                        raise HTTPException(status_code=500, detail=f"Activation failed during verification: {str(e)}")
        
        # 2. If no success, initialize a new transaction
        metadata = {
            "type": "ACTIVATION",
            "user_id": str(current_user.id),
            "code_id": str(code.id),
            "tx_id": str(tx.id),
        }
        from decimal import Decimal
        dynamic_paystack_email = current_user.email
        if not dynamic_paystack_email and current_user.phone:
            clean_phone = current_user.phone.replace('+', '')
            dynamic_paystack_email = f"u{clean_phone}@users.learnnearn.com"
            
        # Get origin for callback url if possible
        # Note: request is not in the function signature for retry_activation
        # We can just leave callback_url blank to use Paystack dashboard default
        ps_res = paystack_service.initialize_transaction(
            email=dynamic_paystack_email,
            amount=Decimal(str(tx.amount)),
            metadata=metadata
        )
        if ps_res.get("status") and ps_res["data"].get("authorization_url"):
            tx.payment_reference = ps_res["data"]["reference"]
            db.commit()
            return {"status": "paystack", "paystack_url": ps_res["data"]["authorization_url"]}
        else:
            raise HTTPException(status_code=500, detail="Failed to initialize Paystack checkout.")
    else:
        try:
            run_activation_engine(db, current_user, code, tx)
            # Commit is handled inside run_activation_engine, but we should make sure
            # any updates to user status are visible.
            return {"status": "success", "message": "Activation successful."}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Activation failed: {str(e)}")


@router.get("/token", response_model=Token)
def get_token(current_user: User = Depends(get_current_user)):
    """
    Cookie-to-Token retrieval. Allows authenticated clients (via secure cookie)
    to bootstrap their in-memory token for state-changing requests.
    """
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    sub_claim = current_user.rid if current_user.rid else (current_user.email or current_user.phone)
    access_token = create_access_token(
        data={"sub": sub_claim, "role": current_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
def refresh_token(response: Response, request: Request, db: Session = Depends(get_db)):
    """
    Refreshes the access token using a refresh token HTTP-only cookie.
    Implements Token Rotation & Anomaly Detection.
    """
    refresh_token_cookie = request.cookies.get("refresh_token")
    if not refresh_token_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    hashed_token = hash_refresh_token(refresh_token_cookie)
    db_token = db.query(RefreshToken).filter(RefreshToken.token == hashed_token).first()

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if db_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    user = db_token.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Anomaly Detection: Token Reuse
    if db_token.is_used:
        # Invalidate all user sessions (revoke all refresh tokens for this user)
        logger.warning(
            f"Token reuse anomaly detected! User ID: {user.id}. Invalidating all refresh tokens."
        )
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"is_used": True})
        db.commit()
        
        # Clear cookies
        response.delete_cookie(key="access_token", path="/", httponly=True, samesite="strict", secure=not settings.TESTING)
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="strict", secure=not settings.TESTING)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token reuse anomaly detected. Sessions invalidated.",
        )

    # Mark the current token as used
    db_token.is_used = True
    db.commit()

    # Generate new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    sub_claim = user.rid if user.rid else (user.email or user.phone)
    new_access_token = create_access_token(
        data={"sub": sub_claim, "role": user.role, "status": user.status, "user_id": str(user.id)},
        expires_delta=access_token_expires
    )

    # Generate new refresh token
    new_refresh_token = generate_refresh_token()
    new_hashed_refresh_token = hash_refresh_token(new_refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_new_refresh_token = RefreshToken(
        user_id=user.id,
        token=new_hashed_refresh_token,
        expires_at=expires_at,
        is_used=False,
        parent_token_id=db_token.id
    )
    db.add(db_new_refresh_token)
    db.commit()

    # Set secure cookies
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=not settings.TESTING
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=not settings.TESTING
    )

    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout")
def logout_user(response: Response, request: Request, db: Session = Depends(get_db)):
    """
    Clears the access token cookie from the client browser and blocklists it in Redis.
    Also revokes/invalidates the refresh token in the database.
    """
    # 1. Invalidate Refresh Token in Database
    refresh_token_cookie = request.cookies.get("refresh_token")
    if refresh_token_cookie:
        hashed_token = hash_refresh_token(refresh_token_cookie)
        db_token = db.query(RefreshToken).filter(RefreshToken.token == hashed_token).first()
        if db_token:
            db_token.is_used = True
            db.commit()

    # 2. Blocklist Access Token in Redis
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

    if token:
        try:
            from jose import jwt
            from app.core.redis import redis_client
            
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                now = datetime.utcnow().timestamp()
                time_remaining = int(exp - now)
                if time_remaining > 0:
                    try:
                        redis_client.setex(f"blacklist:token:{jti}", time_remaining, "true")
                    except Exception as e:
                        logger.warning(f"Redis blocklist set failed: {e}")
        except Exception as e:
            logger.debug(f"Failed to decode token during logout: {e}")

    # 3. Delete Cookies
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="strict",
        secure=not settings.TESTING
    )
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="strict",
        secure=not settings.TESTING
    )
    return {"status": "success", "message": "Logged out successfully"}

