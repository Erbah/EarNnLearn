import sqlite3
import os

db_path = "d:\\PROJECTS\\LearNnEarn\\backend\\ceditrees_dev.db"
if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(codes)")
columns = cursor.fetchall()
column_names = [col[1] for col in columns]
print("Columns in 'codes' table:", column_names)
conn.close()
