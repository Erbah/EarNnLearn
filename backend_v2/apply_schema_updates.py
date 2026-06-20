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
            
            # Ensure notifications table has all necessary columns
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_rid VARCHAR;"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'SYSTEM';"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;"))
            
            # Add missing indexes safely
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_video_progress_video_id ON video_progress (video_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_video_progress_user_video ON video_progress (user_rid, video_id);"))
            
            conn.commit()
            print("Successfully added columns and indexes (if they were missing).")
        except Exception as e:
            print(f"Error adding columns or indexes: {e}")

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
            import app.models.notification
            
            Base.metadata.create_all(bind=engine)
            print("Successfully ensured all tables exist.")
        except Exception as e:
            print(f"Error creating tables: {e}")

if __name__ == "__main__":
    run_updates()
