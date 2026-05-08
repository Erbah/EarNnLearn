from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap
import json

def check():
    db = SessionLocal()
    r = db.query(SubjectRoadmap).filter(SubjectRoadmap.id == '91358c58-8347-4875-8098-1edb43f94260').first()
    if not r:
        print("Roadmap not found")
        return
        
    print(f"ID: {r.id}")
    print(f"Updated At: {r.updated_at}")
    units = r.roadmap_data.get("units", [])
    print(f"Found {len(units)} units")
    for i, u in enumerate(units):
        topics = u.get("topics", [])
        print(f"Unit {i+1} ({u.get('title')}): {len(topics)} topics")

if __name__ == "__main__":
    check()
