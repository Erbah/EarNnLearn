import sqlite3
import os

db_path = "ceditrees_dev.db"
print(f"Migrating {db_path}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE video_progress ADD COLUMN watch_time INTEGER DEFAULT 0")
    conn.commit()
    print("Column watch_time added successfully.")
except sqlite3.OperationalError as e:
    print(f"Error: {e}")

conn.close()
