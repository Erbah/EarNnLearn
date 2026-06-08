import requests
from decimal import Decimal
from app.core.config import settings

class PaystackService:
    BASE_URL = "https://api.paystack.co"

    @classmethod
    def _get_key(cls) -> str:
        """Always read from settings so Railway env vars are picked up after restart."""
        return settings.PAYSTACK_SECRET_KEY

    @classmethod
    def initialize_transaction(cls, email: str, amount: Decimal, metadata: dict = None):
        """
        Paystack expects amount in KOBO/PESEWAS (cents).
        1.00 GHS = 100 Pesewas.
        """
        secret_key = cls._get_key()

        # In test mode or if key is missing, return a dummy response
        if not secret_key or settings.TESTING:
            import uuid
            return {
                "status": True,
                "data": {
                    "authorization_url": "#simulated-paystack-checkout",
                    "reference": f"SIM_{uuid.uuid4().hex[:10]}"
                }
            }

        payload = {
            "email": email,
            "amount": int(float(amount) * 100),
            "metadata": metadata or {}
        }
        headers = {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json"
        }
        response = requests.post(f"{cls.BASE_URL}/transaction/initialize", json=payload, headers=headers)
        return response.json()

    @classmethod
    def verify_transaction(cls, reference: str):
        secret_key = cls._get_key()
        if not secret_key or settings.TESTING:
            return {"status": True, "data": {"status": "success", "amount": 0}}

        headers = {"Authorization": f"Bearer {secret_key}"}
        response = requests.get(f"{cls.BASE_URL}/transaction/verify/{reference}", headers=headers)
        return response.json()

paystack_service = PaystackService()
