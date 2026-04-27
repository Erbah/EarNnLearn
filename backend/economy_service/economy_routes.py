from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from decimal import Decimal
from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.code import ActivationRID, ProductCode
from common.models.payment_profile import PaymentProfile
from common.models.code_audit import CodeActivationLog
from common.models.wallet import Wallet, WalletTransaction
from common.models.transaction import Transaction, ReferralIndex
from common.models.subscription import SeasonActivation
from common.models.viral import ViralMomentum
from common.schemas.code_schema import CodeResponse, ActivationRequest, PaymentProfileCreate, PaymentProfileResponse, PaymentSubmissionRequest
from common.services.code_engine import generate_rid, generate_product_code, verify_product_code
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/verify/{code}")
def verify_code(code: str, db: Session = Depends(get_db)):
    """
    Publicly verifiable endpoint for checking code validity.
    Distinguishes between one-time RIDs (Entry) and permanent Product Codes (Referral).
    """
    # 1. Check ActivationRID (The Entry Ticket)
    target_rid = db.query(ActivationRID).filter(ActivationRID.rid_code == code).first()
    if target_rid:
        if target_rid.status == "USED":
            return {"valid": False, "status": "already_used", "type": "RID"}
        if target_rid.status == "EXPIRED":
            return {"valid": False, "status": "expired", "type": "RID"}
        return {
            "valid": True, 
            "status": "available", 
            "type": "RID",
            "tier": target_rid.tier,
            "season_id": target_rid.season_id
        }

    # 2. Check ProductCode (The Sales Code / Referred By)
    target_pc = db.query(ProductCode).filter(ProductCode.code == code).first()
    if target_pc:
        if target_pc.status != "ACTIVE":
            return {"valid": False, "status": "disabled", "type": "PC"}
        return {
            "valid": True, 
            "status": "available", 
            "type": "PC",
            "owner_id": str(target_pc.owner_id),
            "total_sales": int(target_pc.total_sales)
        }
        
    return {"valid": False, "status": "not_found"}

@router.post("/activate")
def activate_product_code(req: ActivationRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    The 10M-Scale Registration & Activation Engine.
    1. Validate One-Time Activation RID.
    2. Attribute to Permanent Product Code Sponsor.
    3. Generate User's Permanent Product Code.
    4. Record Scalable Transaction.
    """
    # 1. VALIDATE ENTRY RID
    target_rid = db.query(ActivationRID).filter(ActivationRID.rid_code == req.product_code).first()
    
    if not target_rid:
        raise HTTPException(status_code=404, detail="Activation RID not found.")
        
    if target_rid.status == "USED":
        raise HTTPException(status_code=400, detail="This RID has already been used.")

    # 2. IDENTIFY SPONSOR (If any provided by the frontend as referred_by)
    # Note: In a real flow, referred_by is often pre-fetched or passed in req.
    # For now, we assume current_user.referred_by might already be set or we handle it from req.
    
    # 3. INITIAL ACTIVATION LOGIC
    if not current_user.product_code:
        # Generate User's permanent Sales Code
        user_pc = generate_product_code()
        current_user.product_code = user_pc
        
        # Save to ProductCodes table for high-speed tracking
        new_pc = ProductCode(
            code=user_pc,
            owner_id=current_user.id,
            status="ACTIVE"
        )
        db.add(new_pc)

        # 4. CONSUME RID
        target_rid.status = "USED"
        target_rid.activated_by = current_user.id
        target_rid.activated_at = datetime.utcnow()

        # 5. RECORD SCALABLE TRANSACTION
        transaction = Transaction(
            buyer_id=current_user.id,
            seller_id=None, # To be attributed by profit distribution task
            product_code=user_pc,
            amount=Decimal("10.00"), # Default for RID entry
            payment_method="mobile_money",
            transaction_reference=f"TXN-{uuid.uuid4().hex[:8].upper()}",
            status="SUCCESS"
        )
        db.add(transaction)

        # 6. SYNC RID TO LEGACY SYSTEM (Optional for compatibility)
        if not current_user.rid:
            current_user.rid = generate_rid(parent_rid=target_rid.owner_rid)

        db.commit()
        return {"status": "success", "product_code": user_pc}
    
    return {"status": "already_activated", "product_code": current_user.product_code}

# ─── PAYMENT PROFILES & MANUAL TRANSACTIONS ───

@router.post("/payment-profile", response_model=PaymentProfileResponse)
def create_payment_profile(body: PaymentProfileCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Setup how the user receives money when they sell a product code.
    """
    # Delete existing profiles for simplicity (or update)
    db.query(PaymentProfile).filter(PaymentProfile.user_id == current_user.id).delete()
    
    profile = PaymentProfile(
        user_id=current_user.id,
        payment_method=body.payment_method,
        provider=body.provider,
        account_number=body.account_number,
        account_name=body.account_name
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/seller-payment/{code}")
def get_seller_payment_info(code: str, db: Session = Depends(get_db)):
    """
    Used by buyers to know where to send MoMo payment before activating their account.
    """
    target_pc = db.query(ProductCode).filter(ProductCode.code == code).first()
    if not target_pc:
        raise HTTPException(status_code=404, detail="Product Code not found")
        
    seller_profile = db.query(PaymentProfile).filter(PaymentProfile.user_id == target_pc.owner_id).first()
    if not seller_profile:
        return {"error": "Seller has not set up a payment profile yet."}
        
    return {
        "seller_name": seller_profile.account_name,
        "method": seller_profile.payment_method,
        "provider": seller_profile.provider,
        "account_number": seller_profile.account_number,
        "amount": 10.00, # Constant for now or fetch from Season
        "currency": "GHS"
    }

@router.post("/submit-payment")
def submit_payment_reference(body: PaymentSubmissionRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Step 2: After user sends MoMo, they submit the reference ID for admin verification.
    """
    # 1. Verify PC exists
    target_pc = db.query(ProductCode).filter(ProductCode.code == body.product_code).first()
    if not target_pc:
        raise HTTPException(status_code=404, detail="Product Code not found")

    # 2. Check for duplicate reference
    existing_txn = db.query(Transaction).filter(Transaction.payment_reference == body.payment_reference).first()
    if existing_txn:
        raise HTTPException(status_code=400, detail="This payment reference has already been submitted.")

    # 3. Create PENDING transaction
    txn = Transaction(
        buyer_id=current_user.id,
        seller_id=target_pc.owner_id,
        product_code=body.product_code,
        amount=Decimal("10.00"),
        payment_method="manual_momo",
        payment_reference=body.payment_reference,
        status="PENDING"
    )
    db.add(txn)
    db.commit()
    
    return {"status": "submitted", "message": "Admin will verify your payment and activate your account soon."}

    # SUCCESS AUDIT
    db.add(CodeActivationLog(
        product_code=req.product_code,
        user_id=str(current_user.id),
        status="success",
        ip_address=ip_addr,
        user_agent=user_agent
    ))

    # 7. VIRAL INCENTIVE (Only for initial referral)
    if is_initial_activation:
        db.add(ViralMomentum(user_rid=new_rid, activated_at=datetime.utcnow()))
        seller_momentum = db.query(ViralMomentum).filter(ViralMomentum.user_rid == seller_rid).first()
        if seller_momentum and not seller_momentum.bonus_awarded:
            if datetime.utcnow() - seller_momentum.activated_at < timedelta(hours=72):
                seller_momentum.referral_count_72h += 1
                if seller_momentum.referral_count_72h >= 3:
                    seller_momentum.bonus_awarded = True
                    seller_momentum.bonus_awarded_at = datetime.utcnow()
                    
                    seller_wallet = db.query(Wallet).filter(Wallet.user_rid == seller_rid).first()
                    if seller_wallet:
                        bonus_amount = Decimal("50.00")
                        seller_wallet.balance += bonus_amount
                        seller_wallet.withdrawable_balance += bonus_amount
                        db.add(WalletTransaction(
                            user_rid=seller_rid,
                            type="CREDIT_PROFIT_MOMENTUM",
                            amount=bonus_amount,
                            description="Momentum Bonus: 3 active referrals in 72h"
                        ))

    try:
        from common.workers.profit_tasks import process_profit_distribution
        process_profit_distribution.delay(str(transaction.id))
    except Exception:
        pass
    
    db.commit()
    
    # Return the user's affiliate code (either existing or new)
    affiliate_code = db.query(Code).filter(Code.owner_rid == new_rid, Code.product_code != None).first()
    return affiliate_code

@router.get("/my-codes", response_model=list[CodeResponse])
def get_user_codes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        return []
    return db.query(Code).filter(
        Code.owner_rid == current_user.rid,
        Code.is_active == True,
        Code.product_code != None
    ).all()
