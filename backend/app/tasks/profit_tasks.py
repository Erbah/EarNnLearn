from app.core.celery_app import celery_app
from app.database.session import SessionLocal
from app.services.profit_engine import profit_engine
from app.models import Activation
from app.core.redis_client import redis_client
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def distribute_profit(self, activation_id: int, seller_id: int, master_id: int, total_payment: float, ancestor_rids: list[str]):
    """
    Idempotent background task to calculate and distribute profits.
    """
    logger.info(f"Processing async profit distribution for activation: {activation_id}")
    
    # Layer 3: Redis Lock
    lock_key = f"profit_lock:{activation_id}"
    lock = redis_client.set(lock_key, "1", nx=True, ex=60)
    
    if not lock:
        logger.warning(f"Activation {activation_id} profit distribution job already running.")
        return "job already running"

    db = SessionLocal()
    try:
        # Layer 1: Database Idempotency Lock
        activation = db.query(Activation)\
            .filter(Activation.id == activation_id)\
            .with_for_update()\
            .first()
            
        if not activation:
            logger.error(f"Activation {activation_id} not found.")
            return "Not found"
            
        if activation.profit_processed:
            logger.info(f"Activation {activation_id} already processed. Skipping.")
            return "Already processed"

        # Distribute profits
        profit_engine.distribute_profits(
            db=db,
            activation_id=activation_id,
            seller_id=seller_id,
            master_id=master_id,
            total_payment=total_payment,
            ancestor_rids=ancestor_rids
        )
        
        # Mark as processed in the same transaction
        activation.profit_processed = True
        
        db.commit()
        logger.info(f"Successfully completed profit distribution for activation: {activation_id}")
        return "Success"
    except Exception as exc:
        db.rollback()
        logger.error(f"Error distributing profits for activation {activation_id}: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    finally:
        db.close()
