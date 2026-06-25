from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.permissions import require_super_admin
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

@router.get("/audit-payouts", dependencies=[Depends(require_super_admin)])
def audit_payouts(db: Session = Depends(get_db)):
    try:
        from app.models.code import Code
        from app.models.admin import SystemSetting
        
        # 1. Fetch Amanda users
        amandas = db.query(User).filter(User.name.ilike("%Amanda%")).all()
        amandas_results = []
        for amanda in amandas:
            wallet = db.query(Wallet).filter(Wallet.user_rid == amanda.rid).first() if amanda.rid else None
            
            codes = db.query(Code).filter(Code.owner_rid == amanda.rid).all() if amanda.rid else []
            codes_data = [{"code": c.product_code or c.generated_rid, "price": float(c.price), "used": c.used} for c in codes]
            
            sales = db.query(Transaction).filter(Transaction.seller_rid == amanda.rid).all() if amanda.rid else []
            sales_data = [{"id": s.id, "buyer_rid": s.buyer_rid, "amount": float(s.amount), "status": s.status, "created_at": str(s.created_at)} for s in sales]
            
            w_txs = db.query(WalletTransaction).filter(WalletTransaction.user_rid == amanda.rid).all() if amanda.rid else []
            w_txs_data = [{"type": wt.type, "amount": float(wt.amount), "description": wt.description, "created_at": str(wt.created_at)} for wt in w_txs]
            
            referrals_data = []
            if amanda.rid:
                referrals = db.query(User).filter(User.parent_rid == amanda.rid).all()
                for ref in referrals:
                    ref_wallet = db.query(Wallet).filter(Wallet.user_rid == ref.rid).first() if ref.rid else None
                    ref_txs = db.query(Transaction).filter(Transaction.buyer_rid == ref.rid).all() if ref.rid else []
                    rt_data = [{"amount": float(rt.amount), "status": rt.status, "reference": rt.payment_reference} for rt in ref_txs]
                    referrals_data.append({
                        "name": ref.name,
                        "rid": ref.rid,
                        "status": ref.status,
                        "wallet_balance": float(ref_wallet.balance) if ref_wallet else 0.0,
                        "transactions": rt_data
                    })
            
            amandas_results.append({
                "amanda": {
                    "id": str(amanda.id),
                    "name": amanda.name,
                    "rid": amanda.rid,
                    "email": amanda.email,
                    "status": amanda.status,
                    "wallet_balance": float(wallet.balance) if wallet else 0.0,
                    "withdrawable_balance": float(wallet.withdrawable_balance) if wallet else 0.0,
                },
                "codes": codes_data,
                "sales": sales_data,
                "wallet_transactions": w_txs_data,
                "referrals": referrals_data
            })
            
        # 2. Fetch platform (master) wallet
        master_wallet = db.query(Wallet).filter(Wallet.user_rid == "ACNIRP").first()
        master_txs = db.query(WalletTransaction).filter(WalletTransaction.user_rid == "ACNIRP").all()
        master_txs_data = [{"type": wt.type, "amount": float(wt.amount), "description": wt.description, "created_at": str(wt.created_at)} for wt in master_txs]
        master_data = {
            "balance": float(master_wallet.balance) if master_wallet else 0.0,
            "transactions": master_txs_data
        }
        
        # 3. Fetch system settings
        settings_rows = db.query(SystemSetting).all()
        settings_data = {s.key: s.value for s in settings_rows}
        
        # 4. Fetch all transactions in 'success' or 'processed' status
        success_txs = db.query(Transaction).filter(Transaction.status == "success").all()
        success_txs_data = [{"id": s.id, "buyer_rid": s.buyer_rid, "seller_rid": s.seller_rid, "amount": float(s.amount), "status": s.status, "created_at": str(s.created_at)} for s in success_txs]
        
        processed_txs = db.query(Transaction).filter(Transaction.status == "processed").all()
        processed_txs_data = [{"id": s.id, "buyer_rid": s.buyer_rid, "seller_rid": s.seller_rid, "amount": float(s.amount), "status": s.status, "created_at": str(s.created_at)} for s in processed_txs]
        
        return {
            "users": amandas_results,
            "master_wallet": master_data,
            "system_settings": settings_data,
            "success_transactions": success_txs_data,
            "processed_transactions": processed_txs_data
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.post("/repair-payouts", dependencies=[Depends(require_super_admin)])
def repair_payouts(db: Session = Depends(get_db)):
    try:
        from app.models.code import Code
        from app.services.profit_engine import distribute_profit, credit_wallet
        from decimal import Decimal
        
        # Find all transactions in 'success' status
        success_txs = db.query(Transaction).filter(Transaction.status == "success").all()
        repaired = []
        
        for tx in success_txs:
            # Check if this is an activation transaction
            if not tx.buyer_rid or tx.buyer_rid.startswith("PENDING_ACT_"):
                continue
                
            # Safety Check: check if any wallet transactions already exist for this buyer
            existing_tx = db.query(WalletTransaction).filter(
                WalletTransaction.description.ilike(f"%{tx.buyer_rid}%")
            ).first()
            if existing_tx:
                print(f"[REPAIR] Tx {tx.id} already has wallet credits in DB. Marking as processed without duplicating.")
                tx.status = "processed"
                db.commit()
                continue
                
            # Run profit distribution for this transaction
            target_code = db.query(Code).filter(Code.id == tx.code_id).first()
            seller_rid = tx.seller_rid or (target_code.owner_rid if target_code else None)
            if not seller_rid:
                continue
                
            print(f"[REPAIR] Running profit distribution for tx {tx.id}: seller={seller_rid}, amount={tx.amount}")
            payouts = distribute_profit(db, seller_rid, Decimal(str(tx.amount)), target_code=target_code)
            
            # Credit seller
            credit_wallet(db, payouts["seller"]["rid"], payouts["seller"]["amount"],
                          "CREDIT_PROFIT_SELLER", f"Sale profit from buyer {tx.buyer_rid} (REPAIRED)")
            # Credit platform
            credit_wallet(db, payouts["platform"]["rid"], payouts["platform"]["amount"],
                          "CREDIT_PROFIT_PLATFORM", f"Platform fee from {tx.buyer_rid} (REPAIRED)")
            # Credit family
            for payout in payouts["family"]:
                credit_wallet(db, payout["rid"], payout["amount"],
                              "CREDIT_PROFIT_FAMILY", f"Network family share from {tx.buyer_rid} (REPAIRED)")
                              
            tx.status = "processed"
            db.commit()
            
            repaired.append({
                "tx_id": str(tx.id),
                "buyer_rid": tx.buyer_rid,
                "seller_rid": seller_rid,
                "amount": float(tx.amount),
                "payouts": {
                    "seller": {"rid": payouts["seller"]["rid"], "amount": float(payouts["seller"]["amount"])},
                    "platform": {"rid": payouts["platform"]["rid"], "amount": float(payouts["platform"]["amount"])},
                    "family": [{"rid": p["rid"], "amount": float(p["amount"])} for p in payouts["family"]],
                    "community_pot": float(payouts["community_pot"]["amount"])
                }
            })
            
        return {"status": "success", "repaired_count": len(repaired), "repaired": repaired}
    except Exception as e:
        db.rollback()
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

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
    
    try:
        transactions = db.query(WalletTransaction).filter(
            WalletTransaction.user_rid == current_user.rid
        ).order_by(WalletTransaction.created_at.desc()).limit(limit).all()
        return transactions
    except Exception as e:
        import traceback
        print(f"[ERROR_TRANSACTIONS] Failed to fetch transactions for {current_user.rid}: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {e}")

@router.post("/withdraw", response_model=WithdrawalRequestOut)
def request_withdrawal(body: WithdrawalRequestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        raise HTTPException(status_code=400, detail="User not activated")
        
    # Use with_for_update() to lock the wallet row and prevent double-spend race conditions
    wallet = db.query(Wallet).filter(Wallet.user_rid == current_user.rid).with_for_update().first()
    if not wallet or wallet.withdrawable_balance < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient withdrawable balance")
        
    # Check minimum withdrawal (default 50 GHS)
    from app.models.admin import SystemSetting
    min_val_str = SystemSetting.get_val(db, "min_withdrawal")
    min_val = Decimal(min_val_str) if min_val_str else Decimal("50.00")
    
    if body.amount < min_val:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {min_val} GHS")

    # Check withdrawal fee (default 2.00 GHS)
    fee_val_str = SystemSetting.get_val(db, "withdrawal_fee")
    fee = Decimal(fee_val_str) if fee_val_str else Decimal("2.00")
    
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
    
    from app.services.notification_service import notification_service
    notification_service.send_in_app_notification(
        db=db, user_rid=current_user.rid, 
        title="Withdrawal Requested", 
        message=f"Your request to withdraw {body.amount} GHS via {body.payout_method} has been submitted.", 
        type="WALLET", link="/settings"
    )
    
    # Optional: Route through automated payout system if enabled
    auto_payout_val = SystemSetting.get_val(db, "automated_withdrawals")
    if auto_payout_val and auto_payout_val.lower() == "true":
        # Check max auto withdrawal setting
        max_auto_val_str = SystemSetting.get_val(db, "max_auto_withdrawal")
        max_auto_val = Decimal(max_auto_val_str) if max_auto_val_str else Decimal("500.00")
        
        if body.amount > max_auto_val:
            import random
            from datetime import timedelta
            from app.services.notification_service import notification_service
            
            wlp_code = str(random.randint(100000, 999999))
            req.wlp_code = wlp_code
            req.wlp_expires_at = datetime.utcnow() + timedelta(minutes=15)
            req.status = "AWAITING_WLP"
            req.admin_notes = "Amount exceeds auto-payout limit. WLP code generated and sent to user."
            
            notification_service.send_alert(
                current_user,
                "Action Required: Withdrawal Limit Permit (WLP)",
                f"Your request to withdraw {body.amount} GHS exceeds the automated limit. Your secure WLP code is: {wlp_code}. It expires in 15 minutes."
            )
        else:
            from app.services.payout_service import payout_service
            result = payout_service.process_automated_payout(body.amount, body.payout_method, body.payout_details)
            if result["success"]:
                req.status = "APPROVED"
                req.admin_notes = f"Automated payout successful. Ref: {result['reference']}"
                req.processed_at = datetime.utcnow()
            else:
                req.admin_notes = result["message"]

    db.commit()
    db.refresh(req)
    return req

@router.get("/withdrawals/my", response_model=list[WithdrawalRequestOut])
def get_my_withdrawals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        return []
    try:
        res = db.query(WithdrawalRequest).filter(
            WithdrawalRequest.user_rid == current_user.rid
        ).order_by(WithdrawalRequest.created_at.desc()).all()
        return res
    except Exception as e:
        import traceback
        print(f"[ERROR_WITHDRAWALS] Failed to fetch withdrawals for {current_user.rid}: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch withdrawals: {e}")

class WLPVerifyRequest(BaseModel):
    wlp_code: str

@router.post("/withdraw/{request_id}/verify-wlp", response_model=WithdrawalRequestOut)
def verify_wlp_and_payout(request_id: str, body: WLPVerifyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        raise HTTPException(status_code=400, detail="User not activated")
        
    req = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.id == request_id, 
        WithdrawalRequest.user_rid == current_user.rid
    ).with_for_update().first()
    
    if not req:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
        
    if req.status != "AWAITING_WLP":
        raise HTTPException(status_code=400, detail="Request is not awaiting WLP verification")
        
    if not req.wlp_code or req.wlp_code != body.wlp_code:
        raise HTTPException(status_code=400, detail="Invalid WLP code")
        
    if req.wlp_expires_at and datetime.utcnow() > req.wlp_expires_at:
        raise HTTPException(status_code=400, detail="WLP code has expired. Please cancel and request a new withdrawal.")
        
    # Code is valid, process payout
    from app.services.payout_service import payout_service
    result = payout_service.process_automated_payout(req.amount, req.payout_method, req.payout_details)
    
    if result["success"]:
        req.status = "APPROVED"
        req.admin_notes = f"WLP Verified. Automated payout successful. Ref: {result['reference']}"
        req.processed_at = datetime.utcnow()
        req.wlp_code = None # clear it
    else:
        req.status = "PENDING"
        req.admin_notes = f"WLP Verified but payout failed: {result['message']}"
        req.wlp_code = None
        
    db.commit()
    db.refresh(req)
    return req

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
        status="pending"
    )
    db.add(new_tx)
    db.commit()

    return {
        "authorization_url": paystack_res["data"]["authorization_url"],
        "reference": paystack_res["data"]["reference"]
    }
