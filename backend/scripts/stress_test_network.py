import sys
import os
from decimal import Decimal
from sqlalchemy.orm import Session

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Use the app layer strictly
from app.database.session import SessionLocal, engine
from app.models import (
    Base, User, Wallet, ProductCode, NetworkTree, 
    ProfitDistribution, Activation, WalletTransaction,
    Transaction, GeneratedRid, Withdrawal
)
from app.services.profit_engine import profit_engine
from app.services.network_engine import network_engine

def setup_stress_test_environment():
    """Setup a clean environment for testing with proper FK handling."""
    db = SessionLocal()
    try:
        # Create all tables if they don't exist
        print("Resetting database schema...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        print("Cleaning up previous test data with FK awareness...")
        
        # 1. Delete leaf nodes / dependent records
        db.query(ProfitDistribution).delete()
        db.query(Withdrawal).delete()
        db.query(Activation).delete()
        db.query(WalletTransaction).delete()
        db.query(Transaction).delete()
        
        # 2. Delete middle layer
        db.query(NetworkTree).delete()
        db.query(ProductCode).delete()
        db.query(Wallet).delete()
        db.query(GeneratedRid).delete()
        
        # 3. Delete root entities
        db.query(User).filter(User.email.like("test_user_%@example.com")).delete(synchronize_session=False)
        db.query(User).filter(User.email == "master@earnnlearn.com").delete(synchronize_session=False)
        
        db.commit()
        print("Database cleaned successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
        raise e
    finally:
        db.close()

def create_user_chain(db: Session, depth: int):
    """Creates a chain of users where each user is referred by the previous one."""
    users = []
    
    # Ensure a Master user exists
    master_user = User(
        email="master@earnnlearn.com",
        password_hash="fake_hash",
        role="admin"
    )
    db.add(master_user)
    db.flush()
    db.add(Wallet(user_id=master_user.id, balance=0))
    db.add(ProductCode(product_code="MASTER_CODE", generated_by=master_user.id, activated_by=master_user.id))
    
    # Master is the root of the tree
    network_engine.create_node(db, master_user.id, parent_id=None)
    db.commit()
    
    current_parent_id = master_user.id

    for i in range(1, depth + 1):
        test_email = f"test_user_{i}@example.com"
        user_code = f"CODE_{i}"
        
        user = User(
            email=test_email,
            password_hash="fake_hash"
        )
        db.add(user)
        db.flush()
        
        db.add(Wallet(user_id=user.id, balance=0))
        db.add(ProductCode(product_code=user_code, generated_by=current_parent_id, activated_by=user.id))
        
        # Build the tree
        network_engine.create_node(db, user.id, parent_id=current_parent_id)
        
        users.append({
            "id": user.id,
            "code": user_code
        })
        
        current_parent_id = user.id
        
    db.commit()
    print(f"Created {depth} users in a chain (Master ID: {master_user.id}).")
    return users, master_user.id

def run_stress_test():
    setup_stress_test_environment()
    db = SessionLocal()
    
    try:
        depth = 15
        users, master_id = create_user_chain(db, depth)
        
        # Simulate activation for the last user in the chain
        last_user = users[-1]
        activation_price = 100.0
        
        # The seller for User 15 is User 14 (users[-2])
        seller_id = users[-2]["id"]
        
        # Get ancestors
        last_node = db.query(NetworkTree).filter(NetworkTree.user_id == last_user["id"]).first()
        ancestor_user_ids = [int(uid) for uid in last_node.path.split(".")[:-1]]
        
        ancestor_codes_recs = db.query(ProductCode).filter(ProductCode.activated_by.in_(ancestor_user_ids)).all()
        uid_to_pc = {pc.activated_by: pc.product_code for pc in ancestor_codes_recs}
        ancestor_rids = [uid_to_pc[uid] for uid in reversed(ancestor_user_ids) if uid in uid_to_pc]

        print(f"\n[STRESS TEST] Simulating activation for User {last_user['id']} (Level {depth})")
        print(f"Seller: User {seller_id}")
        print(f"Ancestors identified: {len(ancestor_rids)}")

        # Create dummy Transaction and GeneratedRid to satisfy FKs if needed
        # In this simulation, we'll just mock the ID for the profit_engine call
        # But wait, distribute_profits doesn't strictly need them in DB unless it queries them
        # Let's check profit_engine.py... it uses activation_id for logs
        
        # Create a real Activation record to satisfy FKs in ProfitDistribution
        # We need a Transaction first
        tx = Transaction(user_id=last_user["id"], amount=activation_price, status="CONFIRMED")
        db.add(tx)
        db.flush()
        
        # We need a GeneratedRid
        grid = GeneratedRid(rid_code="TEST_RID", generated_by=seller_id, is_used=True)
        db.add(grid)
        db.flush()
        
        # Get specific product_code_id
        pc_rec = db.query(ProductCode).filter(ProductCode.activated_by == last_user["id"]).first()

        act = Activation(
            user_id=last_user["id"], 
            rid_id=grid.id, 
            product_code_id=pc_rec.id, 
            transaction_id=tx.id
        )
        db.add(act)
        db.flush()
        
        # Trigger profit distribution
        profit_engine.distribute_profits(
            db=db,
            activation_id=act.id,
            seller_id=seller_id,
            master_id=master_id,
            total_payment=activation_price,
            ancestor_rids=ancestor_rids
        )
        db.commit()
        
        print("\nProfit distribution completed. Verifying balances...")
        
        # Verify Master Balance (5%)
        master_wallet = db.query(Wallet).filter(Wallet.user_id == master_id).first()
        expected_master = Decimal("5.00")
        print(f"Master Balance: {master_wallet.balance} (Expected: {expected_master})")
        
        # Verify Seller Balance (70%)
        seller_wallet = db.query(Wallet).filter(Wallet.user_id == seller_id).first()
        expected_seller = Decimal("70.00")
        print(f"Seller Balance: {seller_wallet.balance} (Expected: {expected_seller})")
        
        # Family Pool (25% = 25.00)
        # In 15 level chain, we have many ancestors.
        # cr, share = ProfitEngine.calculate_cr_distribution(25.0, len(ancestors))
        # If ancestors = 14 (excluding seller), cr = 14, share = 25 / 14 = 1.78
        
        all_wallets = db.query(Wallet).all()
        family_wallets = [w for w in all_wallets if w.user_id not in [master_id, seller_id, last_user["id"]] and w.balance > 0]
        
        total_dist = master_wallet.balance + seller_wallet.balance
        print(f"Active Family Members Paid: {len(family_wallets)}")
        for w in family_wallets:
            total_dist += w.balance
            print(f"  User {w.user_id} Balance: {w.balance}")

        print(f"\nTotal Distributed: {total_dist} (Original Payment: {activation_price})")
        
        if total_dist == Decimal("100.00"):
            print("SUCCESS: Network Stress Test Passed!")
        else:
            # Check if it's a rounding issue (25 / 14 * 14 = 24.92)
            print(f"FINAL SUM: {total_dist} / 100.00")
            if total_dist > 99 and total_dist <= 100:
                 print("Result is near 100% (Accounting for rounding).")
            else:
                 print("MAJOR DISCREPANCY DETECTED.")

    except Exception as e:
        db.rollback()
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_stress_test()
