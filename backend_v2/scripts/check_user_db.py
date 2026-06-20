import sqlite3
import pandas as pd

def check_db():
    conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db')
    
    # Check User
    print("--- User ---")
    user_query = "SELECT id, name, email, phone, status, rid, parent_rid, tier_type, preferred_payment_method FROM users WHERE phone LIKE '%0200148419%' OR email LIKE '%0200148419%'"
    user_df = pd.read_sql_query(user_query, conn)
    print(user_df)
    
    if not user_df.empty:
        user_id = user_df.iloc[0]['id']
        user_rid = user_df.iloc[0]['rid']
        
        # Check Transaction
        print("\n--- Transactions ---")
        tx_query = f"SELECT id, code_id, buyer_rid, seller_rid, amount, status, payment_reference FROM transactions WHERE buyer_rid = 'PENDING_ACT_{user_id}' OR buyer_rid = '{user_rid}'"
        tx_df = pd.read_sql_query(tx_query, conn)
        print(tx_df)
        
        # Check Code
        print("\n--- Codes ---")
        if not tx_df.empty:
            code_ids = tx_df['code_id'].dropna().unique().tolist()
            if code_ids:
                code_query = f"SELECT id, product_code, owner_rid, used, price FROM codes WHERE id IN ({','.join(['?']*len(code_ids))})"
                code_df = pd.read_sql_query(code_query, conn, params=code_ids)
                print(code_df)
                
        # Check Fred's User
        print("\n--- Fred (Seller) ---")
        fred_rid = tx_df.iloc[0]['seller_rid'] if not tx_df.empty else user_df.iloc[0]['parent_rid']
        if fred_rid:
            fred_query = f"SELECT id, name, phone, rid FROM users WHERE rid = '{fred_rid}'"
            fred_df = pd.read_sql_query(fred_query, conn)
            print(fred_df)
            
            # Check Fred's wallet
            print("\n--- Fred Wallet ---")
            fw_query = f"SELECT user_rid, balance, withdrawable_balance FROM wallets WHERE user_rid = '{fred_rid}'"
            print(pd.read_sql_query(fw_query, conn))
            
            print("\n--- Fred Wallet Transactions ---")
            fwt_query = f"SELECT type, amount, description FROM wallet_transactions WHERE user_rid = '{fred_rid}'"
            print(pd.read_sql_query(fwt_query, conn))
            
if __name__ == "__main__":
    check_db()
