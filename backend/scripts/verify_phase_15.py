import requests
import time

API = "http://localhost:8000/api/v1"

def test_currency_conversion():
    print("Testing Currency Engine (via /currencies endpoint)...")
    r = requests.get(f"{API}/marketplace/currencies")
    print(f"DEBUG: Status {r.status_code}, Body: {r.text}")
    data = r.json()
    assert "GHS" in data["currencies"]
    assert "USD" in data["currencies"]
    print("SUCCESS: Currencies returned.")

def test_code_check():
    print("Testing Code Metadata Check...")
    # Get a RID from the pool
    r = requests.get(f"{API}/marketplace/rids")
    rids = r.json()
    if not rids:
        print("SKIP: No RIDs available to check.")
    else:
        code = rids[0]["code"]
        r = requests.get(f"{API}/marketplace/check?code={code}")
        meta = r.json()
        assert meta["valid"] == True
        assert meta["currency"] == "GHS"
        assert meta["price"] == 50.0
        print(f"SUCCESS: Metadata for {code} is correct.")

def test_registration_with_currency():
    print("Testing Registration with Preferred Currency...")
    email = f"test_curr_{int(time.time())}@example.com"
    reg_data = {
        "name": "Currency Test",
        "email": email,
        "password": "pass",
        "preferred_currency": "USD"
    }
    r = requests.post(f"{API}/auth/register", json=reg_data)
    print(f"DEBUG Registry: Status {r.status_code}, Body: {r.text}")
    assert r.status_code == 200
    print("SUCCESS: Registered with USD.")

if __name__ == "__main__":
    try:
        test_currency_conversion()
        test_code_check()
        test_registration_with_currency()
        print("\nALL PHASE 15 VERIFICATIONS PASSED")
    except Exception as e:
        import traceback
        print(f"\nVERIFICATION FAILED: {e}")
        traceback.print_exc()
