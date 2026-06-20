import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'ceditrees_dev.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE certificates ADD COLUMN grade_percentage FLOAT DEFAULT 0.0")
    conn.commit()
    print("Added grade_percentage")
except Exception as e:
    print("Warning (grade_percentage):", e)

try:
    cursor.execute("ALTER TABLE certificates ADD COLUMN certificate_url VARCHAR")
    conn.commit()
    print("Added certificate_url")
except Exception as e:
    print("Warning (certificate_url):", e)
    
conn.close()
