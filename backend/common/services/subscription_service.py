from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from common.models.subscription import SeasonActivation

class SubscriptionService:
    """
    Manages access control based on user subscriptions (Season Activations).
    """

    def verify_active_subscription(self, db: Session, user_rid: str, season_id: str = "default"):
        """
        Validates that the user has an active activation for the specified season.
        Raises 403 Forbidden if not subscribed.
        """
        if not user_rid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account NOT activated. Please enter a product code to unlock this content."
            )

        activation = db.query(SeasonActivation).filter(
            SeasonActivation.user_rid == user_rid,
            SeasonActivation.season_id == season_id
        ).first()

        if not activation:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Subscription expired or missing for season: {season_id}. Please activate a new product code."
            )
        
        return activation

subscription_service = SubscriptionService()
