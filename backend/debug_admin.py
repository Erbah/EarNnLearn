import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def debug_admin():
    print("Logging in as admin...")
    r = requests.post(f"{BASE_URL}/auth/login", data={
        "username": "admin@ceditrees.com", "password": "Admin123!"
    })
    print(f"Login Status: {r.status_code}")
    if r.status_code != 200:
        print(f"Login Response: {r.text}")
        return
    
    token = r.json().get("access_token")
    print(f"Token: {token[:10]}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    print("Fetching /economy/my-codes...")
    r = requests.get(f"{BASE_URL}/economy/my-codes", headers=headers)
    print(f"Codes Status: {r.status_code}")
    print(f"Codes Response: {json.dumps(r.json(), indent=2)}")

if __name__ == "__main__":
    debug_admin()
