from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from datetime import datetime

from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.transaction import Transaction
from common.models.code import ActivationRID, ProductCode
from common.models.admin import AdminLog
from common.models.payment_profile import PaymentProfile

router = APIRouter()

# --- SCHEMAS ---
class TransactionConfirmation(BaseModel):
    action: str # CONFIRM, REJECT
    notes: str | None = None

# --- HELPERS ---
def require_admin(user: User):
    if user.tier_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

# --- ROUTES ---

@router.get("/pending")
def list_pending_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    List all transactions waiting for manual MoMo verification.
    """
    require_admin(current_user)
    
    pending = db.query(Transaction).filter(Transaction.status == "PENDING").order_by(desc(Transaction.created_at)).all()
    
    results = []
    for txn in pending:
        buyer = db.query(User).filter(User.id == txn.buyer_id).first()
        seller = db.query(User).filter(User.id == txn.seller_id).first()
        results.append({
            "id": str(txn.id),
            "buyer_name": buyer.name if buyer else "Unknown",
            "seller_name": seller.name if seller else "Unknown",
            "amount": float(txn.amount),
            "reference": txn.payment_reference,
            "created_at": txn.created_at
        })
    return results

@router.post("/confirm/{transaction_id}")
def confirm_transaction(transaction_id: str, body: TransactionConfirmation, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Final step: Admin confirms the MoMo ID matches, which activates the buyer's account.
    """
    require_admin(current_user)
    
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if body.action == "CONFIRM":
        txn.status = "CONFIRMED"
        
        # 1. Trigger Account Activation for the Buyer (if not already active)
        buyer = db.query(User).filter(User.id == txn.buyer_id).first()
        if buyer:
            buyer.is_active = True
            # Also record in log
            db.add(AdminLog(admin_rid=current_user.rid, action=f"Confirmed Payment: {txn.payment_reference} for {buyer.email}"))

        # 2. Add to Seller's Wallet (Profit Distribution)
        # Note: In production, this would call the Celery task 'process_profit_distribution'
        # with high-fidelity logic for family/master shares.
        
        # For now, let's update simple stats
        seller_pc = db.query(ProductCode).filter(ProductCode.code == txn.product_code).first()
        if seller_pc:
            seller_pc.total_sales += 1

    else:
        txn.status = "FAILED"
        db.add(AdminLog(admin_rid=current_user.rid, action=f"Rejected Payment: {txn.payment_reference}", details={"reason": body.notes}))

    db.commit()
    return {"status": txn.status}
