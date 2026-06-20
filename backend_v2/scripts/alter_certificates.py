import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'ceditrees_dev.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE courses ADD COLUMN institution VARCHAR")
    conn.commit()
    print("Successfully added institution to courses")
except Exception as e:
    print("Warning/Error (courses):", e)

try:
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR PRIMARY KEY,
        user_rid VARCHAR NOT NULL,
        course_id VARCHAR NOT NULL,
        grade_percentage FLOAT DEFAULT 0.0,
        certificate_url VARCHAR,
        issue_date DATETIME
    )
    """)
    cursor.execute("CREATE INDEX ix_certificates_user_rid ON certificates (user_rid)")
    cursor.execute("CREATE INDEX ix_certificates_course_id ON certificates (course_id)")
    conn.commit()
    print("Successfully created certificates table")
except Exception as e:
    print("Warning/Error (certificates):", e)
    
conn.close()
