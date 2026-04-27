import httpx
import sys

API = "http://localhost:8000/api/v1/admin"

try:
    res = httpx.post(f"{API}/login", json={"admin_password": "erbah1983"}, timeout=5)
    token = res.json().get("token")
    if not token:
        print("LOGIN FAILED:", res.text)
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}
    
    print("Fetching /codes/stats...")
    r_stats = httpx.get(f"{API}/codes/stats", headers=headers, timeout=5)
    print("STATS HTTP:", r_stats.status_code)
    print("STATS BODY:", r_stats.text)

    print("Fetching /codes...")
    r_codes = httpx.get(f"{API}/codes", headers=headers, timeout=5)
    print("CODES HTTP:", r_codes.status_code)
    print("CODES BODY:", r_codes.text[:500])

except Exception as e:
    print(f"Exception: {e}")
