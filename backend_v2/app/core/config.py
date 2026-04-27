import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CediTrees 2.0"
    API_V1_STR: str = "/api/v1"
    TESTING: bool = False
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_FOR_JWT_SIGNATURE_OVERRIDE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database — defaults to SQLite for local dev, override with env vars for Postgres in prod
    DATABASE_BACKEND: str = os.getenv("DATABASE_BACKEND", "sqlite")
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "password")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "ceditrees")
    
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Payment Gateways
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    PAYPAL_CLIENT_ID: str = os.getenv("PAYPAL_CLIENT_ID", "")
    PAYPAL_SECRET: str = os.getenv("PAYPAL_SECRET", "")
    PAYSTACK_SECRET_KEY: str = os.getenv("PAYSTACK_SECRET_KEY", "")
    PAYSTACK_PUBLIC_KEY: str = os.getenv("PAYSTACK_PUBLIC_KEY", "")

    # AI Configuration (LiteLLM)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock") # mock, google, openai, anthropic, deepseek
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini/gemini-2.0-flash")
    
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")

    # Platform Percentages
    SELLER_PERCENTAGE: float = float(os.getenv("SELLER_PERCENTAGE", "0.70"))
    MASTER_PERCENTAGE: float = float(os.getenv("MASTER_PERCENTAGE", "0.05"))
    FAMILY_PERCENTAGE: float = float(os.getenv("FAMILY_PERCENTAGE", "0.25"))

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_BACKEND == "sqlite":
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "ceditrees_dev.db")
            # Replace backslashes with forward slashes for SQLAlchemy
            db_path_fixed = db_path.replace("\\", "/")
            return f"sqlite:///{db_path_fixed}"
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()
