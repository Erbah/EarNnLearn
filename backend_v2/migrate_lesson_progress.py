import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ceditrees_dev.db")
    print(f"Connecting to: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add the module_id column to lesson_progress
        try:
            cursor.execute("ALTER TABLE lesson_progress ADD COLUMN module_id TEXT")
            print('SUCCESS: Added module_id column to lesson_progress')
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("Column module_id already exists in lesson_progress.")
            else:
                raise e
                
        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    migrate()
