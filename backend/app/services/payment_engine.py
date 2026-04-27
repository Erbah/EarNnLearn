from app.services.payment_simulator import simulator

class PaymentEngine:
    @staticmethod
    def verify_payment(reference: str) -> str:
        """
        Verifies a payment reference against the simulator.
        Returns transaction_id if successful, otherwise raises ValueError.
        """
        status_data = simulator.get_status(reference)
        if status_data["status"] == "success":
            return status_data["transaction_id"]
        elif status_data["status"] == "pending":
            raise ValueError("Payment is still pending")
        else:
            raise ValueError("Payment reference not found or failed")

    @staticmethod
    def verify_momo_payment(phone_number: str, amount: float):
        pass
    
    @staticmethod
    def verify_card_payment(reference: str, amount: float):
        pass

payment_engine = PaymentEngine()
