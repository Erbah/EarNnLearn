from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap
from app.services.ai_engine import AITutorEngine
import json

def force_regen():
    db = SessionLocal()
    rid = '91358c58-8347-4875-8098-1edb43f94260'
    r = db.query(SubjectRoadmap).filter(SubjectRoadmap.id == rid).first()
    if not r:
        print("Roadmap not found")
        return
        
    print(f"Forcing regeneration for subject: {r.subject}")
    # Simulate API call
    res = AITutorEngine.generate_roadmap(db, r.user_rid, r.subject, force=True)
    
    if hasattr(res, 'roadmap_data'):
        data = res.roadmap_data
    else:
        data = res.get('roadmap_data', {})
        
    units = data.get('units', [])
    print(f"Regeneration complete. Units: {len(units)}")
    for i, u in enumerate(units):
        print(f"  Unit {i+1}: {len(u.get('topics', []))} topics")

if __name__ == "__main__":
    force_regen()
