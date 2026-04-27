"""
CediTrees 2.0 — Profit Distribution Engine (Dot-Path RID)
============================================================
Uses dot-path split for O(depth) ancestor extraction.
No database tree traversal. No recursion. No graph queries.

RID: ACNIRP.1.2.1.3.4
Ancestors: ACNIRP.1.2.1.3, ACNIRP.1.2.1, ACNIRP.1.2, ACNIRP.1, ACNIRP
"""
from sqlalchemy.orm import Session
from common.models.wallet import Wallet, WalletTransaction
from common.models.user import User
from decimal import Decimal, ROUND_DOWN
from common.core.redis import get_cached_ancestors, set_cached_ancestors

# ─── Distribution Ratios ───
SELLER_RATIO  = Decimal('0.70')
MASTER_RATIO  = Decimal('0.05')
FAMILY_RATIO  = Decimal('0.25')
MASTER_RID    = "ACNIRP"  # Platform master account


def get_relatives(parent_rid: str) -> list[str]:
    """
    Extract all ancestors from a dot-path RID.
    O(depth)
    """
    parts = parent_rid.split(".")
    relatives = []
    for i in range(len(parts) - 1, 0, -1):
        relatives.append(".".join(parts[:i]))
    return relatives


def compress_network_path(db: Session, relatives: list[str]) -> list[str]:
    """
    DYNAMIC NETWORK COMPRESSION:
    Identify 'Dead Nodes' (inactive) and skip them to keep the network sustainable.
    """
    if not relatives:
        return []
    
    # Batch query for status
    active_users = db.query(User.rid).filter(
        User.rid.in_(relatives),
        User.status == "active"
    ).all()
    
    active_rids = {u.rid for u in active_users}
    
    # Filter relatives while maintaining order (closest first)
    return [r for r in relatives if r in active_rids]


def select_valid_relatives(relatives: list[str], family_profit: Decimal) -> list[str]:
    """
    Apply the minimum profit rule (1 GHS).
    """
    cr = len(relatives)
    while cr > 0:
        if family_profit / Decimal(str(cr)) >= Decimal('1.00'):
            return relatives[:cr]
        cr -= 1
    return []


def distribute_profit(db: Session, seller_rid: str, price: Decimal) -> dict:
    """
    Advanced Distribution Engine with Phase K Scaling:
    1. Try Redis Cache (Active Ancestors).
    2. Fallback to dot-path split + DB status check.
    3. Mathematical Compression.
    """
    seller_profit = (price * SELLER_RATIO).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    master_profit = (price * MASTER_RATIO).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    family_profit = (price * FAMILY_RATIO).quantize(Decimal('0.01'), rounding=ROUND_DOWN)

    # 1. High Performance Cache Lookup
    valid_relatives = get_cached_ancestors(seller_rid)
    
    if valid_relatives is None:
        # 2. SOURCE OF TRUTH (Dot-Path Split)
        raw_relatives = get_relatives(seller_rid)
        
        # 3. DYNAMIC COMPRESSION (DB Status Aware)
        compressed_relatives = compress_network_path(db, raw_relatives)
        
        # 4. MATH VALIDATION (1 GHS Rule)
        valid_relatives = select_valid_relatives(compressed_relatives, family_profit)
        
        # 5. Populate Cache for O(1) next time
        set_cached_ancestors(seller_rid, valid_relatives)

    family_payouts = []
    if valid_relatives:
        share = (family_profit / Decimal(str(len(valid_relatives)))).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
        for rid in valid_relatives:
            family_payouts.append({"rid": rid, "amount": share})

    return {
        "seller": {"rid": seller_rid, "amount": seller_profit},
        "master": {"rid": MASTER_RID, "amount": master_profit},
        "family": family_payouts
    }


def credit_wallet(db: Session, user_rid: str, amount: Decimal, tx_type: str, description: str):
    """Atomically credit a user's wallet and record the transaction."""
    wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).first()
    if not wallet:
        return

    wallet.balance += amount
    wallet.withdrawable_balance += amount

    db.add(WalletTransaction(
        user_rid=user_rid,
        type=tx_type,
        amount=amount,
        description=description
    ))
