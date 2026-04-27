from common.database.db_session import SessionLocal
from common.models.user import User
from common.models.code import Code

def deep_inspect():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "admin@ceditrees.com").first()
    print(f"Admin RID: '{admin.rid}' (len={len(admin.rid)})")
    print(f"Admin RID repr: {repr(admin.rid)}")
    
    code = db.query(Code).filter(Code.product_code == "WELCOME2026").first()
    if code:
        print(f"Code Owner RID: '{code.owner_rid}' (len={len(code.owner_rid)})")
        print(f"Code Owner RID repr: {repr(code.owner_rid)}")
        print(f"Match: {admin.rid == code.owner_rid}")
    else:
        print("Code WELCOME2026 not found!")
    
    db.close()

if __name__ == "__main__":
    deep_inspect()
