import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CediTrees 2.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_FOR_JWT_SIGNATURE_OVERRIDE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database — defaults to SQLite for local dev, override with env vars for Postgres in prod
    DATABASE_BACKEND: str = os.getenv("DATABASE_BACKEND", "sqlite")
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "password")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "ceditrees")
    
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_BACKEND == "sqlite":
            return "sqlite:///ceditrees_dev.db"
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()
