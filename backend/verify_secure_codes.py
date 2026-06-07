import requests
import uuid
import hmac
import hashlib

BASE_URL = "http://localhost:8000/api/v1"
import os
CODE_SECRET_KEY = os.getenv("CODE_SECRET_KEY", "CEDI-TREES-SECRET-2026")

def register(email, password, name):
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": password, "name": name, "phone": "0240000000"
    })
    return r.json()

def login(email, password):
    r = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email, "password": password
    })
    return r.json().get("access_token")

def verify_code(code):
    r = requests.get(f"{BASE_URL}/economy/verify/{code}")
    return r.json()

def activate(token, code):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE_URL}/economy/activate", json={"product_code": code}, headers=headers)
    return r.json()

def test_security():
    print("--- SECURE PRODUCT CODE STRESS TEST ---")
    
    # 1. Generate a valid code for reference
    p1, p2 = "FAKE", "1234"
    data = (p1+p2).encode()
    correct_cs = hmac.new(CODE_SECRET_KEY.encode(), data, hashlib.sha256).hexdigest()[:4].upper()
    valid_looking_unregistered = f"CT-{p1}-{p2}-{correct_cs}"
    
    # 2. Generate a tampered code (invalid checksum)
    tampered_code = f"CT-{p1}-{p2}-AAAA"
    
    print(f"\n[TEST 1] Testing tampered code: {tampered_code}")
    res1 = verify_code(tampered_code)
    print(f"Verify response: {res1}")
    if res1.get("status") == "invalid_format":
        print("SUCCESS: Tampered code rejected by offline checksum.")
    else:
        print("FAILURE: Tampered code not rejected properly.")

    # 3. Testing valid-looking but non-existent code
    print(f"\n[TEST 2] Testing valid format but non-existent: {valid_looking_unregistered}")
    res2 = verify_code(valid_looking_unregistered)
    print(f"Verify response: {res2}")
    if res2.get("status") == "not_found":
        print("SUCCESS: Valid-looking code correctly identified as not found in DB.")
    else:
        print("FAILURE: Valid-looking code behavior unexpected.")

    # 4. Attempt activation with tampered code (should be logged in audit)
    print("\n[TEST 3] Attempting activation with tampered code...")
    user_email = f"tester_{uuid.uuid4().hex[:4]}@cedi.com"
    register(user_email, "Pass123!", "Security Tester")
    token = login(user_email, "Pass123!")
    
    act_res = activate(token, tampered_code)
    print(f"Activation result: {act_res}")
    if act_res.get("detail") == "Invalid product code format.":
        print("SUCCESS: Activation rejected for invalid checksum.")
    else:
        print("FAILURE: Activation logic bypassed checksum.")

if __name__ == "__main__":
    test_security()
