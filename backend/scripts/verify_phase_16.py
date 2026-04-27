import requests
import time

API = "http://localhost:8000/api/v1/admin"
TOKEN = None # Add logic to get token if needed, but for dev we might have open routes or I'll just use the token search approach

def get_headers():
    # In a real test we'd login, here we assume it's skip-auth in dev or we have a hardcoded token
    # For simplicity, if auth is required, this script will fail until I find a valid token
    return {"Authorization": "Bearer TEST_TOKEN", "Content-Type": "application/json"}

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
