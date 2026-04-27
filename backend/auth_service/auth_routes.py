from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from common.database.db_session import get_db
from common.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from common.core.config import settings
from common.models.user import User
from common.models.wallet import Wallet
from common.models.payment_profile import PaymentProfile
from common.schemas.user_schema import UserCreate, UserResponse, Token
import uuid

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    try:
        # 1. Check if user exists
        if db.query(User).filter(User.email == user_in.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

        # 2. Logic for activation_code validation
        parent_rid = None 

        # 3. Create User
        new_user = User(
            name=user_in.name,
            display_name=user_in.display_name or user_in.name,
            email=user_in.email,
            phone=user_in.phone,
            password_hash=get_password_hash(user_in.password),
            parent_rid=parent_rid
        )
        db.add(new_user)
        db.flush() # Get the user.id
        
        # 4. Create Payment Profile
        if user_in.account_number:
            profile = PaymentProfile(
                user_id=new_user.id,
                payment_method=user_in.payment_method,
                provider=user_in.payment_provider,
                account_number=user_in.account_number,
                account_name=user_in.account_name or new_user.name
            )
            db.add(profile)

        # 5. Create Wallet
        db.add(Wallet(user_id=new_user.id))

        db.commit()
        db.refresh(new_user)
        
        return new_user
    except Exception as e:
        print(f"REGISTRATION ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # We use user.rid for the sub if activated, otherwise email for pre-activation login
    sub_claim = user.rid if user.rid else user.email
    
    access_token = create_access_token(
        data={"sub": sub_claim}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
