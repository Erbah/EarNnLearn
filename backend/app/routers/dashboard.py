from fastapi import APIRouter

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
def get_dashboard():
    return {
        "wallet_balance": 240,
        "network_size": 18,
        "activations": 12,
        "recent_profits": [
            {"amount": 4, "from": "ACNIRPc1c2"}
        ]
    }
