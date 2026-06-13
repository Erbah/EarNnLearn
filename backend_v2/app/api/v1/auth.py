import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from app.core.database import get_db, SessionLocal
from app.core.rate_limit import login_rate_limiter, register_rate_limiter
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet
from app.models.code import Code
from app.models.transaction import Transaction
from app.models.analytics import OnboardingMetric
from app.schemas.user_schema import UserCreate, UserResponse, Token, RegistrationResponse, LoginRequest
from app.services.activation_service import run_activation_engine
from app.services.paystack_service import paystack_service

router = APIRouter()

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
def register_user(response: Response, user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.utils.phone import normalize_phone
    normalized_phone = normalize_phone(user_in.phone) if user_in.phone else None

    # 1. Check if user exists
    if normalized_phone and db.query(User).filter(User.phone == normalized_phone).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    if user_in.email and db.query(User).filter(User.email == user_in.email).first():
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
    new_tx = Transaction(
        code_id=code.id,
        buyer_rid=f"PENDING_ACT_{new_user.id}",
        seller_rid=code.owner_rid,
        amount=user_in.purchase_amount or float(code.price),
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
        data={"sub": sub_identifier, "role": new_user.role}, expires_delta=access_token_expires
    )
    
    # Set secure cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=True
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
            
        ps_res = paystack_service.initialize_transaction(
            email=dynamic_paystack_email,
            amount=Decimal(str(new_tx.amount)),
            metadata=metadata
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
    identifier = login_data.identifier
    
    # Try normalizing as a phone number
    normalized_phone = normalize_phone(identifier) if identifier.replace('+', '').isdigit() else identifier
    
    user = db.query(User).filter(
        (User.email == identifier) | 
        (User.phone == normalized_phone) | 
        (User.phone == identifier)
    ).first()
    
    if user:
        if user.locked_until and user.locked_until > datetime.utcnow():
            remaining_seconds = int((user.locked_until - datetime.utcnow()).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked. Try again in {remaining_seconds} seconds.",
            )
            
    if not user or not verify_password(login_data.password, user.password_hash):
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
        data={"sub": sub_claim, "role": user.role}, expires_delta=access_token_expires
    )
    
    # Set secure cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",
        secure=True
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Extract just the codes as strings
    resp = UserResponse.from_orm(current_user)
    # Direct query to avoid relationship issues
    codes = db.query(Code).filter(Code.owner_rid == current_user.rid).all()
    resp.product_codes = [c.product_code for c in codes if c.product_code]
    return resp
