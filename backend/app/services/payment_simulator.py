import uuid
from typing import Dict, Any

class PaymentSimulator:
    def __init__(self):
        # In-memory store for mock transactions
        self._transactions: Dict[str, Dict[str, Any]] = {}

    def create_mock_payment(self, amount: float, currency: str = "GHS") -> str:
        reference = f"MOCK_{uuid.uuid4().hex[:12].upper()}"
        self._transactions[reference] = {
            "amount": amount,
            "currency": currency,
            "status": "pending",
            "transaction_id": None
        }
        return reference

    def complete_payment(self, reference: str) -> str:
        if reference not in self._transactions:
            raise ValueError(f"Reference {reference} not found")
        
        transaction_id = f"TXN_{uuid.uuid4().hex[:16].upper()}"
        self._transactions[reference]["status"] = "success"
        self._transactions[reference]["transaction_id"] = transaction_id
        return transaction_id

    def get_status(self, reference: str) -> Dict[str, Any]:
        return self._transactions.get(reference, {"status": "not_found"})

# Singleton instance for the app
simulator = PaymentSimulator()
