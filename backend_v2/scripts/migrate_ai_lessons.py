import sqlite3

def migrate():
    try:
        conn = sqlite3.connect('ceditrees_dev.db')
        cursor = conn.cursor()
        # Add the curriculum_metadata column with a default empty JSON object string
        cursor.execute("ALTER TABLE ai_lessons ADD COLUMN curriculum_metadata TEXT DEFAULT '{}'")
        conn.commit()
        print('SUCCESS: Added curriculum_metadata column to ai_lessons')
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
