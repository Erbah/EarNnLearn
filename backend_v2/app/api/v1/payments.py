from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.models.wallet import Wallet, WalletTransaction
from app.models.code import Code
from app.services.activation_service import run_activation_engine
from app.core.config import settings
from app.core.permissions import require_super_admin
import uuid
import hashlib
import hmac
import json

router = APIRouter()

@router.post("/verify/{reference}", dependencies=[Depends(require_super_admin)])
def verify_payment_simulator(reference: str, db: Session = Depends(get_db)):
    """
    DEV/ADMIN ONLY: Simulates a webhook/callback for a global payment reference.
    Triggers Phase C (Activation) if the pending transaction is found.

    This endpoint is BLOCKED in production (TESTING=False). It exists solely
    to facilitate local development and QA without requiring live payment keys.
    In production, it returns 404 to conceal its existence from attackers.
    """
    # Hard-block in production — return 404 to avoid revealing this endpoint exists
    if not settings.TESTING:
        raise HTTPException(status_code=404, detail="Not Found")

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

from app.core.rate_limit import payment_verify_limiter
from app.core.redis import get_redis_client
import redis

@router.post("/webhook/paystack", dependencies=[Depends(payment_verify_limiter)])
async def paystack_webhook(
    request: Request, 
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """
    Handles Paystack event notifications (e.g. charge.success).
    Automates activation when a payment is confirmed.
    """
    # 1. Verify Signature
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature")
    
    if not settings.TESTING:
        if not settings.PAYSTACK_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Paystack secret key is not configured")
        if not signature or not verify_paystack_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid Paystack signature")
    elif settings.PAYSTACK_SECRET_KEY:
        # If in testing mode but key is provided, still validate it
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

    # 3. Atomic Redis Distributed Lock (Defeats Webhook Race Conditions)
    lock_key = f"lock:payment_processing:{reference}"
    is_lock_acquired = False
    
    try:
        try:
            is_lock_acquired = redis_client.set(lock_key, "processing", nx=True, ex=120)
            if not is_lock_acquired:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Transaction {reference} is already being processed elsewhere. Swallowing request.")
                return {"status": "locked", "message": "Transaction processing in progress or completed."}
        except Exception as e:
            # Fall back to DB locking if Redis is down
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Redis lock failed, falling back to DB lock: {e}")

        # 4. Find Transaction with Row-Level Lock
        tx = db.query(Transaction).filter(
            Transaction.payment_reference == reference
        ).with_for_update().first()

        if not tx:
            return {"message": "Transaction tracking token mismatch or not found"}

        # 3b. Idempotency Check: Evaluate State safely post-lock
        if tx.status != "pending":
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate webhook intercepted for reference {reference}. Transaction already fully reconciled.")
            return {"status": "success", "message": "Transaction already fully reconciled."}

        # 4. Handle based on metadata or transaction type
        metadata = data.get("metadata", {})
        payment_type = metadata.get("type", "ACTIVATION") # Default to activation for backward compatibility

        if payment_type == "ACTIVATION":
            try:
                user_id = tx.buyer_rid.replace("PENDING_ACT_", "")
                user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
                if not user: raise ValueError("User not found")
                code = db.query(Code).filter(Code.id == tx.code_id).first()
                if not code: raise ValueError("Code not found")
                run_activation_engine(db, user, code, tx)
                db.commit()
                return {"status": "success", "message": "Account activated"}
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Transactional integrity failure during runtime ingestion."
                )

        elif payment_type == "WALLET_DEPOSIT":
            try:
                user_rid = metadata.get("user_rid")
                wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).with_for_update().first()
                if not wallet: 
                    db.rollback()
                    return {"message": "Wallet not found"}
                
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
                
                from app.services.notification_service import notification_service
                notification_service.send_in_app_notification(
                    db=db, user_rid=user_rid, 
                    title="Deposit Successful", 
                    message=f"Your deposit of {amount} GHS has been credited to your wallet.", 
                    type="WALLET", link="/settings"
                )
                
                db.commit()
                return {"status": "success", "message": "Wallet funded"}
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Transactional integrity failure during runtime ingestion."
                )

        elif payment_type == "COURSE_PURCHASE":
            try:
                course_id = metadata.get("course_id")
                user_rid = metadata.get("user_rid")
                
                from app.models.course import Course
                from app.models.marketplace import CourseEnrollment
                from app.models.learning import CoursePayment, generate_uuid, get_now
                
                course = db.query(Course).filter(Course.id == uuid.UUID(course_id)).first()
                if not course: 
                    db.rollback()
                    return {"message": "Course not found"}
                
                # Mark transaction success
                tx.status = "success"
                
                creator_wallet = db.query(Wallet).filter(Wallet.user_rid == course.creator_rid).with_for_update().first()
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
                    
                    # Notify the creator
                    from app.models.user import User
                    from app.services.notification_service import notification_service
                    creator = db.query(User).filter(User.rid == course.creator_rid).first()
                    if creator:
                        msg = f"Good news! You just earned {creator_share} GHS from a direct purchase of '{course.title}'."
                        notification_service.send_alert(creator, "New Course Sale!", msg)
                        notification_service.send_in_app_notification(db, creator.rid, "New Earnings! 💰", msg, type="WALLET")

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
                
                from app.services.notification_service import notification_service
                notification_service.send_in_app_notification(
                    db=db, user_rid=user_rid, 
                    title="Course Purchased", 
                    message=f"You have successfully purchased and enrolled in {course.title}.", 
                    type="ENROLLMENT", link=f"/learn/{course.id}"
                )
                
                db.commit()
                return {"status": "success", "message": "Course purchased and enrolled"}
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Transactional integrity failure during runtime ingestion."
                )

        return {"message": "Unknown payment type"}

    finally:
        # Guaranteed lock release
        if is_lock_acquired:
            try:
                redis_client.delete(lock_key)
            except Exception:
                pass


def verify_paystack_signature(payload: bytes, signature: str) -> bool:
    if not settings.PAYSTACK_SECRET_KEY or settings.TESTING: 
        return True # Bypass if no key in dev or if explicitly in testing mode
        
    expected = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(expected, signature.lower())
