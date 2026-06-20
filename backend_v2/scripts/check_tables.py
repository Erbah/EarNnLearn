import sqlite3
import os

db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
print(cur.fetchall())
conn.close()
