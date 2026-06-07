import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CediTrees 2.0"
    API_V1_STR: str = "/api/v1"
    TESTING: bool = False
    ENFORCE_HTTPS: bool = os.getenv("ENFORCE_HTTPS", "False").lower() in ("true", "1", "yes")
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Root User Seeding
    ROOT_USER_EMAIL: str = os.getenv("ROOT_USER_EMAIL", "root@ceditrees.com")
    ROOT_USER_PASSWORD: str = os.getenv("ROOT_USER_PASSWORD", "rootpass123")
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: str = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://[::1]:3000,http://[::1]:3001,http://[::1]:3002")
    
    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [s.strip() for s in self.BACKEND_CORS_ORIGINS.split(",") if s.strip()]

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
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")
    INITIAL_ADMIN_PASSWORD: str = os.getenv("INITIAL_ADMIN_PASSWORD", "")

    # Platform Percentages
    SELLER_PERCENTAGE: float = float(os.getenv("SELLER_PERCENTAGE", "0.70"))
    MASTER_PERCENTAGE: float = float(os.getenv("MASTER_PERCENTAGE", "0.05"))
    FAMILY_PERCENTAGE: float = float(os.getenv("FAMILY_PERCENTAGE", "0.25"))

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            # Railway/Heroku provide DATABASE_URL. SQLAlchemy requires postgresql:// instead of postgres://
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql://", 1)
            return db_url

        if self.DATABASE_BACKEND == "sqlite":
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "ceditrees_dev.db")
            # Replace backslashes with forward slashes for SQLAlchemy
            db_path_fixed = db_path.replace("\\", "/")
            return f"sqlite:///{db_path_fixed}"
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()

def sanitize_secrets(value: any) -> str:
    """Sanitizes sensitive information from string/exception messages."""
    text = str(value)
    # Mask Postgres Password
    if settings.POSTGRES_PASSWORD and settings.POSTGRES_PASSWORD != "password":
        text = text.replace(settings.POSTGRES_PASSWORD, "********")
    # Mask Secret Key
    if settings.SECRET_KEY and settings.SECRET_KEY != "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD":
        text = text.replace(settings.SECRET_KEY, "********")
    # Mask Stripe Key
    if settings.STRIPE_SECRET_KEY:
        text = text.replace(settings.STRIPE_SECRET_KEY, "********")
    # Mask Paystack Key
    if settings.PAYSTACK_SECRET_KEY:
        text = text.replace(settings.PAYSTACK_SECRET_KEY, "********")
    # Mask AI and Admin Keys
    for key in [settings.GOOGLE_API_KEY, settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.DEEPSEEK_API_KEY, settings.AI_API_KEY, settings.INITIAL_ADMIN_PASSWORD]:
        if key:
            text = text.replace(key, "********")
    return text

