import requests

base_url = "https://earnnlearn.up.railway.app/api/v1"
email = "root@ceditrees.com"
password = "rootpass123"

# 1. Login
print("Logging in...")
login_response = requests.post(f"{base_url}/auth/login", data={"username": email, "password": password})
if login_response.status_code != 200:
    print(f"Login failed: {login_response.text}")
    exit(1)

token = login_response.json()["access_token"]
print("Got token")

# 2. Get me
me_response = requests.get(f"{base_url}/auth/me", headers={"Authorization": f"Bearer {token}"})
if me_response.status_code != 200:
    print(f"Get me failed: {me_response.text}")
    exit(1)

my_rid = me_response.json()["rid"]
print(f"My RID: {my_rid}")

# 3. Adjust Wallet
adjust_response = requests.post(
    f"{base_url}/admin/users/{my_rid}/adjust-wallet?amount=-1000&reason=Remove%20initial%201000%20startup%20balance",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Adjust Response {adjust_response.status_code}: {adjust_response.text}")
