from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap
import json

db = SessionLocal()
roadmaps = db.query(SubjectRoadmap).all()

for r in roadmaps:
    print(f"Roadmap ID: {r.id}")
    print(f"Subject: {r.subject}")
    data = r.roadmap_data
    if not isinstance(data, dict):
        print(f"  Error: roadmap_data is {type(data)}")
        continue
    
    units = data.get("units")
    if units is None:
        print("  Error: 'units' key missing")
    elif not isinstance(units, list):
        print(f"  Error: 'units' is {type(units)}")
    else:
        print(f"  Units count: {len(units)}")
        for i, u in enumerate(units):
            if not isinstance(u, dict):
                print(f"    Unit {i} is {type(u)}: {u}")
            else:
                if "topics" not in u:
                    print(f"    Unit {i} ('{u.get('title')}') is missing 'topics'")
                elif not isinstance(u["topics"], list):
                    print(f"    Unit {i} ('{u.get('title')}') 'topics' is {type(u['topics'])}")
                else:
                    print(f"    Unit {i} ('{u.get('title')}') has {len(u['topics'])} topics")

db.close()
