
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.code import Code
from app.models.admin import SystemSetting
from app.services.ai_engine import AITutorEngine
import os

def setup_settings(db: Session, provider: str, model: str, api_key: str = None):
    # Update or create settings
    settings = {
        "ai_provider": provider,
        "ai_model": model,
        "AI_API_KEY": api_key
    }
    
    for key, value in settings.items():
        if value is None:
            db.query(SystemSetting).filter(SystemSetting.key == key).delete()
            continue
            
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(SystemSetting(key=key, value=value))
    db.commit()

def test_dynamic_resolution():
    db = SessionLocal()
    try:
        print("--- Testing Mock Provider ---")
        setup_settings(db, "mock", "mock-model")
        
        # Test chat (should hit _mock_chat_fallback)
        context = {"topic": "Python", "tutor_role": "tutor"}
        resp = AITutorEngine.chat("Hello", context, db)
        print(f"Mock Response: {resp}")
        assert "Python" in resp or "help" in resp or "tutor" in resp.lower()

        print("\n--- Testing Model/Key Resolution ---")
        # We won't actually call a real AI here to avoid using credits, 
        # but we can verify the _get_active_model logic
        active_provider, active_model, active_api_key = AITutorEngine._get_active_model(db)
        print(f"Active Provider: {active_provider}")
        print(f"Active Model: {active_model}")
        print(f"Active API Key: {active_api_key}")
        
        assert active_provider == "mock"
        assert active_model == "mock-model"
        assert active_api_key is None

        print("\n--- Testing Custom API Key ---")
        setup_settings(db, "openai", "gpt-4o", "sk-custom-key")
        active_provider, active_model, active_api_key = AITutorEngine._get_active_model(db)
        print(f"Active API Key: {active_api_key}")
        assert active_api_key == "sk-custom-key"
        
        print("\nVerification Successful!")
        
    finally:
        # Cleanup
        setup_settings(db, None, None, None)
        db.close()

if __name__ == "__main__":
    test_dynamic_resolution()
