import sqlite3
conn = sqlite3.connect('ceditrees_dev.db')
cursor = conn.cursor()
cursor.execute("SELECT password_hash FROM users WHERE email='frred@gmail.com'")
print(cursor.fetchall())
