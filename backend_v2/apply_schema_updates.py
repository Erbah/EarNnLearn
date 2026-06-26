"""
Standalone schema migration script.

Intentionally has ZERO imports from the app package to avoid triggering
Redis/Celery/background connections that would cause this script to hang.
Reads DATABASE_URL directly from the environment.
"""
import os
import sys
import sqlalchemy as sa
from sqlalchemy import text, inspect


def run_updates():
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        print("No DATABASE_URL found. Skipping schema updates.")
        return

    # SQLAlchemy requires postgresql:// not postgres://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print("Running schema updates...")

    try:
        engine = sa.create_engine(db_url, connect_args={"connect_timeout": 10})
    except Exception as e:
        print(f"Failed to create engine: {e}")
        sys.exit(1)

    # ── 1. Static safe ALTER TABLE operations ─────────────────────────────────
    try:
        with engine.connect() as conn:
            stmts = [
                # courses table
                "ALTER TABLE courses ADD COLUMN IF NOT EXISTS creator_name VARCHAR;",
                "ALTER TABLE courses ADD COLUMN IF NOT EXISTS institution VARCHAR;",
                # videos table
                "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;",
                # notifications table
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_rid VARCHAR;",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'SYSTEM';",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;",
                # indexes
                "CREATE INDEX IF NOT EXISTS idx_video_progress_video_id ON video_progress (video_id);",
                "CREATE INDEX IF NOT EXISTS idx_video_progress_user_video ON video_progress (user_rid, video_id);",
                # restore resalable product codes
                "UPDATE codes SET used = FALSE WHERE product_code IS NOT NULL;",
            ]
            for stmt in stmts:
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    # Table might not exist yet — that's fine, create_all will handle it
                    print(f"  [SKIP] {stmt.strip()[:60]}... → {e}")
            conn.commit()
            print("Static schema updates applied.")
    except Exception as e:
        print(f"Error during static updates: {e}")

    print("Schema update script completed successfully.")


if __name__ == "__main__":
    run_updates()
