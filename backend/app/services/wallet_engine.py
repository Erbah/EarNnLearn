from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Wallet, WalletTransaction

class WalletEngine:
    @staticmethod
    def credit_wallet(db: Session, user_id: int, amount: float, transaction_type: str, reference: str):
        """
        Atomically credits a user's wallet. 
        MUST be called within an active database transaction.
        """
        # Ensure the wallet exists
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
        if not wallet:
            wallet = Wallet(user_id=user_id, balance=0)
            db.add(wallet)
            db.flush() # Get wallet.id without committing

        # 1. Write the immutable ledger entry first
        wallet_tx = WalletTransaction(
            wallet_id=wallet.id,
            amount=amount,
            type=transaction_type,
            reference=reference
        )
        db.add(wallet_tx)

        # 2. Perform atomic balance update to avoid read-modify-write race conditions
        db.execute(
            text("""
                UPDATE wallets
                SET balance = balance + :amount
                WHERE user_id = :uid
            """),
            {"amount": amount, "uid": user_id}
        )

wallet_engine = WalletEngine()
