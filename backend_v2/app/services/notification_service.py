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
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            if send_to_phone:
                self._send_sms_or_whatsapp(db, user.phone, subject, message)
                
            if send_to_email:
                self._send_email(db, user.email, subject, message)
                
            if not send_to_phone and not send_to_email:
                logger.warning(f"Could not route notification to User {user.id}. No valid contact method for preference '{preference}'.")
        finally:
            db.close()
            
    def _send_sms_or_whatsapp(self, db, phone: str, subject: str, message: str):
        # Stub: Integrate real SMS/WhatsApp gateway here (Twilio, Termii, Hubtel)
        logger.info(f"[SMS/WhatsApp] To {phone}: {subject} - {message}")
        print(f"[SMS/WhatsApp] To {phone}: {subject} - {message}")
        
        # Log Cost
        from app.models.admin import PlatformExpense
        from app.core.config import settings
        expense = PlatformExpense(
            expense_type="SMS_WHATSAPP_NOTIFICATION",
            amount=settings.SMS_COST,
            description=f"Notification sent to {phone}"
        )
        db.add(expense)
        db.commit()
        
    def _send_email(self, db, email: str, subject: str, message: str):
        # Stub: Integrate real Email gateway here (SendGrid, Mailgun)
        logger.info(f"[EMAIL] To {email}: {subject} - {message}")
        print(f"[EMAIL] To {email}: {subject} - {message}")
        
        # Log Cost
        from app.models.admin import PlatformExpense
        from app.core.config import settings
        expense = PlatformExpense(
            expense_type="EMAIL_NOTIFICATION",
            amount=settings.EMAIL_COST,
            description=f"Notification sent to {email}"
        )
        db.add(expense)
        db.commit()

    def send_in_app_notification(self, db, user_rid: str | None, title: str, message: str, type: str = "SYSTEM", link: str | None = None):
        """
        Create a new in-app notification in the database.
        If user_rid is None, it is treated as a global announcement for all users.
        """
        from app.models.notification import Notification
        
        note = Notification(
            user_rid=user_rid,
            title=title,
            message=message,
            type=type,
            link=link
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

# Singleton instance
notification_service = NotificationService()
