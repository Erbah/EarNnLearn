import sys
import os
from fastapi.testclient import TestClient

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal, engine
from app.models import Base

client = TestClient(app)

def verify_phase_11():
    print("--- PHASE 11 VERIFICATION ---")
    
    # 1. Generate RIDs via Admin
    print("\nTesting POST /api/v1/admin/generate-rids...")
    resp = client.post("/api/v1/admin/generate-rids?count=5")
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(f"Data: {data}")
    
    if resp.status_code == 200 and data.get("status") == "success":
        print(f"SUCCESS: Generated {len(data['codes'])} RIDs.")
        gen_codes = data['codes']
    else:
        print(f"FAILURE: RID generation failed: {resp.text}")
        return

    # 2. Verify Marketplace Pool contains these RIDs
    print("\nTesting GET /api/v1/marketplace/pool...")
    resp = client.get("/api/v1/marketplace/pool")
    print(f"Status: {resp.status_code}")
    pool_data = resp.json()
    print(f"Pool Size: {len(pool_data)}")
    
    pool_codes = [c['code'] for c in pool_data]
    
    # Check if at least some generated codes are in the pool
    intersection = set(gen_codes).intersection(set(pool_codes))
    if len(intersection) > 0:
        print(f"SUCCESS: {len(intersection)} newly generated RIDs found in marketplace pool.")
    else:
        print("FAILURE: Generated RIDs not found in marketplace pool.")

    print("\nPHASE 11 VERIFICATION COMPLETE")

if __name__ == "__main__":
    verify_phase_11()
