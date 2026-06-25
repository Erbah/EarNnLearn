import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "CediTrees 2.0"
    API_V1_STR: str = "/api/v1"
    TESTING: bool = False
    PRODUCTION: bool = False
    ENFORCE_HTTPS: bool = True
    
    SECRET_KEY: str = "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Root User Seeding
    ROOT_USER_EMAIL: str = "root@ceditrees.com"
    ROOT_USER_PASSWORD: str = "rootpass123"
    
    # CORS Configuration — include both localhost dev and Railway production frontend
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,https://earnnlearn.up.railway.app,https://www.earnnlearn.up.railway.app,https://earnnnlearn.up.railway.app,https://www.earnnnlearn.up.railway.app"
    
    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.PRODUCTION:
            if self.SECRET_KEY == "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD":
                raise ValueError("SECRET_KEY must be set in production!")
            if self.ROOT_USER_PASSWORD == "rootpass123":
                raise ValueError("ROOT_USER_PASSWORD must be changed in production!")
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters.")
        return self

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        origins = [s.strip() for s in self.BACKEND_CORS_ORIGINS.split(",") if s.strip()]
        if not origins:
            import logging
            logging.getLogger(__name__).error("BACKEND_CORS_ORIGINS is not configured. CORS will reject all origins.")
            return []  # Fail-closed: deny all rather than allow all
        return origins

    # Database
    DATABASE_BACKEND: str = "sqlite"
    DATABASE_URL: str = ""
    
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "ceditrees"
    
    REDIS_URL: str = "redis://localhost:6379/0"

    # Payment Gateways — pydantic-settings reads these directly from environment
    STRIPE_SECRET_KEY: str = ""
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_SECRET: str = ""
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_PUBLIC_KEY: str = ""

    # AI Configuration
    AI_PROVIDER: str = "mock"
    AI_MODEL: str = "gemini/gemini-2.0-flash"
    
    GOOGLE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    AI_API_KEY: str = ""
    INITIAL_ADMIN_PASSWORD: str = ""

    # Platform Percentages
    SELLER_PERCENTAGE: float = 0.70
    MASTER_PERCENTAGE: float = 0.05
    FAMILY_PERCENTAGE: float = 0.25

    # Notification Costs
    SMS_COST: float = 0.05
    EMAIL_COST: float = 0.005

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Prefer explicit DATABASE_URL (set by Railway/Heroku)
        db_url = self.DATABASE_URL or os.getenv("DATABASE_URL", "")
        if db_url:
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql://", 1)
            return db_url

        if self.DATABASE_BACKEND == "sqlite":
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "ceditrees_dev.db")
            db_path_fixed = db_path.replace("\\", "/")
            return f"sqlite:///{db_path_fixed}"
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

def sanitize_secrets(value: any) -> str:
    """Sanitizes sensitive information from string/exception messages."""
    text = str(value)
    if settings.POSTGRES_PASSWORD and settings.POSTGRES_PASSWORD != "password":
        text = text.replace(settings.POSTGRES_PASSWORD, "********")
    if settings.SECRET_KEY and settings.SECRET_KEY != "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD":
        text = text.replace(settings.SECRET_KEY, "********")
    if settings.STRIPE_SECRET_KEY:
        text = text.replace(settings.STRIPE_SECRET_KEY, "********")
    if settings.PAYSTACK_SECRET_KEY:
        text = text.replace(settings.PAYSTACK_SECRET_KEY, "********")
    for key in [settings.GOOGLE_API_KEY, settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY,
                settings.DEEPSEEK_API_KEY, settings.AI_API_KEY, settings.INITIAL_ADMIN_PASSWORD]:
        if key:
            text = text.replace(key, "********")
    return text
