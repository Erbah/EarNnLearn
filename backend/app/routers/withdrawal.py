from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/withdraw", tags=["withdrawal"])

class WithdrawalRequest(BaseModel):
    amount: float
    method: str
    account: str

@router.post("")
def request_withdrawal(request: WithdrawalRequest):
    return {"message": "Withdrawal request submitted"}
