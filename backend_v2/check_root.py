from app.core.database import SessionLocal
from app.models.user import User
from app.models.code import Code # Import Code to avoid Mapper error

def check():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "root@ceditrees.com").first()
        if user:
            print(f"User: {user.email}")
            print(f"Role: {user.role}")
            print(f"Tier: {user.tier_type}")
        else:
            print("User not found")
    finally:
        db.close()

if __name__ == "__main__":
    check()
