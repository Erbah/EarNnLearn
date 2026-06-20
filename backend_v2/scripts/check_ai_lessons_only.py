from app.core.database import engine
from sqlalchemy import inspect

def check_schema():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if 'ai_lessons' in tables:
        columns = [c['name'] for c in inspector.get_columns('ai_lessons')]
        print(f"Table ai_lessons columns: {columns}")
    else:
        print(f"Table ai_lessons NOT FOUND")

if __name__ == "__main__":
    check_schema()
