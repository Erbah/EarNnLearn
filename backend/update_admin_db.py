import sqlite3

def update_admin_password():
    conn = sqlite3.connect('ceditrees_dev.db')
    cursor = conn.cursor()
    # Correct hash for 'erbah1983'
    h = '$2b$12$SIqvdTy0oD1dXYAqRk8k5.q95cNIfv4AWH4WgITcunN.ThUuIoxXO'
    cursor.execute('UPDATE system_settings SET value=? WHERE key=?', (h, 'ADMIN_PASSWORD'))
    conn.commit()
    conn.close()
    print("Database updated successfully with correct hash.")

if __name__ == "__main__":
    update_admin_password()
