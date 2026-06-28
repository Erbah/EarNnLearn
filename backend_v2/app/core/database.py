import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings, sanitize_secrets

_logger = logging.getLogger(__name__)

connect_args = {}
if settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

engine_kwargs = {"pool_pre_ping": True}
if not settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args=connect_args,
    **engine_kwargs
)
_logger.debug("SQLAlchemy connecting to: %s", sanitize_secrets(settings.SQLALCHEMY_DATABASE_URI))

# Enable WAL mode for SQLite for better concurrent access
if settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
