import httpx

API = "http://localhost:8000/api/v1/admin"

res = httpx.post(f"{API}/login", json={"admin_password": "erbah1983"})
token = res.json()["token"]

configs = [
    {
       "tier_type": "public",
       "count": 10,
       "price": 20,
       "platform_share": 40,
       "seller_share": 30,
       "family_share": 30
    }
]

res2 = httpx.post(f"{API}/codes/generate", headers={"Authorization": f"Bearer {token}"}, json={"configs": configs})
print("STATUS:", res2.status_code)
print("BODY:", res2.text)
