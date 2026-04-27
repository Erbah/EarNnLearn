from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.models.wallet import Wallet, WalletTransaction
from app.models.code import Code
from app.services.activation_service import run_activation_engine
from app.core.config import settings
import uuid
import hashlib
import hmac
import json

router = APIRouter()

@router.post("/verify/{reference}")
def verify_payment_simulator(reference: str, db: Session = Depends(get_db)):
    """
    Simulates a webhook/callback for a global payment reference.
    Triggers Phase C (Activation) if the pending transaction is found.
    
    This is used for testing international payment flows (Stripe/PayPal/Paystack)
    without requiring live API keys.
    """
    # 1. Find the pending transaction
    tx = db.query(Transaction).filter(
        Transaction.payment_reference == reference, 
        Transaction.status == "pending"
    ).first()
    
    if not tx:
        raise HTTPException(
            status_code=404, 
            detail=f"Pending transaction with reference {reference} not found."
        )

    # 2. Identify the user who submitted this payment
    # buyer_rid for pending activations is stored as "PENDING_ACT_{user_id}"
    if not tx.buyer_rid.startswith("PENDING_ACT_"):
        raise HTTPException(status_code=400, detail="Invalid transaction buyer mapping.")
        
    user_id = tx.buyer_rid.replace("PENDING_ACT_", "")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User associated with this transaction not found.")

    # 3. Identify the code being activated
    code = db.query(Code).filter(Code.id == tx.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Product code associated with this transaction not found.")

    # 4. Trigger the Activation Engine (Phase C)
    # This will generate the RID, update the wallet, and queue profit distribution
    activated_code = run_activation_engine(db, user, code, tx)
    
    return {
        "status": "success",
        "message": "Global payment verified successfully. Account activated.",
        "new_rid": user.rid,
        "first_product_code": activated_code.product_code
    }

@router.post("/webhook/paystack")
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handles Paystack event notifications (e.g. charge.success).
    Automates activation when a payment is confirmed.
    """
    # 1. Verify Signature
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature")
    
    if settings.PAYSTACK_SECRET_KEY and not settings.TESTING:
        if not signature or not verify_paystack_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid Paystack signature")

    # 2. Parse Event
    try:
        event_data = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if event_data.get("event") != "charge.success":
        return {"message": f"Ignored event: {event_data.get('event')}"}

    data = event_data.get("data", {})
    reference = data.get("reference")
    
    if not reference:
        raise HTTPException(status_code=400, detail="Missing payment reference")

    # 3. Find Transaction
    tx = db.query(Transaction).filter(
        Transaction.payment_reference == reference,
        Transaction.status == "pending"
    ).first()

    if not tx:
        return {"message": "Transaction already processed or not found"}

    # 4. Handle based on metadata or transaction type
    metadata = data.get("metadata", {})
    payment_type = metadata.get("type", "ACTIVATION") # Default to activation for backward compatibility

    if payment_type == "ACTIVATION":
        user_id = tx.buyer_rid.replace("PENDING_ACT_", "")
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user: return {"message": "User not found"}
        code = db.query(Code).filter(Code.id == tx.code_id).first()
        if not code: return {"message": "Code not found"}
        run_activation_engine(db, user, code, tx)
        return {"status": "success", "message": "Account activated"}

    elif payment_type == "WALLET_DEPOSIT":
        user_rid = metadata.get("user_rid")
        wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).first()
        if not wallet: return {"message": "Wallet not found"}
        
        from decimal import Decimal
        amount = Decimal(str(data.get("amount", 0))) / 100
        wallet.balance += amount
        wallet.withdrawable_balance += amount
        tx.status = "success"
        
        db.add(WalletTransaction(
            user_rid=user_rid,
            type="CREDIT_DEPOSIT",
            amount=amount,
            description=f"Wallet deposit via Paystack ({reference})"
        ))
        db.commit()
        return {"status": "success", "message": "Wallet funded"}

    elif payment_type == "COURSE_PURCHASE":
        course_id = metadata.get("course_id")
        user_rid = metadata.get("user_rid")
        
        from app.models.course import Course
        from app.models.marketplace import CourseEnrollment
        from app.models.learning import CoursePayment, generate_uuid, get_now
        
        course = db.query(Course).filter(Course.id == uuid.UUID(course_id)).first()
        if not course: return {"message": "Course not found"}
        
        # Mark transaction success
        tx.status = "success"
        
        # Credit creator (direct purchase logic)
        creator_wallet = db.query(Wallet).filter(Wallet.user_rid == course.creator_rid).first()
        if creator_wallet:
            amount = Decimal(str(data.get("amount", 0))) / 100
            from app.api.v1.learning import CREATOR_CUT
            creator_share = (amount * CREATOR_CUT).quantize(Decimal("0.01"))
            creator_wallet.balance += creator_share
            creator_wallet.withdrawable_balance += creator_share
            db.add(WalletTransaction(
                user_rid=course.creator_rid,
                type="CREDIT_COURSE_SALE",
                amount=creator_share,
                description=f"Direct sale: {course.title}"
            ))

        # Create enrollment and payment record
        db.add(CoursePayment(
            id=generate_uuid(),
            user_rid=user_rid,
            course_id=course_id,
            total_price=course.price,
            amount_paid=course.price,
            remaining=0,
            payment_method="paystack_direct",
            status="completed",
            created_at=get_now()
        ))
        db.add(CourseEnrollment(course_id=course_id, user_rid=user_rid))
        course.enrollment_count = (course.enrollment_count or 0) + 1
        
        db.commit()
        return {"status": "success", "message": "Course purchased and enrolled"}

    return {"message": "Unknown payment type"}

def verify_paystack_signature(payload: bytes, signature: str) -> bool:
    if not settings.PAYSTACK_SECRET_KEY or settings.TESTING: 
        return True # Bypass if no key in dev or if explicitly in testing mode
        
    expected = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()
    return expected == signature
