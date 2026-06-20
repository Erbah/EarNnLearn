import sqlite3
import random

conn = sqlite3.connect('ceditrees_dev.db')
cursor = conn.cursor()

cursor.execute("SELECT id FROM users WHERE phone IS NULL")
rows = cursor.fetchall()
for row in rows:
    phone = f"+23354{random.randint(1000000, 9999999)}"
    cursor.execute("UPDATE users SET phone = ? WHERE id = ?", (phone, row[0]))

conn.commit()
conn.close()
print(f"Updated {len(rows)} users with missing phones.")
