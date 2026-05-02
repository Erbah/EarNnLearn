import sqlite3
import os

# The config builds the path relative to backend_v2 dir
base_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(base_dir, "ceditrees_dev.db")
print(f"DB Path: {db_path}")
print(f"Exists: {os.path.exists(db_path)}")

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = c.fetchall()
print(f"\nTables ({len(tables)}):")
for t in tables:
    print(f"  {t[0]}")

# Check for roadmaps
try:
    c.execute("SELECT id, subject, user_rid FROM subject_roadmaps")
    rows = c.fetchall()
    print(f"\nRoadmaps ({len(rows)}):")
    for r in rows:
        print(f"  ID: {r[0]}, Subject: {r[1]}, User: {r[2]}")
except Exception as e:
    print(f"\nRoadmap query error: {e}")

conn.close()
