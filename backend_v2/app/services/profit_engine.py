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

# ─── Default Distribution Ratios ───
DEFAULT_PLATFORM_RATIO = Decimal('0.15')
DEFAULT_SELLER_RATIO   = Decimal('0.70')
DEFAULT_FAMILY_RATIO   = Decimal('0.15')
MASTER_RID             = "ACNIRP"  # Deployment Platform Account


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


def distribute_profit(db: Session, parent_rid: str, price: Decimal, target_code=None) -> dict:
    """
    Complete profit distribution calculation.
    Fetches ratios from target_code overrides, then SystemSetting, then defaults.
    """
    from app.models.admin import SystemSetting
    
    platform_r = DEFAULT_PLATFORM_RATIO
    seller_r = DEFAULT_SELLER_RATIO
    family_r = DEFAULT_FAMILY_RATIO

    if target_code:
        if target_code.platform_share is not None: platform_r = Decimal(str(target_code.platform_share))
        if target_code.seller_share is not None: seller_r = Decimal(str(target_code.seller_share))
        if target_code.family_share is not None: family_r = Decimal(str(target_code.family_share))

    if not target_code or target_code.platform_share is None:
        s_plat = db.query(SystemSetting).filter(SystemSetting.key == "master_percentage").first()
        if s_plat: platform_r = Decimal(str(s_plat.value))
        
    if not target_code or target_code.seller_share is None:
        s_sell = db.query(SystemSetting).filter(SystemSetting.key == "seller_percentage").first()
        if s_sell: seller_r = Decimal(str(s_sell.value))
        
    if not target_code or target_code.family_share is None:
        s_fam = db.query(SystemSetting).filter(SystemSetting.key == "family_percentage").first()
        if s_fam: family_r = Decimal(str(s_fam.value))

    platform_profit = (price * platform_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    seller_profit   = (price * seller_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    family_profit   = (price * family_r).quantize(Decimal('0.01'), rounding=ROUND_DOWN)

    # Extract ancestors from dot-path — zero DB queries
    relatives = get_relatives(parent_rid)
    valid_relatives = select_valid_relatives(relatives, family_profit)

    family_payouts = []
    total_family_distributed = Decimal('0.00')
    if valid_relatives:
        share = (family_profit / Decimal(str(len(valid_relatives)))).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
        for rid in valid_relatives:
            family_payouts.append({"rid": rid, "amount": share})
            total_family_distributed += share

    dust = price - (platform_profit + seller_profit + total_family_distributed)

    return {
        "seller": {"rid": parent_rid, "amount": seller_profit},
        "platform": {"rid": MASTER_RID, "amount": platform_profit},
        "family": family_payouts,
        "community_pot": {"rid": "COMMUNITY_POT", "amount": dust}
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

    # Send notifications for profit payouts
    if tx_type in ["CREDIT_PROFIT_SELLER", "CREDIT_PROFIT_FAMILY"] and amount > 0:
        from app.models.user import User
        from app.services.notification_service import notification_service
        user = db.query(User).filter(User.rid == user_rid).first()
        if user:
            title = "New Code Sale! 💰" if tx_type == "CREDIT_PROFIT_SELLER" else "Network Bonus! 🌳"
            msg_prefix = "A product code you sold was activated" if tx_type == "CREDIT_PROFIT_SELLER" else "Someone in your network activated a code"
            msg = f"{msg_prefix}. You have earned {amount} GHS!"
            
            notification_service.send_alert(user, title, msg)
            notification_service.send_in_app_notification(db, user_rid, title, msg, type="WALLET")
