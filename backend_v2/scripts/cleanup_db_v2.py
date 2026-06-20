import sqlite3
import os

db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
try:
    cur.execute("DROP TABLE ai_assets;")
    print("Dropped ai_assets")
except Exception as e:
    print(f"Error dropping ai_assets: {e}")

try:
    cur.execute("DROP TABLE _alembic_tmp_ai_lessons;")
    print("Dropped _alembic_tmp_ai_lessons")
except Exception as e:
    print(f"Error dropping _alembic_tmp_ai_lessons: {e}")

conn.commit()
conn.close()
print("Done.")
