import requests
import time

API = "http://localhost:8000/api/v1/admin"
def get_token():
    try:
        r = requests.post("http://localhost:8000/api/v1/admin/login", json={"admin_password": "erbah1983"})
        if r.status_code == 200:
            return r.json().get("token")
    except: pass
    return "TEST_TOKEN"

TOKEN = get_token()

def get_headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def test_inspector():
    print("--- Phase 16: Database Inspector Verification ---")
    
    # 1. Generate codes with specific metadata
    print("\n1. Generating Codes with Metadata...")
    payload = {
        "count": 3,
        "tier_type": "creator",
        "price": 55.50
    }
    r = requests.post(f"{API}/codes/generate", json=payload, headers=get_headers())
    if r.status_code == 401:
         print("ERROR: Unauthorized. Need a valid token.")
         return
    
    data = r.json()
    print(f"Generated: {data.get('generated')} codes")
    
    # 2. Check inspector stats
    print("\n2. Checking Inspector Stats...")
    r = requests.get(f"{API}/codes/stats", headers=get_headers())
    stats = r.json()
    print(f"Stats: {stats}")
    assert stats['total'] >= 3
    
    # 3. List codes and verify metadata
    print("\n3. Verifying Code Metadata in List...")
    r = requests.get(f"{API}/codes", headers=get_headers())
    codes = r.json()
    
    # Find one of our newly generated codes
    new_codes = [c for c in codes if c['price'] == 55.50 and c['tier_type'] == "creator"]
    print(f"Found {len(new_codes)} matching codes in database")
    assert len(new_codes) >= 3
    
    for c in new_codes[:1]:
        print(f"Sample Code: {c['rid_code']} | Price: {c['price']} | Tier: {c['tier_type']} | Currency: {c['currency']}")
        assert c['currency'] == "GHS"
        assert c['is_used'] == False

    print("\n✅ Phase 16 Verification Successful!")

if __name__ == "__main__":
    test_inspector()
