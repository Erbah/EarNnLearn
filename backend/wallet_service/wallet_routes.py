from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.wallet import Wallet, WalletTransaction
from pydantic import BaseModel

from common.schemas.wallet_schema import WalletResponse, WalletTransactionResponse

router = APIRouter()

@router.get("/", response_model=WalletResponse)
def get_user_wallet(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        raise HTTPException(status_code=400, detail="User not activated. No wallet exists.")
        
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    
    if not wallet:
        # Create empty wallet lazily if missing
        wallet = Wallet(user_rid=current_user.rid)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        
    return wallet

@router.get("/transactions", response_model=list[WalletTransactionResponse])
def get_wallet_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), limit: int = 50):
    if not current_user.rid:
        return []
    
    transactions = db.query(WalletTransaction).filter(
        WalletTransaction.user_rid == current_user.rid
    ).order_by(WalletTransaction.created_at.desc()).limit(limit).all()
    
    return transactions
