import logging
from app.models.user import User

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Centralized service for routing notifications (OTPs, Alerts, Receipts)
    to a user based on their contact methods and preferences.
    """
    
    @staticmethod
    def _is_local_phone(phone: str) -> bool:
        """
        Heuristic to determine if phone is local/African 
        (Currently checks for Ghana formats +233, 02, 05, etc.)
        """
        if not phone:
            return False
        # If it has a country code for Ghana, Nigeria (+234), etc.
        local_codes = ["+233", "+234", "+254", "+27", "02", "05", "03", "08", "07"]
        for code in local_codes:
            if phone.startswith(code):
                return True
        return False
        
    def send_alert(self, user: User, subject: str, message: str):
        preference = user.preferred_notification_method or "auto"
        
        send_to_phone = False
        send_to_email = False
        
        # 1. AUTO: Smart routing based on what's available and region
        if preference == "auto":
            if user.phone and user.email:
                if self._is_local_phone(user.phone):
                    send_to_phone = True
                else:
                    send_to_email = True
            elif user.phone:
                send_to_phone = True
            elif user.email:
                send_to_email = True
                
        # 2. STRICT PREFERENCES
        elif preference == "phone":
            if user.phone:
                send_to_phone = True
                
        elif preference == "email":
            if user.email:
                send_to_email = True
                
        elif preference == "both":
            if user.phone:
                send_to_phone = True
            if user.email:
                send_to_email = True
                
        # 3. EXECUTE SEND
        if send_to_phone:
            self._send_sms_or_whatsapp(user.phone, subject, message)
            
        if send_to_email:
            self._send_email(user.email, subject, message)
            
        if not send_to_phone and not send_to_email:
            logger.warning(f"Could not route notification to User {user.id}. No valid contact method for preference '{preference}'.")
            
    def _send_sms_or_whatsapp(self, phone: str, subject: str, message: str):
        # Stub: Integrate real SMS/WhatsApp gateway here (Twilio, Termii, Hubtel)
        logger.info(f"[SMS/WhatsApp] To {phone}: {subject} - {message}")
        print(f"[SMS/WhatsApp] To {phone}: {subject} - {message}")
        
    def _send_email(self, email: str, subject: str, message: str):
        # Stub: Integrate real Email gateway here (SendGrid, Mailgun)
        logger.info(f"[EMAIL] To {email}: {subject} - {message}")
        print(f"[EMAIL] To {email}: {subject} - {message}")

# Singleton instance
notification_service = NotificationService()
