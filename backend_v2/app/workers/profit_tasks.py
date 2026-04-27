"""
CediTrees 2.0 — Profit Distribution Celery Worker
===================================================
Idempotent background task that executes the 70/5/25 distribution.
Uses the optimized string-based ancestor extraction (zero DB tree traversal).
"""
import logging
from decimal import Decimal
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.transaction import Transaction
from app.services.profit_engine import distribute_profit, credit_wallet

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def process_profit_distribution(self, transaction_id: str):
    """
    Idempotent profit distribution task.
    
    Flow:
        1. Load transaction
        2. Check if already processed (idempotency)
        3. Calculate payouts using string-based RID extraction
        4. Credit wallets atomically
        5. Mark transaction as processed
    """
    # Layer 1: Redis distributed lock (graceful if Redis unavailable)
    lock_key = f"profit_lock:tx:{transaction_id}"
    try:
        from app.core.redis import redis_client
        if not redis_client.set(lock_key, "1", nx=True, ex=300):
            logger.warning(f"Profit tx {transaction_id} already locked.")
            return "Already locked"
    except Exception:
        pass  # Redis unavailable — proceed without lock (dev mode)

    db = SessionLocal()
    try:
        # Layer 2: DB-level idempotency check
        tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not tx:
            return "Transaction not found"
        if tx.status == "processed":
            return "Already processed"

        price = Decimal(str(tx.amount))
        seller_rid = tx.seller_rid

        # Fetch the Code to check for custom sharing overrides
        from app.models.code import Code
        code = db.query(Code).filter(Code.id == tx.code_id).first()
        
        # Prepare custom ratios if they exist on the code
        ratios = {}
        if code:
            if code.platform_share is not None: ratios['platform_r'] = Decimal(str(code.platform_share))
            if code.seller_share is not None: ratios['seller_r'] = Decimal(str(code.seller_share))
            if code.family_share is not None: ratios['family_r'] = Decimal(str(code.family_share))

        # ─── Core Algorithm: O(depth) string extraction ───
        payouts = distribute_profit(seller_rid, price, **ratios)

        # Credit seller
        credit_wallet(
            db, payouts["seller"]["rid"], payouts["seller"]["amount"],
            "CREDIT_PROFIT_SELLER",
            f"Sale profit from buyer {tx.buyer_rid}"
        )

        # Credit platform (renamed from master)
        credit_wallet(
            db, payouts["platform"]["rid"], payouts["platform"]["amount"],
            "CREDIT_PROFIT_PLATFORM",
            f"Platform fee from {tx.buyer_rid}"
        )

        # Credit family relatives (Network share)
        for payout in payouts["family"]:
            credit_wallet(
                db, payout["rid"], payout["amount"],
                "CREDIT_PROFIT_FAMILY",
                f"Network family share from {tx.buyer_rid}"
            )

        # Mark as processed (idempotency flag)
        tx.status = "processed"
        db.commit()

        logger.info(
            f"✅ Profit distributed for tx {transaction_id}: "
            f"seller={payouts['seller']['amount']}, "
            f"master={payouts['master']['amount']}, "
            f"family={len(payouts['family'])} recipients"
        )
        return "Success"

    except Exception as exc:
        db.rollback()
        logger.error(f"Profit distribution error: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

    finally:
        try:
            from app.core.redis import redis_client
            redis_client.delete(lock_key)
        except Exception:
            pass
        db.close()
