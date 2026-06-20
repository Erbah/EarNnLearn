import sqlite3

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Check User
    print("--- User ---")
    cur.execute("SELECT id, name, email, phone, status, rid, parent_rid, tier_type, preferred_payment_method FROM users WHERE phone LIKE '%200148419%' OR email LIKE '%200148419%'")
    user_rows = cur.fetchall()
    for row in user_rows:
        print(dict(row))
    
    if user_rows:
        user = user_rows[0]
        user_id = user['id']
        user_rid = user['rid']
        
        print("\n--- Transactions ---")
        cur.execute(f"SELECT id, code_id, buyer_rid, seller_rid, amount, status, payment_reference FROM transactions WHERE buyer_rid = 'PENDING_ACT_{user_id}' OR buyer_rid = '{user_rid}'")
        tx_rows = cur.fetchall()
        for row in tx_rows:
            print(dict(row))
        
        if tx_rows:
            code_ids = [row['code_id'] for row in tx_rows if row['code_id']]
            if code_ids:
                print("\n--- Codes ---")
                placeholders = ','.join(['?']*len(code_ids))
                cur.execute(f"SELECT id, product_code, owner_rid, used, price FROM codes WHERE id IN ({placeholders})", tuple(code_ids))
                code_rows = cur.fetchall()
                for row in code_rows:
                    print(dict(row))
                    
        print("\n--- Fred (Seller) ---")
        fred_rid = tx_rows[0]['seller_rid'] if tx_rows else user['parent_rid']
        if fred_rid:
            cur.execute(f"SELECT id, name, phone, rid FROM users WHERE rid = '{fred_rid}'")
            fred_rows = cur.fetchall()
            for row in fred_rows:
                print(dict(row))
            
            print("\n--- Fred Wallet ---")
            cur.execute(f"SELECT user_rid, balance, withdrawable_balance FROM wallets WHERE user_rid = '{fred_rid}'")
            wallet_rows = cur.fetchall()
            for row in wallet_rows:
                print(dict(row))
                
            print("\n--- Fred Wallet Transactions ---")
            cur.execute(f"SELECT type, amount, description FROM wallet_transactions WHERE user_rid = '{fred_rid}'")
            wtx_rows = cur.fetchall()
            for row in wtx_rows:
                print(dict(row))

if __name__ == "__main__":
    check_db()
