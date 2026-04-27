from app.database.session import SessionLocal
from app.models import GeneratedRid

def check_db():
    db = SessionLocal()
    try:
        rids = db.query(GeneratedRid).all()
        print(f"Total RIDs in DB: {len(rids)}")
        for r in rids:
            print(f"RID: '{r.rid_code}' (Length: {len(r.rid_code)}), Used: {r.is_used}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
