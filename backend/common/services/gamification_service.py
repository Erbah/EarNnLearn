from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from common.models.user import User

class GamificationService:
    """
    Handles the psychological and behavioral incentives of the platform.
    """
    
    @staticmethod
    def award_xp(db: Session, user: User, amount: int):
        """
        Awards XP and handles level-up logic.
        Level formula: 100 * (level ^ 1.5)
        """
        user.total_xp += amount
        
        # Simple power-law leveling
        next_level_xp = 100 * (user.level ** 1.5)
        
        if user.total_xp >= next_level_xp:
            user.level += 1
            # In a real app, trigger a 'Level Up' event or notification
            
        return user.level

    @staticmethod
    def update_streak(db: Session, user: User):
        """
        Maintains the daily streak.
        - If active within last 24h: streak maintained/incremented.
        - If active between 24h and 48h: Wait for today's action.
        - If inactive > 48h: streak resets to zero.
        """
        now = datetime.utcnow()
        last_active = user.last_active_at or user.created_at
        delta = now - last_active
        
        if delta.days == 1:
            # Active yesterday, still active today -> Increment
            user.current_streak += 1
        elif delta.days > 1:
            # Missed a whole day -> Reset
            user.current_streak = 0
            
        user.last_active_at = now
        return user.current_streak

    @staticmethod
    def consume_heart(db: Session, user: User):
        """
        Consumes a life (Heart) for incorrect answers.
        """
        if user.hearts > 0:
            user.hearts -= 1
        return user.hearts

    @staticmethod
    def regenerate_hearts(db: Session, user: User):
        """
        Passive heart regeneration.
        1 heart every 4 hours.
        """
        if user.hearts >= 5:
            return 5
            
        now = datetime.utcnow()
        last_active = user.last_active_at
        hours_passed = (now - last_active).total_seconds() / 3600
        
        hearts_to_add = int(hours_passed // 4)
        if hearts_to_add > 0:
            user.hearts = min(5, user.hearts + hearts_to_add)
            
        return user.hearts
