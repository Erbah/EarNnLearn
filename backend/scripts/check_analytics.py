import requests
import json

BASE_URL = "http://localhost:8001/api/v1"

def check_analytics():
    print("--- Checking Admin Analytics ---")
    try:
        response = requests.get(f"{BASE_URL}/admin/analytics")
        print(f"Status Code: {response.status_code}")
        data = response.json()
        print(f"Response Data: {json.dumps(data, indent=2)}")
        
        expected_keys = ["total_users", "activated_users", "total_revenue", "total_payouts", "codes_used", "codes_available"]
        for key in expected_keys:
            if key not in data:
                print(f"[ERROR] Key '{key}' missing from response!")
            else:
                print(f"[OK] Key '{key}' present: {data[key]} (Type: {type(data[key])})")
                
    except Exception as e:
        print(f"[ERROR] Request failed: {e}")

if __name__ == "__main__":
    check_analytics()
