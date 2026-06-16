import os
import sqlalchemy as sa
from sqlalchemy import text

def run_updates():
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    if not db_url:
        print("No DATABASE_URL found. Skipping raw schema updates.")
        return

    print("Running schema updates...")
    engine = sa.create_engine(db_url)
    with engine.connect() as conn:
        try:
            # Add missing columns safely
            conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS creator_name VARCHAR;"))
            conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS institution VARCHAR;"))
            conn.execute(text("ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;"))
            conn.commit()
            print("Successfully added columns (if they were missing).")
        except Exception as e:
            print(f"Error adding columns: {e}")

        try:
            # We also ensure all new tables are created. 
            # create_all is safe because it only creates missing tables.
            from app.core.database import Base
            # Import models to register them with Base
            import app.models.course
            import app.models.user
            import app.models.wallet
            import app.models.transaction
            import app.models.code
            import app.models.progress
            import app.models.ai
            
            Base.metadata.create_all(bind=engine)
            print("Successfully ensured all tables exist.")
        except Exception as e:
            print(f"Error creating tables: {e}")

if __name__ == "__main__":
    run_updates()
