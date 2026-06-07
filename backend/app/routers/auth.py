from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import User
from app.core.security import verify_password, create_access_token, get_current_user, get_password_hash

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    name: str | None = None
    email: str
    password: str
    phone: str | None = None
    activation_code: str | None = None
    code_type: str | None = "rid"
    purchase_amount: float | None = 0.0
    preferred_currency: str = "GHS"
    # Payment (Pay-in)
    payment_method: str | None = None
    payment_number: str | None = None
    payment_provider: str | None = None
    # Payout (Earnings)
    payout_method: str | None = None
    payout_number: str | None = None
    payout_provider: str | None = None
    payout_name: str | None = None

@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Simple check if exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # 2. Basic user creation (Password hashing should be added in production)
    user = User(
        display_name=request.name or request.email.split("@")[0],
        email=request.email,
        password_hash=get_password_hash(request.password),
        role="user",
        preferred_currency=request.preferred_currency,
        # Payment Layer
        payment_method=request.payment_method,
        payment_provider=request.payment_provider,
        payment_identifier=request.payment_number,
        payout_method=request.payout_method,
        payout_provider=request.payout_provider,
        payout_identifier=request.payout_number,
        payout_name=request.payout_name,
        paystack_customer_id=None # Placeholder for live integration
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"status": "success", "message": "User created", "user_id": user.id}

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    # Basic check (should be hashed in prod)
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}

@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    # Safely handle if fields don't exist in older DB rows
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "onboarding_completed": getattr(user, "onboarding_completed", False),
        "last_onboarding_step": getattr(user, "last_onboarding_step", 0),
        "learning_goal": getattr(user, "learning_goal", None),
        "preferred_style": getattr(user, "preferred_style", None),
        "wallet_balance": 0.0 # Placeholder or fetch from wallet relationship
    }
