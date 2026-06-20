import sqlite3

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print("--- Last 10 Users ---")
    cur.execute("SELECT id, name, email, phone, status, rid, parent_rid, tier_type, preferred_payment_method FROM users ORDER BY created_at DESC LIMIT 10")
    user_rows = cur.fetchall()
    for row in user_rows:
        print(dict(row))
        
    print("\n--- Last 5 Transactions ---")
    cur.execute("SELECT id, code_id, buyer_rid, seller_rid, amount, status, payment_reference FROM transactions ORDER BY created_at DESC LIMIT 5")
    for row in cur.fetchall():
        print(dict(row))

if __name__ == "__main__":
    check_db()
