import sqlite3
import os

db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA table_info(ai_lessons);")
print("AI Lessons Columns:", [row[1] for row in cur.fetchall()])
cur.execute("PRAGMA table_info(subject_roadmaps);")
print("Subject Roadmaps Columns:", [row[1] for row in cur.fetchall()])
conn.close()
