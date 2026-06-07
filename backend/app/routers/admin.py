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

class ElevateRequest(BaseModel):
    admin_password: str

class AdminLoginRequest(BaseModel):
    admin_password: str

class CredentialUpdateRequest(BaseModel):
    current_password: str
    new_password: str

from app.core.security import get_current_user, ADMIN_SECRET

@router.post("/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    from app.models import SystemSettings
    from app.core.security import verify_password, create_access_token, ADMIN_SECRET
    
    setting = db.query(SystemSettings).filter(SystemSettings.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(req.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        if req.admin_password != ADMIN_SECRET:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
            
    token = create_access_token(data={"sub": "superadmin", "role": "admin"})
    return {"status": "authenticated", "token": token}

@router.post("/elevate")
def elevate_to_admin(req: ElevateRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models import SystemSettings
    from app.core.security import verify_password, create_access_token, ADMIN_SECRET
    
    setting = db.query(SystemSettings).filter(SystemSettings.key == "ADMIN_PASSWORD").first()
    
    if setting:
        if not verify_password(req.admin_password, setting.value):
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    else:
        if req.admin_password != ADMIN_SECRET:
            raise HTTPException(status_code=403, detail="Invalid admin credential")
    
    user.role = "admin"
    db.commit()
    
    # Re-issue token with admin role
    new_token = create_access_token(data={"sub": user.email or user.rid, "role": "admin"})
    
    return {"status": "elevated", "role": "admin", "token": new_token}

@router.put("/credentials")
def update_admin_credentials(req: CredentialUpdateRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    from app.models import SystemSettings
    from app.core.security import verify_password, get_password_hash
    
    setting = db.query(SystemSettings).filter(SystemSettings.key == "ADMIN_PASSWORD").first()
    
    # If not in DB, check against bootstrap secret
    if not setting:
        if req.current_password != ADMIN_SECRET:
            raise HTTPException(status_code=403, detail="Current password incorrect")
        setting = SystemSettings(key="ADMIN_PASSWORD", value=get_password_hash(req.new_password), description="Admin Master Password")
        db.add(setting)
    else:
        if not verify_password(req.current_password, setting.value):
            raise HTTPException(status_code=403, detail="Current password incorrect")
        setting.value = get_password_hash(req.new_password)
        
    db.commit()
    return {"status": "success", "detail": "Admin credentials updated"}

@router.get("/analytics")
def get_analytics(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
                "rid": user.rid or user.email,
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
def list_users(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import User, Activation
    users = db.query(User).all()
    result = []
    for u in users:
        is_active = db.query(Activation).filter(Activation.user_id == u.id).first() is not None
        result.append({
            "name": u.display_name or u.rid,
            "email": u.email,
            "rid": u.rid,
            "tier_type": "standard",
            "status": "active" if is_active else "pending"
        })
    return result

@router.get("/settings")
def get_settings(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
def update_setting(key: str, req: SettingUpdate, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
def get_logs(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import ActivityLog
    return db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(50).all()

@router.get("/codes")
def list_codes(user = Depends(get_current_user), db: Session = Depends(get_db), search: Optional[str] = None):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import GeneratedRid
    query = db.query(GeneratedRid)
    if search:
        query = query.filter(GeneratedRid.rid_code.ilike(f"%{search}%"))
    return query.order_by(GeneratedRid.created_at.desc()).all()

@router.get("/codes/stats")
def get_code_stats(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
def generate_codes(req: CodeGenerateRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
def update_code(code_id: int, req: CodeUpdateRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
def ingest_playlist(req: IngestRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
@router.get("/users/{rid}")
def get_user_dossier(rid: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import User, Wallet, Activation, GeneratedRid, NetworkTree
    
    db_user = db.query(User).filter(User.rid == rid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    wallet = db.query(Wallet).filter(Wallet.user_id == db_user.id).first()
    activations = db.query(Activation).filter(Activation.user_id == db_user.id).all()
    codes_count = db.query(GeneratedRid).filter(GeneratedRid.creator_rid == rid).count()
    codes_unused = db.query(GeneratedRid).filter(GeneratedRid.creator_rid == rid, GeneratedRid.is_used == False).count()
    
    node = db.query(NetworkTree).filter(NetworkTree.user_id == db_user.id).first()
    
    return {
        "user": {
            "name": db_user.name,
            "display_name": db_user.display_name,
            "email": db_user.email,
            "rid": db_user.rid,
            "tier_type": db_user.tier_type,
            "status": db_user.status or "active"
        },
        "wallet": {
            "balance": float(wallet.balance) if wallet else 0.0,
            "withdrawable": float(wallet.balance) * 0.8 if wallet else 0.0
        },
        "activations": len(activations),
        "codes_count": codes_count,
        "codes_unused": codes_unused,
        "children_count": db.query(NetworkTree).filter(NetworkTree.parent_id == db_user.id).count(),
        "depth": node.depth if node else 0,
        "path": node.path if node else ""
    }

@router.post("/users/{rid}/adjust-wallet")
def adjust_wallet(rid: str, amount: float, reason: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import User, Wallet, WalletTransaction, ActivityLog
    
    db_user = db.query(User).filter(User.rid == rid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    wallet = db.query(Wallet).filter(Wallet.user_id == db_user.id).first()
    if not wallet:
        wallet = Wallet(user_id=db_user.id, balance=0.0)
        db.add(wallet)
    
    wallet.balance += amount
    
    tx = WalletTransaction(
        wallet_id=wallet.id,
        amount=amount,
        type="adjustment",
        description=f"Admin Adjustment: {reason}",
        status="success"
    )
    db.add(tx)
    
    log = ActivityLog(action=f"Adjusted wallet for {rid}", details=json.dumps({"amount": amount, "reason": reason}))
    db.add(log)
    db.commit()
    return {"status": "success", "new_balance": float(wallet.balance)}

@router.get("/withdrawals/pending")
def list_pending_withdrawals(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import Withdrawal, User
    results = db.query(Withdrawal).filter(Withdrawal.status == "pending").all()
    
    payouts = []
    for r in results:
        u = db.query(User).filter(User.id == r.user_id).first()
        payouts.append({
            "id": r.id,
            "user_id": r.user_id,
            "user_rid": u.rid if u else "Unknown",
            "amount": float(r.amount),
            "payout_method": r.payout_method,
            "payout_details": r.payout_details if isinstance(r.payout_details, dict) else json.loads(r.payout_details or "{}"),
            "status": r.status,
            "created_at": r.created_at
        })
    return payouts

@router.post("/withdrawals/{withdrawal_id}/{action}")
def process_withdrawal(withdrawal_id: int, action: str, reason: Optional[str] = None, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import Withdrawal, ActivityLog
    
    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
        
    if action == "approve":
        withdrawal.status = "approved"
    elif action == "reject":
        withdrawal.status = "rejected"
        withdrawal.rejection_reason = reason
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    db.commit()
    log = ActivityLog(action=f"{action.capitalize()}d withdrawal {withdrawal_id}", details=json.dumps({"reason": reason}))
    db.add(log)
    db.commit()
    return {"status": "success"}

@router.get("/codes/sessions")
def list_generation_sessions(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import ActivityLog
    logs = db.query(ActivityLog).filter(ActivityLog.action == "Generated RIDs").order_by(ActivityLog.created_at.desc()).limit(20).all()
    return logs

@router.delete("/codes/purge-unused")
def purge_unused_codes(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import GeneratedRid, ActivityLog
    deleted = db.query(GeneratedRid).filter(GeneratedRid.is_used == False).delete()
    db.commit()
    log = ActivityLog(action="Purged all unused RIDs", details=json.dumps({"count": deleted}))
    db.add(log)
    db.commit()
    return {"status": "success", "deleted_count": deleted}

@router.get("/ai/strategy")
def get_ai_strategy(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        "health_score": 85,
        "global_recommendation": "All systems operational. Consider increasing 'standard' tier code generation for Season 5.",
        "suggested_config": {
            "primary_model": "gemini-1.5-pro",
            "fallback_model": "gemini-1.5-flash"
        }
    }

@router.get("/ai-settings")
def get_ai_settings(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import SystemSettings
    provider = db.query(SystemSettings).filter(SystemSettings.key == "AI_PROVIDER").first()
    model = db.query(SystemSettings).filter(SystemSettings.key == "AI_MODEL").first()
    base_url = db.query(SystemSettings).filter(SystemSettings.key == "AI_BASE_URL").first()
    
    return {
        "active_provider": provider.value if provider else "google",
        "active_model": model.value if model else "gemini/gemini-1.5-flash",
        "active_base_url": base_url.value if base_url else ""
    }

@router.put("/ai-settings")
def update_ai_settings(req: dict, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models import SystemSettings
    
    updates = {
        "AI_PROVIDER": req.get("provider"),
        "AI_MODEL": req.get("model"),
        "AI_BASE_URL": req.get("base_url")
    }
    
    for k, v in updates.items():
        if v is not None:
            setting = db.query(SystemSettings).filter(SystemSettings.key == k).first()
            if not setting:
                setting = SystemSettings(key=k, value=v)
                db.add(setting)
            else:
                setting.value = v
    
    db.commit()
    return {"status": "success"}

@router.get("/tables")
def list_db_tables(user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from sqlalchemy import text
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    return [row[0] for row in result.all()]

@router.get("/tables/{table_name}")
def get_table_data(table_name: str, limit: int = 100, user = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from sqlalchemy import text
    tables_res = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    valid_tables = [row[0] for row in tables_res.all()]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail="Invalid table name")
        
    result = db.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
    columns = result.keys()
    data = [dict(zip(columns, row)) for row in result.all()]
    return {
        "table": table_name,
        "columns": list(columns),
        "data": data
    }
