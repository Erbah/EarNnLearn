import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'ceditrees_dev.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE withdrawal_requests ADD COLUMN wlp_code VARCHAR")
    cursor.execute("ALTER TABLE withdrawal_requests ADD COLUMN wlp_expires_at DATETIME")
    conn.commit()
    print("Successfully added WLP columns to dev DB")
except Exception as e:
    print(e)
    
conn.close()
