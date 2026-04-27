import sqlite3
import os

DB_PATH = r"d:\PROJECTS\LearNnEarn\backend\ceditrees_dev.db"

def check():
    if not os.path.exists(DB_PATH):
        print(f"DB NOT FOUND at {DB_PATH}")
        return

    print(f"Checking DB at {DB_PATH} (Size: {os.path.getsize(DB_PATH)} bytes)")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tables = ["users", "course_payments", "course_scholarships", "codes"]
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Table {table}: {count} rows")
            
            if table == "course_payments" and count > 0:
                cursor.execute("SELECT user_rid, course_id, payment_method, status FROM course_payments")
                for row in cursor.fetchall():
                    print(f"  -> Payment: RID={row[0]}, Course={row[1][:8]}, Method={row[2]}, Status={row[3]}")
            
            if table == "course_scholarships" and count > 0:
                cursor.execute("SELECT user_rid, course_id, referral_enrollment_count, scholarship_active FROM course_scholarships")
                for row in cursor.fetchall():
                    print(f"  -> Scholarship: RID={row[0]}, Count={row[1]}, Active={row[2]}")
                    
        except Exception as e:
            print(f"Error querying {table}: {e}")
    
    conn.close()

if __name__ == "__main__":
    check()
