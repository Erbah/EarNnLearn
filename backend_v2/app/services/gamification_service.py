from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User

class GamificationService:
    """
    Handles the psychological and behavioral incentives of the platform.
    Elite Refinements (v9): Difficulty Scaling, Multipliers, and 36h Grace.
    """
    
    @staticmethod
    def award_xp(db: Session, user: User, amount: int = 100, difficulty: str = "medium", is_first_attempt: bool = False):
        """
        Awards XP with difficulty scaling and bonuses.
        - Easy: 60 XP
        - Medium: 100 XP
        - Hard: 150 XP
        - First Attempt Bonus: +20 XP
        - Streak Multiplier: x1.2 if streak >= 3
        """
        # 1. Base Scaling
        base_amounts = {
            "easy": 60,
            "medium": 100,
            "intermediate": 100,
            "hard": 150,
            "advanced": 150
        }
        scaled_base = base_amounts.get(difficulty.lower(), 100)
        
        # 2. Bonuses
        bonus = 20 if is_first_attempt else 0
        
        # 3. Multipliers
        multiplier = 1.2 if (user.current_streak or 0) >= 3 else 1.0
        
        total_award = int((scaled_base + bonus) * multiplier)
        
        user.total_xp = (user.total_xp or 0) + total_award
        
        # Level formula: 100 * (level ^ 1.5)
        next_level_xp = int(100 * (user.level ** 1.5))
        
        if user.total_xp >= next_level_xp:
            user.level += 1
            # Level-up triggers would be handled here (notifications, etc)
            
        return total_award

    @staticmethod
    def update_streak(db: Session, user: User):
        """
        Maintains the daily streak with a 36-hour grace window.
        - If active within last 24h: streak maintained/incremented.
        - If active between 24h and 36h: streak MAINTAINED (grace).
        - If inactive > 36h: streak resets.
        """
        now = datetime.utcnow()
        last_active = user.last_active_at or user.created_at or now
        delta = now - last_active
        
        hours_since_active = delta.total_seconds() / 3600
        
        if hours_since_active <= 24:
            # Active within the same day or just slightly over -> Increment if new UTC day
            # Heuristic: if it's been more than 12 hours, increment; otherwise just keep same.
            if hours_since_active > 12:
                user.current_streak = (user.current_streak or 0) + 1
        elif 24 < hours_since_active <= 36:
            # Grace window: Still maintain streak, but don't reset yet.
            # Increment on action within this window.
            user.current_streak = (user.current_streak or 0) + 1
        else:
            # Harsh reset after 36 hours of inactivity
            user.current_streak = 0
            
        user.last_active_at = now
        return user.current_streak

    @staticmethod
    def consume_heart(db: Session, user: User):
        """Consumes a life (Heart) for incorrect answers."""
        if (user.hearts or 0) > 0:
            user.hearts -= 1
        return user.hearts

    @staticmethod
    def regenerate_hearts(db: Session, user: User):
        """1 heart every 4 hours. Passive regeneration."""
        if (user.hearts or 0) >= 5:
            user.hearts = 5
            return 5
            
        now = datetime.utcnow()
        last_active = user.last_active_at or user.created_at or now
        hours_passed = (now - last_active).total_seconds() / 3600
        
        hearts_to_add = int(hours_passed // 4)
        if hearts_to_add > 0:
            user.hearts = min(5, (user.hearts or 0) + hearts_to_add)
            
        return user.hearts
