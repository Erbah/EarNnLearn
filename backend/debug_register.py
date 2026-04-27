from common.database.db_session import SessionLocal
from common.models.user import User
from common.schemas.user_schema import UserCreate
from common.core.security import get_password_hash
import uuid

def test_manual_register():
    db = SessionLocal()
    try:
        user_in = UserCreate(
            name="Manual Test",
            email=f"manual_{uuid.uuid4().hex[:4]}@test.com",
            phone="000000000",
            password="Pass"
        )
        
        print("Creating User Object...")
        new_user = User(
            name=user_in.name,
            display_name=user_in.display_name or user_in.name,
            email=user_in.email,
            phone=user_in.phone,
            password_hash=get_password_hash(user_in.password),
            parent_rid=None
        )
        db.add(new_user)
        print("Committing...")
        db.commit()
        print("Success!")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_manual_register()
