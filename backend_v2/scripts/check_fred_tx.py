import sqlite3

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print("--- Transactions for Fred's Code ---")
    cur.execute("SELECT * FROM transactions WHERE seller_rid = 'ADM_FAD4282A.06g'")
    rows = cur.fetchall()
    for row in rows:
        print(dict(row))

if __name__ == "__main__":
    check_db()
