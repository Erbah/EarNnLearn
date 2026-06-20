import sqlite3
import os

db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
try:
    cur.execute("DROP TABLE IF EXISTS ai_assets;")
    cur.execute("DROP TABLE IF EXISTS _alembic_tmp_ai_lessons;")
    cur.execute("DROP TABLE IF EXISTS _alembic_tmp_subject_roadmaps;")
    conn.commit()
    print("Cleaned up temporary and conflicting tables.")
except Exception as e:
    print(f"Error cleaning up: {e}")
finally:
    conn.close()
