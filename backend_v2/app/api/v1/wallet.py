from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.models.admin import SystemSetting
from app.models.transaction import Transaction
from app.services.paystack_service import paystack_service
from pydantic import BaseModel
from datetime import datetime

class WalletResponse(BaseModel):
    balance: Decimal
    withdrawable_balance: Decimal
    locked_balance: Decimal
    currency: str
    
    class Config:
        from_attributes = True

class WithdrawalRequestCreate(BaseModel):
    amount: Decimal
    payout_method: str
    payout_details: dict

class WithdrawalRequestOut(BaseModel):
    id: str
    amount: Decimal
    status: str
    payout_method: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DepositRequest(BaseModel):
    amount: Decimal

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

@router.get("/transactions")
def get_wallet_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), limit: int = 50):
    if not current_user.rid:
        return []
    
    transactions = db.query(WalletTransaction).filter(
        WalletTransaction.user_rid == current_user.rid
    ).order_by(WalletTransaction.created_at.desc()).limit(limit).all()
    
    return transactions

@router.post("/withdraw", response_model=WithdrawalRequestOut)
def request_withdrawal(body: WithdrawalRequestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        raise HTTPException(status_code=400, detail="User not activated")
        
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    if not wallet or wallet.withdrawable_balance < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient withdrawable balance")
        
    # Check minimum withdrawal (default 50 GHS)
    from app.models.admin import SystemSetting
    min_withdrawal_setting = db.query(SystemSetting).filter(SystemSetting.key == "min_withdrawal").first()
    min_val = Decimal(min_withdrawal_setting.value) if min_withdrawal_setting else Decimal("50.00")
    
    if body.amount < min_val:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {min_val} GHS")

    # Check withdrawal fee (default 2.00 GHS)
    fee_setting = db.query(SystemSetting).filter(SystemSetting.key == "withdrawal_fee").first()
    fee = Decimal(fee_setting.value) if fee_setting else Decimal("2.00")
    
    total_deduction = body.amount + fee
    
    if wallet.withdrawable_balance < total_deduction:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Withdrawal {body.amount} + Fee {fee} = {total_deduction} GHS required.")

    # Deduct from withdrawable balance immediately (lock the funds)
    wallet.withdrawable_balance -= total_deduction
    wallet.balance -= total_deduction # Total balance also drops as it's "spoken for"
    
    req = WithdrawalRequest(
        user_rid=current_user.rid,
        amount=body.amount,
        payout_method=body.payout_method,
        payout_details=body.payout_details,
        status="PENDING"
    )
    db.add(req)
    db.add(WalletTransaction(
        user_rid=current_user.rid,
        type="DEBIT_WITHDRAWAL_REQUEST",
        amount=-total_deduction,
        description=f"Withdrawal request for {body.amount} (Fee: {fee}) via {body.payout_method}"
    ))
    db.commit()
    db.refresh(req)
    return req

@router.get("/withdrawals/my", response_model=list[WithdrawalRequestOut])
def get_my_withdrawals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        return []
    return db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_rid == current_user.rid
    ).order_by(WithdrawalRequest.created_at.desc()).all()

@router.post("/deposit")
def initialize_deposit(body: DepositRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Initialize a wallet deposit via Paystack.
    """
    if not current_user.rid:
        raise HTTPException(status_code=400, detail="User not activated")

    if body.amount < 5:
        raise HTTPException(status_code=400, detail="Minimum deposit is 5 GHS")

    metadata = {
        "user_id": str(current_user.id),
        "user_rid": current_user.rid,
        "type": "WALLET_DEPOSIT"
    }
    
    paystack_res = paystack_service.initialize_transaction(
        email=current_user.email,
        amount=body.amount,
        metadata=metadata
    )

    if not paystack_res.get("status"):
        raise HTTPException(status_code=400, detail="External payment gateway failed to initialize.")

    # Create a pending transaction record
    new_tx = Transaction(
        buyer_rid=current_user.rid,
        amount=body.amount,
        currency="GHS",
        payment_method="PAYSTACK",
        payment_reference=paystack_res["data"]["reference"],
        status="pending",
        description=f"Wallet Deposit of {body.amount} GHS"
    )
    db.add(new_tx)
    db.commit()

    return {
        "authorization_url": paystack_res["data"]["authorization_url"],
        "reference": paystack_res["data"]["reference"]
    }
