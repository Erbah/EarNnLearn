import requests
import time

GATEWAY_URL = "http://localhost:8000/api/v1"

def check_services():
    print("🔍 Health Check: Microservices via Gateway")
    
    # Check Auth Service
    try:
        r = requests.get(f"{GATEWAY_URL}/auth/me")
        print(f"Auth Service (via Gateway): {r.status_code} (Expected 401 if unauth, not 404/502)")
    except Exception as e:
        print(f"Auth Service Error: {e}")

    # Check Economy Service
    try:
        r = requests.get(f"{GATEWAY_URL}/economy/my-codes")
        print(f"Economy Service (via Gateway): {r.status_code}")
    except Exception as e:
        print(f"Economy Service Error: {e}")

    # Check Wallet Service
    try:
        r = requests.get(f"{GATEWAY_URL}/wallet/")
        print(f"Wallet Service (via Gateway): {r.status_code}")
    except Exception as e:
        print(f"Wallet Service Error: {e}")

if __name__ == "__main__":
    check_services()
