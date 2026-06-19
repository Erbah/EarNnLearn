import os

base_dir = r"d:\PROJECTS\LearNnEarn\backend_v2\app\api\v1"
admin_py = os.path.join(base_dir, "admin.py")

with open(admin_py, "r", encoding="utf-8") as f:
    text = f.read()

# Define the section headers as they appear in the file
H_AUTH = "# ─── Elevation / Auth Logic ───"
H_SCHEMA = "# ═══════════════════════════════════════\n#  SCHEMAS"
H_DASH = "# ═══════════════════════════════════════\n#  DASHBOARD OVERVIEW / ANALYTICS"
H_DB = "# ═══════════════════════════════════════\n#  SYSTEM DATABASE EXPLORER"
H_SETTINGS = "# ═══════════════════════════════════════\n#  SYSTEM SETTINGS"
H_AI = "# ═══════════════════════════════════════\n#  AI MODEL MANAGEMENT"
H_TIER = "# ═══════════════════════════════════════\n#  TIER MANAGEMENT"
H_CODE = "# ═══════════════════════════════════════\n#  CODE GENERATION"
H_USER = "# ═══════════════════════════════════════\n#  USER MANAGEMENT"
H_SEASON = "# ═══════════════════════════════════════\n#  SEASON MANAGEMENT"
H_COURSE = "# ═══════════════════════════════════════\n#  COURSE APPROVALS"
H_NOTIF = "# ═══════════════════════════════════════\n#  NOTIFICATIONS"
H_WITHDRAW = "# ═══════════════════════════════════════\n#  WITHDRAWAL MANAGEMENT"
H_TX = "class TransactionOut(BaseModel):"
H_LOGS = "# ═══════════════════════════════════════\n#  ADMIN ACTIVITY LOGS"

header = text.split(H_AUTH)[0]
auth_logic = H_AUTH + text.split(H_AUTH)[1].split(H_SCHEMA)[0]
schemas = H_SCHEMA + text.split(H_SCHEMA)[1].split(H_DASH)[0]
dashboard = H_DASH + text.split(H_DASH)[1].split(H_DB)[0]
db_explorer = H_DB + text.split(H_DB)[1].split(H_SETTINGS)[0]
settings_mod = H_SETTINGS + text.split(H_SETTINGS)[1].split(H_AI)[0]
ai_mod = H_AI + text.split(H_AI)[1].split(H_TIER)[0]
tier_mod = H_TIER + text.split(H_TIER)[1].split(H_CODE)[0]
code_mod = H_CODE + text.split(H_CODE)[1].split(H_USER)[0]
user_mod = H_USER + text.split(H_USER)[1].split(H_SEASON)[0]
season_mod = H_SEASON + text.split(H_SEASON)[1].split(H_COURSE)[0]
course_mod = H_COURSE + text.split(H_COURSE)[1].split(H_NOTIF)[0]
notif_mod = H_NOTIF + text.split(H_NOTIF)[1].split(H_WITHDRAW)[0]
withdraw_mod = H_WITHDRAW + text.split(H_WITHDRAW)[1].split(H_TX)[0]
tx_mod = H_TX + text.split(H_TX)[1].split(H_LOGS)[0]
logs_mod = H_LOGS + text.split(H_LOGS)[1]

def write(name, content):
    with open(os.path.join(base_dir, name), "w", encoding="utf-8") as f:
        # We include schemas in all of them to be safe, since they all use BaseModel schemas
        f.write(header + schemas + "\n\n" + content)

write("admin_auth.py", auth_logic)
write("admin_settings.py", settings_mod + db_explorer + logs_mod)
write("admin_ai.py", ai_mod)
write("admin_codes.py", tier_mod + code_mod + season_mod + tx_mod)
write("admin_analytics.py", dashboard + user_mod + course_mod + notif_mod + withdraw_mod)

print("Files successfully generated.")
