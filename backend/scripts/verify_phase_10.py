import sys
import os
from fastapi.testclient import TestClient

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal, engine
from app.models import Base, ProductCode

client = TestClient(app)

def verify_phase_10():
    print("--- PHASE 10 VERIFICATION ---")
    
    # 1. Ensure DB has at least one code for the pool
    db = SessionLocal()
    try:
        if not db.query(ProductCode).first():
            print("Seeding sample ProductCode...")
            db.add(ProductCode(product_code="TEST-POOL-CODE-001"))
            db.commit()
    finally:
        db.close()

    # 2. Test Marketplace Pool (with prefix)
    print("\nTesting GET /api/v1/marketplace/pool...")
    resp = client.get("/api/v1/marketplace/pool")
    print(f"Status: {resp.status_code}")
    print(f"Data: {resp.json()}")
    
    if resp.status_code == 200 and isinstance(resp.json(), list):
        print("SUCCESS: Marketplace pool returned an array.")
    else:
        print("FAILURE: Marketplace pool did not return expected array.")

    # 3. Test Registration (with prefix and more fields)
    print("\nTesting POST /api/v1/auth/register...")
    reg_data = {
        "name": "Phase 10 Tester",
        "email": "p10tester@example.com",
        "password": "securepassword",
        "phone": "0240000000",
        "activation_code": "TEST-POOL-CODE-001"
    }
    resp = client.post("/api/v1/auth/register", json=reg_data)
    print(f"Status: {resp.status_code}")
    print(f"Data: {resp.json()}")

    if resp.status_code == 200:
        print("SUCCESS: Registration endpoint is synced.")
    else:
        print(f"FAILURE: Registration failed: {resp.text}")

    print("\nPHASE 10 VERIFICATION COMPLETE")

if __name__ == "__main__":
    verify_phase_10()
