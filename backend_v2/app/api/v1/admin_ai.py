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
#  AI MODEL MANAGEMENT
# ═══════════════════════════════════════
@router.get("/ai-settings")
def get_ai_settings(current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Get active AI provider and model configuration."""
    
    provider = db.query(SystemSetting).filter(SystemSetting.key == "ai_provider").first()
    model = db.query(SystemSetting).filter(SystemSetting.key == "ai_model").first()
    base_url = db.query(SystemSetting).filter(SystemSetting.key == "ai_base_url").first()
    
    from app.core.config import Settings
    settings_obj = Settings()
    
    return {
        "active_provider": provider.value if provider else settings_obj.AI_PROVIDER,
        "active_model": model.value if model else settings_obj.AI_MODEL,
        "active_base_url": base_url.value if base_url else None,
        "is_custom": provider is not None or model is not None
    }

@router.put("/ai-settings")
def update_ai_settings(body: AIConfigUpdate, current_user: Annotated[User, Depends(require_super_admin)], db: Session = Depends(get_db)):
    """Dynamically switch AI models and providers (Qwen, DeepSeek, Ollama, etc.)"""
    
    ALLOWED_PROVIDERS = {"openai", "google", "ollama", "deepseek", "anthropic"}
    if body.provider and body.provider.lower() not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid AI provider. Allowed: {', '.join(ALLOWED_PROVIDERS)}")
    
    # 1. Update Provider
    provider_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_provider").first()
    if not provider_setting:
        provider_setting = SystemSetting(key="ai_provider", value=body.provider, description="Active AI Provider (openai, google, deepseek, ollama, etc.)")
        db.add(provider_setting)
    else:
        provider_setting.value = body.provider
        
    # 2. Update Model
    model_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_model").first()
    if not model_setting:
        model_setting = SystemSetting(key="ai_model", value=body.model, description="Specific LLM Model String")
        db.add(model_setting)
    else:
        model_setting.value = body.model
        
    # 3. Optional: Update Global API Key if provided
    if body.api_key:
        key_setting = db.query(SystemSetting).filter(SystemSetting.key == "AI_API_KEY").first()
        if not key_setting:
            key_setting = SystemSetting(key="AI_API_KEY", value=body.api_key, description="Universal AI API Key override")
            db.add(key_setting)
        else:
            key_setting.value = body.api_key
            
    # 4. Optional: Update Base URL (for Ollama Cloud / Self-hosted)
    if body.base_url:
        url_setting = db.query(SystemSetting).filter(SystemSetting.key == "ai_base_url").first()
        if not url_setting:
            url_setting = SystemSetting(key="ai_base_url", value=body.base_url, description="Base URL for AI Provider (e.g. Ollama Cloud)")
            db.add(url_setting)
        else:
            url_setting.value = body.base_url

    db.add(AdminLog(admin_rid=current_user.rid, action="Updated AI Master Strategy", details={"provider": body.provider, "model": body.model}))
    db.commit()
    
    return {"status": "success", "message": f"AI Strategy updated to {body.model} via {body.provider}"}


