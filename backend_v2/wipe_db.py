import os
import sys

# Add the backend directory to python path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal, engine
from main import startup_logic

def wipe_database():
    db = SessionLocal()
    try:
        print("Disabling foreign key checks for dropping tables...")
        if engine.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = OFF;"))
        else:
            db.execute(text("SET session_replication_role = 'replica';"))
        
        # Get all tables
        if engine.name == "sqlite":
            tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()
        else:
            tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")).fetchall()
        
        tables = [t[0] for t in tables if t[0] not in ('sqlite_sequence', 'alembic_version')]
        
        for table in tables:
            print(f"Deleting data from {table}...")
            db.execute(text(f"DELETE FROM {table};"))
            
        db.commit()
        
        print("Re-enabling foreign key checks...")
        if engine.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = ON;"))
        else:
            db.execute(text("SET session_replication_role = 'origin';"))
            
        print("Database wiped successfully. Running startup logic to re-seed...")
        
    except Exception as e:
        db.rollback()
        print(f"Failed to wipe database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    wipe_database()
    startup_logic()
    print("Database reset complete. You can refresh the dashboard now.")
