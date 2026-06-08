"""
CediTrees 2.0 — Profit Distribution Engine (Dot-Path RID)
============================================================
Uses dot-path split for O(depth) ancestor extraction.
No database tree traversal. No recursion. No graph queries.

RID: ACNIRP.1.2.1.3.4
Ancestors: ACNIRP.1.2.1.3, ACNIRP.1.2.1, ACNIRP.1.2, ACNIRP.1, ACNIRP
"""
from sqlalchemy.orm import Session
from app.models.wallet import Wallet, WalletTransaction
from decimal import Decimal, ROUND_DOWN

# ─── Distribution Ratios (New 3-Way Split) ───
PLATFORM_RATIO = Decimal('0.40')
SELLER_RATIO   = Decimal('0.30')
FAMILY_RATIO   = Decimal('0.30')
MASTER_RID     = "ACNIRP"  # Deployment Platform Account


def get_relatives(parent_rid: str) -> list[str]:
    """
    Extract all ancestors from a dot-path RID.
    Time complexity: O(depth)
    
    Example:
        parent_rid = "ACNIRP.1.2.1.3.4"
        returns ["ACNIRP.1.2.1.3", "ACNIRP.1.2.1", "ACNIRP.1.2", "ACNIRP.1", "ACNIRP"]
    """
    parts = parent_rid.split(".")
    relatives = []

    for i in range(len(parts) - 1, 0, -1):
        relatives.append(".".join(parts[:i]))

    return relatives


def select_valid_relatives(relatives: list[str], family_profit: Decimal) -> list[str]:
    """
    Apply the minimum profit rule: family_profit / Cr >= 1
    Reduce Cr (number of eligible relatives) until the rule is satisfied.
    Closest relatives first.
    """
    cr = len(relatives)
    
    while cr > 0:
        if family_profit / Decimal(str(cr)) >= Decimal('1.00'):
            return relatives[:cr]
        cr -= 1

    return []


def distribute_profit(parent_rid: str, price: Decimal, platform_r: Decimal = PLATFORM_RATIO, seller_r: Decimal = SELLER_RATIO, family_r: Decimal = FAMILY_RATIO) -> dict:
    """
    Complete profit distribution calculation.
    Returns the full payout structure without touching the database.
    """
    platform_profit = (price * platform_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    seller_profit   = (price * seller_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    family_profit   = (price * family_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)

    # Extract ancestors from dot-path — zero DB queries
    relatives = get_relatives(parent_rid)
    valid_relatives = select_valid_relatives(relatives, family_profit)

    family_payouts = []
    if valid_relatives:
        share = (family_profit / Decimal(str(len(valid_relatives)))).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
        for rid in valid_relatives:
            family_payouts.append({"rid": rid, "amount": share})

    return {
        "seller": {"rid": parent_rid, "amount": seller_profit},
        "platform": {"rid": MASTER_RID, "amount": platform_profit},
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
