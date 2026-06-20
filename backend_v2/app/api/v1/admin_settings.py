"""
CediTrees 2.0 — Admin API Router
==================================
Full control center for the platform:
- System settings CRUD
- Code generation
- User management
- Tier configuration
- Season control
- Analytics overview
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from pydantic import BaseModel
from typing import Annotated
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import get_current_user, create_access_token, verify_password, get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.models.code import Code
from app.models.transaction import Transaction, ReferralIndex
from app.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season, CodeGenerationSession
from app.models.course import Course
from app.models.notification import Notification
from app.services.code_engine import generate_admin_rid
from app.services.ai_engine import ai_tutor_engine
from app.core.permissions import require_super_admin, require_education_admin, ROLE_SUPER_ADMIN, ROLE_EDUCATION_ADMIN

from app.schemas.admin_schema import *

router = APIRouter()


# ═══════════════════════════════════════
#  SYSTEM SETTINGS
# ═══════════════════════════════════════
@router.get("/settings", response_model=list[SettingOut])
def get_all_settings(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@router.put("/settings/{key}", response_model=SettingOut)
def update_setting(key: str, body: SettingUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', key):
        raise HTTPException(status_code=400, detail="Invalid setting key format")
        
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=body.value)
        db.add(setting)
    else:
        setting.value = body.value
    
    db.add(AdminLog(admin_rid=current_user.rid, action=f"Updated setting: {key}", details={"new_value": body.value}))
    db.commit()
    db.refresh(setting)
    return setting

@router.get("/settings/ai-suggest")
def get_ai_profit_suggestion(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Fetches AI suggestions for optimal profit distribution based on platform financial health."""
    from app.models.transaction import Transaction
    from app.models.wallet import Wallet, WithdrawalRequest
    from sqlalchemy.sql import func
    
    # 1. Aggregate Financial Data
    total_transactions = db.query(func.count(Transaction.id)).filter(Transaction.status == "success").scalar() or 0
    total_revenue = db.query(func.sum(Transaction.amount)).filter(Transaction.status == "success").scalar() or 0
    total_withdrawals = db.query(func.sum(WithdrawalRequest.amount)).filter(WithdrawalRequest.status == "APPROVED").scalar() or 0
    total_wallet_balance = db.query(func.sum(Wallet.balance)).scalar() or 0
    active_users = db.query(func.count(User.id)).scalar() or 0
    
    financial_context = {
        "total_transactions": int(total_transactions),
        "total_revenue": float(total_revenue),
        "total_withdrawals": float(total_withdrawals),
        "total_wallet_balance": float(total_wallet_balance),
        "active_users": int(active_users)
    }
    
    # 2. Call AI Engine
    from app.services.ai_engine import AITutorEngine
    suggestion = AITutorEngine.get_financial_profit_suggestion(db, financial_context)
    
    return suggestion


# ═══════════════════════════════════════
#  SYSTEM DATABASE EXPLORER
# ═══════════════════════════════════════
@router.get("/tables")
def list_tables(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """List all application tables in the database."""
    from sqlalchemy import text
    if db.bind.dialect.name == "postgresql":
        result = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE 'sql_%'"))
    else:
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
    tables = [row[0] for row in result.fetchall()]
    return tables

@router.get("/tables/{table_name}")
def get_table_data(table_name: str, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Get raw data from a specific table."""
    from sqlalchemy import text
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise HTTPException(status_code=400, detail="Invalid table name")
        
    try:
        if db.bind.dialect.name == "postgresql":
            col_res = db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table_name ORDER BY ordinal_position"
            ), {"table_name": table_name})
            columns = [row[0] for row in col_res.fetchall()]
        else:
            pragma_res = db.execute(text(f"PRAGMA table_info({table_name})"))
            columns = [row[1] for row in pragma_res.fetchall()]
        
        result = db.execute(text(f"SELECT * FROM {table_name} LIMIT 500"))
        rows = result.fetchall()
        
        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))
            
        return {"columns": columns, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════
#  ADMIN ACTIVITY LOGS
# ═══════════════════════════════════════
@router.get("/logs", response_model=list[AdminLogOut])
def get_admin_logs(current_user: Annotated[User, Depends(require_super_admin)], limit: int = 50, db: Session = Depends(get_db)):
    return db.query(AdminLog).order_by(desc(AdminLog.created_at)).limit(limit).all()


