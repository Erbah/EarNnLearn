import sqlite3

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print("--- PENDING_ACT Transactions ---")
    cur.execute("SELECT * FROM transactions WHERE buyer_rid LIKE 'PENDING_ACT_%' ORDER BY created_at DESC LIMIT 5")
    rows = cur.fetchall()
    for row in rows:
        print(dict(row))

if __name__ == "__main__":
    check_db()
