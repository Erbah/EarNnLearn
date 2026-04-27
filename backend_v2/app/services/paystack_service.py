import requests
from decimal import Decimal
from app.core.config import settings

class PaystackService:
    BASE_URL = "https://api.paystack.co"
    SECRET_KEY = settings.PAYSTACK_SECRET_KEY

    @classmethod
    def initialize_transaction(cls, email: str, amount: Decimal, metadata: dict = None):
        """
        Paystack expects amount in KOBE/PESEWAS (cents).
        1.00 GHS = 100 Pesewas.
        """
        payload = {
            "email": email,
            "amount": int(float(amount) * 100),
            "metadata": metadata or {}
        }
        headers = {
            "Authorization": f"Bearer {cls.SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        # In test mode or if key is missing, return a dummy response
        if not cls.SECRET_KEY or settings.TESTING:
            import uuid
            return {
                "status": True,
                "data": {
                    "authorization_url": "#simulated-paystack-checkout",
                    "reference": f"SIM_{uuid.uuid4().hex[:10]}"
                }
            }

        response = requests.post(f"{cls.BASE_URL}/transaction/initialize", json=payload, headers=headers)
        return response.json()

    @classmethod
    def verify_transaction(cls, reference: str):
        headers = {
            "Authorization": f"Bearer {cls.SECRET_KEY}"
        }
        if not cls.SECRET_KEY or settings.TESTING:
            return {"status": True, "data": {"status": "success", "amount": 0}}
            
        response = requests.get(f"{cls.BASE_URL}/transaction/verify/{reference}", headers=headers)
        return response.json()

paystack_service = PaystackService()
