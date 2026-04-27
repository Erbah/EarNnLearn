from app.database.session import SessionLocal
from app.models import GeneratedRid, ActivityLog
import json

def debug_update():
    db = SessionLocal()
    try:
        code = db.query(GeneratedRid).first()
        if not code:
            print("No code found")
            return
        
        print(f"Original Code: {code.rid_code}, Tier: {code.tier_type}")
        
        old_tier = code.tier_type
        new_tier = "ngo"
        
        code.tier_type = new_tier
        db.commit()
        print("Commit 1 successful")
        
        log = ActivityLog(
            action=f"Updated code tier: {code.rid_code}", 
            details=json.dumps({"old": old_tier, "new": new_tier})
        )
        db.add(log)
        db.commit()
        print("Commit 2 successful")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_update()
