from app.core.database import engine
from sqlalchemy import inspect

def check_schema():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")
    
    for table in ['ai_lessons', 'users', 'lesson_progress', 'subject_roadmaps']:
        if table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            print(f"Table {table} columns: {columns}")
        else:
            print(f"Table {table} NOT FOUND")

if __name__ == "__main__":
    check_schema()
