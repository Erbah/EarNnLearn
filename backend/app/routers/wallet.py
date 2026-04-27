from fastapi import APIRouter

router = APIRouter(prefix="/wallet", tags=["wallet"])

@router.get("")
def get_wallet():
    return {"balance": 230, "total_earned": 420, "total_withdrawn": 190}

@router.get("/transactions")
def get_wallet_transactions():
    return [
        {"type": "activation_profit", "amount": 5, "date": "2026-03-11"}
    ]
