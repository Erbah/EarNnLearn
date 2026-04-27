from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.session import get_db
from app.services.ingestion_service import ingestion_service
from app.services.code_engine import code_engine
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter(prefix="/admin", tags=["admin"])

class IngestRequest(BaseModel):
    playlist_url: str
    creator_rid: str
    category: str = "General"
    price: float = 0.0

class CodeUpdateRequest(BaseModel):
    tier_type: str

class CodeGenerateRequest(BaseModel):
    count: int = 10
    tier_type: str = "public"
    price: float = 20.0

class SettingUpdate(BaseModel):
    value: str

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    from app.models import User, Activation, Transaction, GeneratedRid, ProfitDistribution, NetworkTree
    
    total_users = db.query(User).count()
    activated_users = db.query(Activation).count()
    
    total_revenue = db.query(func.sum(Transaction.amount)).filter(Transaction.status == "success").scalar() or 0.0
    total_payouts = db.query(func.sum(ProfitDistribution.amount)).scalar() or 0.0
    
    codes_used = db.query(GeneratedRid).filter(GeneratedRid.is_used == True).count()
    codes_available = db.query(GeneratedRid).filter(GeneratedRid.is_used == False).count()
    
    top_promoters_raw = db.query(
        NetworkTree.parent_id, 
        func.count(NetworkTree.id).label("ref_count")
    ).filter(NetworkTree.parent_id != None).group_by(NetworkTree.parent_id).order_by(func.count(NetworkTree.id).desc()).limit(5).all()
    
    top_promoters = []
    for p_id, count in top_promoters_raw:
        user = db.query(User).filter(User.id == p_id).first()
        if user:
            top_promoters.append({
                "rid": user.username or user.email,
                "network_size": count
            })

    return {
        "total_users": total_users,
        "activated_users": activated_users,
        "total_revenue": float(total_revenue),
        "total_payouts": float(total_payouts),
        "codes_used": codes_used,
        "codes_available": codes_available,
        "top_promoters": top_promoters
    }

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    from app.models import User, Activation
    users = db.query(User).all()
    result = []
    for u in users:
        is_active = db.query(Activation).filter(Activation.user_id == u.id).first() is not None
        result.append({
            "name": u.display_name or u.username,
            "email": u.email,
            "rid": u.username,
            "tier_type": "standard",
            "status": "active" if is_active else "pending"
        })
    return result

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    from app.models import SystemSettings
    if db.query(SystemSettings).count() == 0:
        defaults = [
            SystemSettings(key="MIN_CODE_PRICE", value="20", description="Minimum price for a unique code"),
            SystemSettings(key="PLATFORM_STATUS", value="online", description="Overall platform availability"),
            SystemSettings(key="CURRENCY", value="GHS", description="Primary platform currency")
        ]
        db.add_all(defaults)
        db.commit()
    return db.query(SystemSettings).all()

@router.put("/settings/{key}")
def update_setting(key: str, req: SettingUpdate, db: Session = Depends(get_db)):
    from app.models import SystemSettings, ActivityLog
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    setting.value = req.value
    db.commit()
    
    log = ActivityLog(action=f"Updated setting: {key}", details=json.dumps({"new_value": req.value}))
    db.add(log)
    db.commit()
    return {"status": "success"}

@router.get("/logs")
def get_logs(db: Session = Depends(get_db)):
    from app.models import ActivityLog
    return db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(50).all()

@router.get("/codes")
def list_codes(db: Session = Depends(get_db), search: Optional[str] = None):
    from app.models import GeneratedRid
    query = db.query(GeneratedRid)
    if search:
        query = query.filter(GeneratedRid.rid_code.ilike(f"%{search}%"))
    return query.order_by(GeneratedRid.created_at.desc()).all()

@router.get("/codes/stats")
def get_code_stats(db: Session = Depends(get_db)):
    from app.models import GeneratedRid
    total = db.query(GeneratedRid).count()
    used = db.query(GeneratedRid).filter(GeneratedRid.is_used == True).count()
    unused = total - used
    return {
        "total": total,
        "used": used,
        "unused": unused
    }

@router.post("/codes/generate")
def generate_codes(req: CodeGenerateRequest, db: Session = Depends(get_db)):
    from app.models import ActivityLog
    try:
        rids = code_engine.generate_batch_rids(
            db, 
            count=req.count, 
            tier_type=req.tier_type, 
            price=req.price
        )
        log = ActivityLog(action="Generated RIDs", details=json.dumps({"count": req.count, "tier": req.tier_type}))
        db.add(log)
        db.commit()
        return {
            "status": "success", 
            "generated": len(rids),
            "codes": [r.rid_code for r in rids]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/codes/{code_id}")
def update_code(code_id: int, req: CodeUpdateRequest, db: Session = Depends(get_db)):
    from app.models import GeneratedRid, ActivityLog
    try:
        code = db.query(GeneratedRid).filter(GeneratedRid.id == code_id).first()
        if not code:
            raise HTTPException(status_code=404, detail="Code not found")
        
        old_tier = code.tier_type
        code.tier_type = req.tier_type
        db.commit()
        
        log = ActivityLog(action=f"Updated code tier: {code.rid_code}", details=json.dumps({"old": old_tier, "new": req.tier_type}))
        db.add(log)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
def ingest_playlist(req: IngestRequest, db: Session = Depends(get_db)):
    try:
        course = ingestion_service.ingest_as_course(
            db=db,
            playlist_url=req.playlist_url,
            creator_rid=req.creator_rid,
            category=req.category,
            price=req.price
        )
        return {"status": "success", "course_id": course.id, "title": course.title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
