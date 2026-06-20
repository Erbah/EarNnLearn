from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap
import json
import random
from sqlalchemy.orm.attributes import flag_modified

def extract_topics(obj):
    topics = []
    if isinstance(obj, dict):
        is_container = any(k in obj for k in ["units", "chapters", "lessons", "parts", "topics"])
        if "title" in obj and not is_container:
             topics.append({
                "id": str(obj.get("id") or obj.get("uai") or random.randint(100000, 999999)),
                "title": str(obj.get("title")),
                "difficulty": str(obj.get("difficulty", "intermediate"))
             })
             return topics
        for v in obj.values():
            topics.extend(extract_topics(v))
    elif isinstance(obj, list):
        for item in obj:
            topics.extend(extract_topics(item))
    return topics

def find_units(obj):
    units = []
    if isinstance(obj, dict):
        if "units" in obj and isinstance(obj["units"], list):
            units.extend(obj["units"])
        else:
            for v in obj.values():
                units.extend(find_units(v))
    elif isinstance(obj, list):
        for item in obj:
            units.extend(find_units(item))
    return units

def patch_db():
    db = SessionLocal()
    rid = '91358c58-8347-4875-8098-1edb43f94260'
    r = db.query(SubjectRoadmap).filter(SubjectRoadmap.id == rid).first()
    if not r:
        print("Roadmap not found")
        return
        
    print(f"Patching roadmap: {r.id}")
    data = r.roadmap_data
    if "section_b" not in data:
        print("No section_b in DB record. Using last_roadmap.json if available.")
        try:
            data = json.load(open('last_roadmap.json', encoding='utf-8'))
        except:
            print("last_roadmap.json not found")
            return

    raw_units = find_units(data["section_b"])
    flattened_units = []
    for u in raw_units:
        unit_topics = extract_topics(u)
        flattened_units.append({
            "id": str(u.get("id") or u.get("uai") or random.randint(1000, 9999)),
            "title": str(u.get("title", "Untitled Unit")),
            "description": str(u.get("description", "")),
            "topics": unit_topics
        })
    
    data["units"] = flattened_units
    r.roadmap_data = data
    flag_modified(r, "roadmap_data")
    db.commit()
    print("Patch applied successfully")

if __name__ == "__main__":
    patch_db()
