from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.season_engine import season_engine
from pydantic import BaseModel

router = APIRouter(prefix="/seasons", tags=["seasons"])

class SeasonCreate(BaseModel):
    name: str

@router.get("/active")
def get_active_season(db: Session = Depends(get_db)):
    season = season_engine.get_active_season(db)
    if not season:
        raise HTTPException(status_code=404, detail="No active season found")
    return season

@router.post("/start")
def start_season(req: SeasonCreate, db: Session = Depends(get_db)):
    try:
        season = season_engine.start_new_season(db, req.name)
        return {"status": "success", "season_id": season.id, "name": season.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/leaderboard")
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    results = season_engine.get_leaderboard(db, limit)
    return [
        {
            "user_id": user.id,
            "username": user.username,
            "balance": float(wallet.balance)
        } for user, wallet in results
    ]
