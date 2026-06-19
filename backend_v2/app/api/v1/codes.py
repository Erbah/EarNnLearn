from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.code import Code
from app.models.wallet import Wallet, WalletTransaction
from app.models.transaction import Transaction, ReferralIndex
from app.schemas.code_schema import CodeResponse, ActivationRequest, SellerInfoResponse, PaymentSubmission, BuyCodeRequest, BuySponsorRequest, LegacyActivationRequest, SimulationRequest
from app.services.activation_service import run_activation_engine
from decimal import Decimal

router = APIRouter()

@router.get("/seller-payment/{product_code}", response_model=SellerInfoResponse)
def get_seller_payment_info(product_code: str, db: Session = Depends(get_db)):
    """
    Phase A: Returns the owner's payment details so the buyer can send MoMo.
    """
    target_code = db.query(Code).filter(Code.product_code == product_code).first()
    if not target_code:
        raise HTTPException(status_code=404, detail="Product code not found.")
        
    if target_code.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This product code has already been used."
        )
        
    seller = db.query(User).filter(User.rid == target_code.owner_rid).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller details not found.")
        
    return SellerInfoResponse(
        seller_name=seller.momo_name or (seller.name if seller.name else "System Seller"),
        account_number=seller.momo_number or "0000000000",
        provider=seller.momo_provider or "MTN",
        method="MOBILE_MONEY",
        amount=float(target_code.price),
        currency=target_code.currency
    )

@router.post("/submit-payment", status_code=status.HTTP_201_CREATED)
def submit_payment_reference(req: PaymentSubmission, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Phase B: Record the transaction ID/Reference submitted by the buyer.
    The admin will later verify this to trigger Phase C (activation).
    """
    target_code = db.query(Code).filter(Code.product_code == req.product_code).first()
    if not target_code:
        raise HTTPException(status_code=404, detail="Product code not found.")
        
    if target_code.used:
        raise HTTPException(status_code=400, detail="This code has already been used.")

    # Check for duplicate reference
    existing_tx = db.query(Transaction).filter(Transaction.payment_reference == req.payment_reference).first()
    if existing_tx:
        raise HTTPException(status_code=400, detail="This payment reference has already been submitted.")

    new_tx = Transaction(
        code_id=target_code.id,
        buyer_rid="PENDING_ACT_" + str(current_user.id),
        seller_rid=target_code.owner_rid,
        amount=target_code.price,
        currency=target_code.currency,
        payment_method="MOBILE_MONEY",
        payment_reference=req.payment_reference,
        status="pending"
    )
    db.add(new_tx)
    db.commit()
    return {"message": "Payment submitted successfully and under review."}

@router.post("/activate", response_model=CodeResponse)
def activate_product_code(req: ActivationRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    The Activation Engine:
    Initializes the user's RID, ancestry, and first product codes.
    """
    target_code = db.query(Code).filter(Code.product_code == req.product_code).first()
    
    if not target_code:
        raise HTTPException(status_code=404, detail="Product code not found.")
        
    return run_activation_engine(db, current_user, target_code)


@router.get("/my-codes", response_model=list[CodeResponse])
def get_user_codes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        return []
        
    codes = db.query(Code).filter(
        Code.owner_rid == current_user.rid,
        Code.used == False,
        Code.product_code != None
    ).all()
    return codes

@router.post("/buy", response_model=CodeResponse)
def buy_product_code(req: BuyCodeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Purchase a new product code entry for the new season.
    This generates the user's ONE and ONLY resalable code.
    """
    if current_user.status == "pending" and not current_user.rid:
        raise HTTPException(status_code=400, detail="Please complete your initial activation before purchasing from the marketplace.")

    # Check if user already has an active (unused) product code
    existing_code = db.query(Code).filter(
        Code.owner_rid == current_user.rid,
        Code.used == False,
        Code.product_code != None
    ).first()
    
    if existing_code:
        raise HTTPException(status_code=400, detail="You already have an active product code for this season.")

    # Search for available system codes in the pool
    # These act as the 'License' to start the season
    query = db.query(Code).filter(
        Code.used == False,
        Code.product_code != None,
        (Code.owner_rid == "ACNIRP") | (Code.owner_rid == None),
        Code.currency == req.currency,
        Code.price >= req.min_price
    )
    
    import random
    license_codes = query.all()
    
    if not license_codes:
        # Find min available price in that currency
        min_avail = db.query(func.min(Code.price)).filter(
            Code.used == False,
            Code.product_code != None,
            (Code.owner_rid == "ACNIRP") | (Code.owner_rid == None),
            Code.currency == req.currency
        ).scalar()
        
        if min_avail:
            raise HTTPException(status_code=400, detail=f"Minimum available code price is {min_avail} {req.currency}")
        else:
            raise HTTPException(status_code=400, detail=f"No system codes available for currency {req.currency}")

    # Pick one randomly to 'Consume' or 'Register under'
    license_code = random.choice(license_codes)
    
    # ─── PAYMENT VERIFICATION ───
    # 1. Fetch Wallet
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    if not wallet:
        # Provision if missing (though activation service usually does this)
        wallet = Wallet(user_rid=current_user.rid)
        db.add(wallet)
        db.commit()
    
    # 2. Check Balance
    code_price = license_code.price
    if wallet.balance < code_price:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient wallet balance. You need {code_price} {license_code.currency} but have {wallet.balance} {wallet.currency}."
        )
    
    # 3. Deduct Funds
    wallet.balance -= code_price
    wallet.withdrawable_balance -= code_price # Also reduce withdrawable if applicable
    
    db.add(WalletTransaction(
        user_rid=current_user.rid,
        type="DEBIT_CODE_PURCHASE",
        amount=code_price,
        description=f"Purchased Seasonal Activation Code: {license_code.product_code}"
    ))
    
    # We capture old_rid for migration before clearing it
    old_rid = current_user.rid
    
    # We clear user.rid if it's there (Season Reset) or just run activation
    if current_user.rid:
        current_user.rid = None 

    # Activate the user using the license code
    # This will generate their ONE resalable code
    user_code = run_activation_engine(db, current_user, license_code)
    new_rid = current_user.rid
    
    # MIGRATION: Carry over learning progress to the new seasonal RID
    if old_rid and new_rid and old_rid != new_rid:
        from app.models.learning import CoursePayment, VideoProgress
        
        # Update Course Payments
        db.query(CoursePayment).filter(CoursePayment.user_rid == old_rid).update({CoursePayment.user_rid: new_rid})
        
        # Update Video Progress
        db.query(VideoProgress).filter(VideoProgress.user_rid == old_rid).update({VideoProgress.user_rid: new_rid})
        
        db.commit()

    return user_code


@router.post("/buy-sponsor", response_model=CodeResponse)
def buy_sponsor_code(req: BuySponsorRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Purchase a specific sponsor code using wallet balance.
    This replaces the manual MoMo payment flow.
    """
    if current_user.status == "pending" and not current_user.rid:
        raise HTTPException(status_code=400, detail="Please complete your initial activation before purchasing.")

    # Check if user already has an active (unused) product code
    existing_code = db.query(Code).filter(
        Code.owner_rid == current_user.rid,
        Code.used == False,
        Code.product_code != None
    ).first()
    
    if existing_code:
        raise HTTPException(status_code=400, detail="You already have an active product code for this season.")

    # Find the requested sponsor code
    target_code = db.query(Code).filter(Code.product_code == req.product_code).first()
    if not target_code:
        raise HTTPException(status_code=404, detail="Product code not found.")
        
    if target_code.used:
        raise HTTPException(status_code=400, detail="This product code has already been used.")

    # ─── PAYMENT VERIFICATION ───
    # 1. Fetch Wallet
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).first()
    if not wallet:
        wallet = Wallet(user_rid=current_user.rid)
        db.add(wallet)
        db.commit()
    
    # 2. Check Balance
    code_price = target_code.price
    if wallet.balance < code_price:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient wallet balance. You need {code_price} {target_code.currency} but have {wallet.balance} {wallet.currency}."
        )
    
    # 3. Deduct Funds
    wallet.balance -= code_price
    wallet.withdrawable_balance -= code_price
    
    db.add(WalletTransaction(
        user_rid=current_user.rid,
        type="DEBIT_CODE_PURCHASE",
        amount=code_price,
        description=f"Purchased Sponsor Code: {target_code.product_code}"
    ))

    # Log standard Transaction record for profit tracking
    transaction = Transaction(
        code_id=target_code.id,
        buyer_rid=current_user.rid,  # Will be updated to new_rid in activation
        seller_rid=target_code.owner_rid,
        amount=code_price,
        currency=target_code.currency,
        payment_method="WALLET",
        status="success"
    )
    db.add(transaction)
    
    old_rid = current_user.rid
    if current_user.rid:
        current_user.rid = None 

    # Activate the user using the sponsor code
    user_code = run_activation_engine(db, current_user, target_code, transaction=transaction)
    new_rid = current_user.rid
    
    # MIGRATION
    if old_rid and new_rid and old_rid != new_rid:
        from app.models.learning import CoursePayment, VideoProgress
        db.query(CoursePayment).filter(CoursePayment.user_rid == old_rid).update({CoursePayment.user_rid: new_rid})
        db.query(VideoProgress).filter(VideoProgress.user_rid == old_rid).update({VideoProgress.user_rid: new_rid})
        db.commit()

    return user_code


