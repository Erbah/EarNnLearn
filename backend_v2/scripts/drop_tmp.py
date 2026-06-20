import sqlite3

conn = sqlite3.connect('ceditrees_dev.db')
cursor = conn.cursor()

try:
    cursor.execute("DROP TABLE _alembic_tmp_users")
    conn.commit()
    print("Dropped _alembic_tmp_users")
except Exception as e:
    print("Error:", e)

conn.close()
