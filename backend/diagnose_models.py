import sys
import os

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

print("--- DIAGNOSING MODELS ---")
from app.database.base import Base
print(f"Base metadata tables (start): {list(Base.metadata.tables.keys())}")

try:
    print("Importing User...")
    from app.models.user import User
    print(f"Base metadata tables (after User): {list(Base.metadata.tables.keys())}")
    
    print("Importing Economy...")
    from app.models.economy import GeneratedRid, Activation
    print(f"Base metadata tables (after Economy): {list(Base.metadata.tables.keys())}")
    
    print("SUCCESS: All models imported and metadata populated.")
    
except Exception as e:
    print(f"FAILURE: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("--- DIAGNOSIS COMPLETE ---")
