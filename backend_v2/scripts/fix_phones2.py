import sqlite3

conn = sqlite3.connect('ceditrees_dev.db')
cursor = conn.cursor()

# Get all users
cursor.execute("SELECT id, phone FROM users")
users = cursor.fetchall()

seen_phones = set()
for user_id, phone in users:
    if not phone or phone in seen_phones:
        # Needs a new unique phone
        new_phone = f"+23354000{user_id[:4] if isinstance(user_id, str) else str(user_id)[-4:]}"
        # ensure uniqueness
        while new_phone in seen_phones:
            new_phone += "1"
        cursor.execute("UPDATE users SET phone = ? WHERE id = ?", (new_phone, user_id))
        seen_phones.add(new_phone)
    else:
        seen_phones.add(phone)

conn.commit()
conn.close()
print("Fixed unique phones.")
