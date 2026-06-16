import logging
from decimal import Decimal
import uuid
from app.services.paystack_service import paystack_service

logger = logging.getLogger(__name__)

class PayoutService:
    """
    Automated withdrawals/payouts service routing.
    """

    @classmethod
    def process_automated_payout(cls, amount: Decimal, payout_method: str, payout_details: dict) -> dict:
        """
        Executes an automated API call to the payment gateway.
        Returns a dictionary with 'success', 'reference', and 'message'.
        """
        logger.info(f"Initiating automated payout: {amount} via {payout_method}")
        logger.info(f"Payout Details: {payout_details}")
        
        if payout_method.lower() == "paystack":
            try:
                name = payout_details.get("name")
                account_number = payout_details.get("account_number")
                bank_code = payout_details.get("bank_code")
                
                if not name or not account_number or not bank_code:
                    return {"success": False, "reference": None, "message": "Missing required payout_details: name, account_number, or bank_code."}
                    
                # 1. Create Transfer Recipient
                recipient_res = paystack_service.create_transfer_recipient(name, account_number, bank_code)
                if not recipient_res.get("status"):
                    return {"success": False, "reference": None, "message": f"Failed to create recipient: {recipient_res.get('message', 'Unknown Error')}"}
                    
                recipient_code = recipient_res["data"]["recipient_code"]
                
                # 2. Initiate Transfer
                transfer_res = paystack_service.initiate_transfer(amount, recipient_code)
                if not transfer_res.get("status"):
                    return {"success": False, "reference": None, "message": f"Transfer failed: {transfer_res.get('message', 'Unknown Error')}"}
                    
                return {
                    "success": True,
                    "reference": transfer_res["data"].get("reference"),
                    "message": "Paystack payout successful"
                }
            except Exception as e:
                logger.error(f"Paystack payout error: {e}")
                return {"success": False, "reference": None, "message": f"Integration error: {str(e)}"}

        return {
            "success": False,
            "reference": None,
            "message": f"Automated payout method '{payout_method}' is not supported yet. Falling back to manual."
        }

payout_service = PayoutService()
