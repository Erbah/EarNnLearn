import sys
import os
from fastapi.testclient import TestClient

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# IMPORTANT: Import models BEFORE app.main to ensure they are registered correctly
from app.models import Base, User, Activation, GeneratedRid, Transaction, ProfitDistribution
print(f"DEBUG: Verification script using Base at {id(Base)}")
# IMPORTANT: Import models FIRST
import app.models
print(f"DEBUG: Tables in metadata BEFORE app.main: {list(app.models.Base.metadata.tables.keys())}")

from app.main import app
from app.database.session import engine, SessionLocal

client = TestClient(app)

def verify_phase_12():
    print("--- PHASE 12 VERIFICATION ---")
    
    # Ensure tables exist
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print(f"Registered tables: {list(Base.metadata.tables.keys())}")
    
    # 0. Seed a dummy user
    print("\nSeeding dummy user...")
    db = SessionLocal()
    existing = db.query(User).filter(User.username == "admin_test").first()
    if not existing:
        user = User(username="admin_test", display_name="Admin Test", email="admin@test.com", password_hash="hash", role="admin")
        db.add(user)
        db.flush()
        
        # Seed network node for admin
        from app.services.network_engine import network_engine
        network_engine.create_node(db, user_id=user.id)
        
        db.commit()
        print("User and Network Node seeded.")
    else:
        print("User already exists.")

    # 1. Test Analytics
    print("\nTesting GET /api/v1/admin/analytics...")
    resp = client.get("/api/v1/admin/analytics")
    print(f"Status: {resp.status_code}")
    print(f"Analytics: {resp.json()}")

    # 2. Test Users List
    print("\nTesting GET /api/v1/admin/users...")
    resp = client.get("/api/v1/admin/users")
    print(f"Status: {resp.status_code}, Count: {len(resp.json())}")

    # 3. Test Settings
    print("\nTesting GET /api/v1/admin/settings...")
    resp = client.get("/api/v1/admin/settings")
    print(f"Status: {resp.status_code}, Settings Count: {len(resp.json())}")

    # 4. Test Code Generation
    print("\nTesting POST /api/v1/admin/codes/generate...")
    resp = client.post("/api/v1/admin/codes/generate", json={"count": 5, "tier_type": "public", "price": 20})
    print(f"Status: {resp.status_code}")
    
    # 5. Test Logs
    print("\nTesting GET /api/v1/admin/logs...")
    resp = client.get("/api/v1/admin/logs")
    print(f"Status: {resp.status_code}, Logs Count: {len(resp.json())}")

    print("\nPHASE 12 VERIFICATION COMPLETE")

if __name__ == "__main__":
    verify_phase_12()
