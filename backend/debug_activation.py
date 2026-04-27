import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1"

def debug():
    print("--- DEBUG ACTIVATION ---")
    
    # 1. Login
    r = requests.post(f"{BASE_URL}/auth/login", data={"username": "admin@ceditrees.com", "password": "Admin123!"})
    token = r.json().get("access_token")
    if not token:
        print("Login failed")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get Codes
    codes_r = requests.get(f"{BASE_URL}/economy/my-codes", headers=headers)
    print(f"Codes Response: {codes_r.status_code}")
    codes = codes_r.json()
    if not codes:
        print("No codes found")
        return
    seed_code = codes[0]["product_code"]
    print(f"Using Code: {seed_code}")
    
    # 3. Create a new user
    email = f"debug_{uuid.uuid4().hex[:4]}@cedi.com"
    requests.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": "Pass123!", "name": "Debug User", "phone": "0240000000"
    })
    
    l_r = requests.post(f"{BASE_URL}/auth/login", data={"username": email, "password": "Pass123!"})
    u_token = l_r.json().get("access_token")
    
    # 4. Activate and CAPTURE ERROR
    print("\nAttempting Activation...")
    act_r = requests.post(
        f"{BASE_URL}/economy/activate", 
        json={"product_code": seed_code}, 
        headers={"Authorization": f"Bearer {u_token}"}
    )
    
    print(f"Status Code: {act_r.status_code}")
    print(f"Response Body: {act_r.text}")
    
    if act_r.status_code != 200:
        print("\n[ERROR DETECTED]")
        # Check other services?
        
if __name__ == "__main__":
    debug()
