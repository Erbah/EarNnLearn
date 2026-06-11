import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "EarNnLearN API"
    
    # Database — defaults to SQLite for local dev
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///d:/PROJECTS/LearNnEarn/backend/ceditrees_dev.db")
    
    # Financial Configuration
    MASTER_SHARE: float = 0.05
    SELLER_SHARE: float = 0.70
    ANCESTOR_LEVELS: list[float] = [0.10, 0.07, 0.05, 0.03]
    
    # Security Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_key_change_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

settings = Settings()
