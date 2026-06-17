import sqlite3

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print("--- Code CT-ZU79-HK4G-AD88 ---")
    cur.execute("SELECT * FROM codes WHERE product_code = 'CT-ZU79-HK4G-AD88'")
    rows = cur.fetchall()
    for row in rows:
        print(dict(row))

if __name__ == "__main__":
    check_db()
