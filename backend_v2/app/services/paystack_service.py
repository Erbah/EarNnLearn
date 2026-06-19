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
        try:
            response = requests.post(f"{cls.BASE_URL}/transaction/initialize", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": False, "message": str(e)}

    @classmethod
    def verify_transaction(cls, reference: str):
        secret_key = cls._get_key()
        if not secret_key or settings.TESTING:
            return {"status": True, "data": {"status": "success", "amount": 0}}

        try:
            headers = {"Authorization": f"Bearer {secret_key}"}
            response = requests.get(f"{cls.BASE_URL}/transaction/verify/{reference}", headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": False, "message": str(e)}

    @classmethod
    def create_transfer_recipient(cls, name: str, account_number: str, bank_code: str, recipient_type: str = "mobile_money"):
        """Creates a transfer recipient and returns the recipient_code.
        recipient_type: 'mobile_money' for MoMo, 'ghipss' for Ghana bank accounts.
        """
        secret_key = cls._get_key()
        if not secret_key or settings.TESTING:
            return {"status": True, "data": {"recipient_code": "RCP_simulated123"}}

        payload = {
            "type": recipient_type,
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "GHS"
        }
        
        headers = {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(f"{cls.BASE_URL}/transferrecipient", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": False, "message": str(e)}

    @classmethod
    def initiate_transfer(cls, amount: Decimal, recipient_code: str, reason: str = "Withdrawal Payout"):
        """Initiates a transfer to a recipient code. Amount in GHS."""
        secret_key = cls._get_key()
        if not secret_key or settings.TESTING:
            import uuid
            return {"status": True, "data": {"reference": f"TRF_sim_{uuid.uuid4().hex[:10]}"}}

        payload = {
            "source": "balance",
            "amount": int(float(amount) * 100), # KOBO/PESEWAS
            "recipient": recipient_code,
            "reason": reason
        }
        headers = {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(f"{cls.BASE_URL}/transfer", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": False, "message": str(e)}

paystack_service = PaystackService()
