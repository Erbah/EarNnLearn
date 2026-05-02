import sqlite3
import os

db_path = "ceditrees_dev.db"
print(f"Checking {db_path}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

for table in ["video_progress", "course_payments"]:
    print(f"\n--- Table: {table} ---")
    cursor.execute(f"PRAGMA table_info({table})")
    cols = cursor.fetchall()
    for col in cols:
        print(col)
conn.close()
