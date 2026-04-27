from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime

class WalletResponse(BaseModel):
    balance: Decimal
    withdrawable_balance: Decimal
    locked_balance: Decimal
    currency: str
    
    class Config:
        from_attributes = True

class WalletTransactionResponse(BaseModel):
    id: str
    type: str # CREDIT_PROFIT, DEBIT_WITHDRAWAL, etc.
    amount: Decimal
    description: str | None = None
    created_at: datetime
    
    class Config:
        from_attributes = True
