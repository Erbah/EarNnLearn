from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Season, User, Wallet

class SeasonEngine:
    """
    Manages the platform's seasonal lifecycle.
    """

    @staticmethod
    def get_active_season(db: Session) -> Season:
        return db.query(Season).filter(Season.is_active == True).first()

    @staticmethod
    def start_new_season(db: Session, name: str):
        """
        Closes the current season and starts a new one.
        """
        # 1. Close current active season
        current = SeasonEngine.get_active_season(db)
        if current:
            current.is_active = False
            current.end_date = datetime.utcnow()
            db.flush()

        # 2. Create new season
        new_season = Season(
            name=name,
            start_date=datetime.utcnow(),
            is_active=True,
            previous_season_id=current.id if current else None
        )
        db.add(new_season)
        
        # 3. Handle carry-overs or resets if necessary
        # For now, we just create the record.
        
        db.commit()
        return new_season

    @staticmethod
    def get_leaderboard(db: Session, limit: int = 10):
        """
        Retrieves top earners based on wallet balance for the current season.
        Note: In a real prod systm, we'd use a dedicated 'season_earnings' column.
        """
        return db.query(User, Wallet).join(Wallet, User.id == Wallet.user_id)\
                 .order_by(Wallet.balance.desc())\
                 .limit(limit).all()

season_engine = SeasonEngine()
