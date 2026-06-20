from app.core.database import SessionLocal, engine
from app.core.database import Base
from sqlalchemy import text
import time

def check_db():
    print("Testing DB connection...")
    try:
        db = SessionLocal()
        start = time.time()
        res = db.execute(text("SELECT 1")).fetchone()
        print(f"Connection successful! Result: {res} in {time.time()-start:.2f}s")
        
        print("Checking tables (create_all)...")
        start = time.time()
        # This is what's in main.py startup_logic
        Base.metadata.create_all(bind=engine)
        print(f"create_all finished in {time.time()-start:.2f}s")
        
    except Exception as e:
        print(f"DB Check failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
