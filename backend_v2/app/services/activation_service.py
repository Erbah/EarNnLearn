from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.models.code import Code
from app.models.wallet import Wallet
from app.models.transaction import Transaction, ReferralIndex
from app.services.code_engine import generate_rid, generate_product_code

from app.models.analytics import OnboardingMetric

def run_activation_engine(db: Session, user: User, target_code: Code, transaction: Transaction = None):
    """
    Shared logic to activate an account using a product code.
    Can be triggered by MoMo verification or Global Payment Gateway callbacks.
    """
    if user.rid:
        raise HTTPException(status_code=400, detail="Account is already activated.")

    seller_rid = target_code.owner_rid

    # 1. Update the User with their new structural identifier
    new_rid = generate_rid(parent_rid=seller_rid)
    user.rid = new_rid
    user.parent_rid = seller_rid
    user.status = "active"
    
    # Update linked onboarding metrics to correct RID
    metric = db.query(OnboardingMetric).filter(OnboardingMetric.user_rid == str(user.id)).first()
    if metric:
        metric.user_rid = new_rid

    # 2. Build the graph optimization record
    parent_index = db.query(ReferralIndex).filter(ReferralIndex.user_rid == seller_rid).first()
    new_path = f"{parent_index.path}.{new_rid}" if parent_index else new_rid
    new_depth = (parent_index.depth + 1) if parent_index else 0
    
    ref_index = ReferralIndex(
        user_rid=new_rid,
        parent_rid=seller_rid,
        path=new_path,
        depth=new_depth
    )
    db.add(ref_index)

    # 3. Provision Wallet
    if not db.query(Wallet).filter(Wallet.user_rid == new_rid).first():
        db.add(Wallet(user_rid=new_rid))

    # 4. Mark the code as used (consumed for activation)
    target_code.used = True
    
    if transaction:
        transaction.status = "success"
        transaction.buyer_rid = new_rid
    else:
        transaction = Transaction(
            code_id=target_code.id,
            buyer_rid=new_rid,
            seller_rid=seller_rid,
            amount=target_code.price,
            currency=target_code.currency,
            status="success"
        )
        db.add(transaction)

    # 5. Generate 1 new resalable product code
    new_product = Code(
        product_code=generate_product_code(),
        owner_rid=new_rid,
        parent_rid=seller_rid,
        price=target_code.price,
        tier_type=target_code.tier_type
    )
    db.add(new_product)
    generated_first_code = new_product

    # Queue profit distribution
    try:
        from app.workers.profit_tasks import process_profit_distribution
        from app.core.config import settings
        # Need to commit before queuing so the task can find the transaction
        db.commit()
        db.refresh(transaction)
        
        # SKIP Celery if in testing mode to avoid hang on missing Redis
        if not settings.TESTING:
            process_profit_distribution.delay(str(transaction.id))
        else:
            print(f"   [TEST] Skipping Celery task for transaction {transaction.id}")
    except Exception as e:
        print(f"   [ERROR] Celery queue failed: {e}")
        db.commit() # Ensure state is saved even if worker fail
    
    return generated_first_code
