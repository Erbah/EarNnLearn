from app.core.database import SessionLocal
from app.models.user import User
from app.models.code import Code # Import to initialize mapper
from app.models.transaction import Transaction
from app.models.wallet import Wallet

def fix_beta_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            user.is_beta_user = True
            print(f"Updated user {user.email} to beta access.")
        db.commit()
        print("Successfully enabled beta access for all existing users.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_beta_users()
