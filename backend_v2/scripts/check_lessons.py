from sqlalchemy import create_engine, text
import json

db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
engine = create_engine(f"sqlite:///{db_path}")

with engine.connect() as conn:
    print("--- Listing Tables ---")
    tables = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    for t in tables:
        print(t[0])
        
    print("\n--- Searching for 'compton' in all tables ---")
    for t in tables:
        table_name = t[0]
        try:
            # We will query all columns of the table and search for substring
            columns_info = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            text_columns = [col[1] for col in columns_info if "TEXT" in col[2] or "VARCHAR" in col[2] or col[2] == ""]
            if not text_columns:
                continue
            
            for col in text_columns:
                query = f"SELECT * FROM {table_name} WHERE {col} LIKE :term"
                results = conn.execute(text(query), {"term": "%compton%"}).fetchall()
                if results:
                    print(f"Found 'compton' in table {table_name}, column {col}:")
                    for r in results[:3]:
                        print(r)
        except Exception as e:
            print(f"Error reading {table_name}: {e}")

    print("\n--- Searching for 'Supply, Demand' in all tables ---")
    for t in tables:
        table_name = t[0]
        try:
            columns_info = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            text_columns = [col[1] for col in columns_info if "TEXT" in col[2] or "VARCHAR" in col[2] or col[2] == ""]
            if not text_columns:
                continue
            
            for col in text_columns:
                query = f"SELECT * FROM {table_name} WHERE {col} LIKE :term"
                results = conn.execute(text(query), {"term": "%Supply, Demand%"}).fetchall()
                if results:
                    print(f"Found 'Supply, Demand' in table {table_name}, column {col}:")
                    for r in results[:3]:
                        print(f"ID/Key info: {r[0] if len(r) > 0 else 'N/A'}")
                        # Print only a snippet if it's very long
                        print(str(r)[:500])
        except Exception as e:
            print(f"Error reading {table_name}: {e}")
