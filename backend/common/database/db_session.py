from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from common.core.config import settings

connect_args = {}
if settings.DATABASE_BACKEND == "sqlite":
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    connect_args=connect_args
)

# Enable WAL mode for SQLite for better concurrent access
if settings.DATABASE_BACKEND == "sqlite":
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
