import requests

API = "http://localhost:8000/api/v1/admin"
HEADERS = {"Content-Type": "application/json"}

def test_inspector_v2():
    print("--- Phase 17: Database Inspector Enhancements Verification ---")
    
    # 1. Get initial code list
    print("\n1. Fetching codes...")
    r = requests.get(f"{API}/codes", headers=HEADERS)
    codes = r.json()
    if not codes:
        print("ERROR: No codes found in database. Run Phase 16 first.")
        return
    
    code = codes[0]
    code_id = code['id']
    old_tier = code['tier_type']
    new_tier = "ngo" if old_tier != "ngo" else "creator"
    
    # 2. Update tier
    print(f"\n2. Updating Code {code_id} tier from '{old_tier}' to '{new_tier}'...")
    r = requests.put(f"{API}/codes/{code_id}", json={"tier_type": new_tier}, headers=HEADERS)
    if r.status_code != 200:
        print(f"ERROR: Update failed with {r.status_code}: {r.text}")
        return
    assert r.json()['status'] == "success"
    
    # 3. Verify update
    print("\n3. Verifying update in database...")
    r = requests.get(f"{API}/codes", headers=HEADERS)
    codes = r.json()
    updated_code = next(c for c in codes if c['id'] == code_id)
    print(f"New Tier: {updated_code['tier_type']}")
    assert updated_code['tier_type'] == new_tier
    
    print("\n✅ Phase 17 Backend Verification Successful!")

if __name__ == "__main__":
    test_inspector_v2()
