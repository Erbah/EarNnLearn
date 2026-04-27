from app.services.wallet_engine import wallet_engine
from app.core.config import settings

class ProfitEngine:
    @staticmethod
    def calculate_cr_distribution(profit_pool: float, ancestors_count: int) -> tuple[int, float]:
        """
        Applies the Cr reduction formula: 
        If share < 1, reduce relatives until share >= 1.
        Returns the final number of ancestors to pay and the payout per ancestor.
        """
        if ancestors_count == 0:
            return 0, 0.0

        cr = ancestors_count
        while cr > 0:
            share = profit_pool / cr
            if share >= 1:
                break
            cr -= 1
        
        return cr, share if cr > 0 else 0.0

    @staticmethod
    def distribute_profits(db, activation_id: int, seller_id: int, master_id: int, total_payment: float, ancestor_rids: list[str]):
        """
        Calculates and distributes profits to all relevant parties atomically.
        MUST be called within an active transaction.
        """
        from app.models import ProfitDistribution, ProductCode
        
        seller_pool = total_payment * settings.SELLER_SHARE
        master_pool = total_payment * settings.MASTER_SHARE
        family_pool = total_payment * 0.25 # Implicitly the remainder from 70% and 5%

        # 1. Distribute to Master
        wallet_engine.credit_wallet(db, master_id, master_pool, "activation_profit_master", f"act_{activation_id}")
        db.add(ProfitDistribution(activation_id=activation_id, receiver_id=master_id, amount=master_pool, level=0))

        # 2. Distribute to Seller/Parent
        wallet_engine.credit_wallet(db, seller_id, seller_pool, "activation_profit_seller", f"act_{activation_id}")
        db.add(ProfitDistribution(activation_id=activation_id, receiver_id=seller_id, amount=seller_pool, level=1))

        # 3. Distribute to Family (Ancestors)
        # We need the user_id for each ancestor based on their identity RID
        if ancestor_rids and family_pool > 0:
            # Map identity RIDs to their owners via Activation table
            from app.models import Activation
            ancestor_activations = db.query(Activation).filter(Activation.user_rid.in_(ancestor_rids)).all()
            rid_to_owner = {a.user_rid: a.user_id for a in ancestor_activations}
            
            # Preserve closest-first order and EXCLUDE SELLER & MASTER
            ordered_ancestors = [
                rid_to_owner[rid] for rid in ancestor_rids 
                if rid in rid_to_owner and rid_to_owner[rid] not in [seller_id, master_id]
            ]
            
            cr, share = ProfitEngine.calculate_cr_distribution(family_pool, len(ordered_ancestors))
            
            # Pay exactly the top `cr` ancestors
            for level, ancestor_id in enumerate(ordered_ancestors[:cr], start=2):
                if ancestor_id:
                    wallet_engine.credit_wallet(db, ancestor_id, share, "activation_profit_family", f"act_{activation_id}")
                    db.add(ProfitDistribution(activation_id=activation_id, receiver_id=ancestor_id, amount=share, level=level))

profit_engine = ProfitEngine()
