from common.database.db_session import SessionLocal, engine, Base
from common.models.user import User
from common.models.code import Code
from common.models.wallet import Wallet
from common.models.transaction import Transaction, ReferralIndex
from common.models.skill_tree import SkillNode, skill_prerequisites
from common.core.security import get_password_hash
import common.models # Load all

def seed():
    print("🌱 Seeding Database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if root exists
    root = db.query(User).filter(User.email == "admin@ceditrees.com").first()
    if not root:
        root_rid = "ACNIRP"
        root = User(
            email="admin@ceditrees.com",
            password_hash=get_password_hash("Admin123!"),
            name="Root Admin",
            display_name="MasterMind",
            rid=root_rid,
            is_active=True,
            tier_type="admin" # Explicitly set admin tier
        )
        db.add(root)
        db.flush()
        
        # Add Wallet
        db.add(Wallet(user_rid=root_rid, balance=10000))
        
        # Add Referral Index
        db.add(ReferralIndex(user_rid=root_rid, path=root_rid, depth=0))
        
        db.add(Code(
            product_code="CT-WELC-2026-8012",
            owner_rid=root_rid,
            parent_rid=root_rid,
            price=100.0,
            tier_type="public"
        ))
        
        # --- SEED SKILL TREE ---
        print("🌳 Seeding Skill Tree...")
        n1 = SkillNode(id="prog_basics", title="Programming Basics", category="Coding", ui_metadata={"x": 100, "y": 100})
        n2 = SkillNode(id="py_loops", title="Python Loops", category="Coding", ui_metadata={"x": 100, "y": 200})
        n3 = SkillNode(id="adv_py", title="Advanced Python", category="Coding", ui_metadata={"x": 100, "y": 300})
        db.add_all([n1, n2, n3])
        db.flush()
        
        # Set Prerequisites: Basics -> Loops -> Advanced
        db.execute(skill_prerequisites.insert().values(skill_id="py_loops", prerequisite_id="prog_basics"))
        db.execute(skill_prerequisites.insert().values(skill_id="adv_py", prerequisite_id="py_loops"))

        db.commit()
        print("✅ Seeded Root Admin and WELCOME2026 code.")
    else:
        print("ℹ️ Root already exists.")
    db.close()

if __name__ == "__main__":
    seed()
