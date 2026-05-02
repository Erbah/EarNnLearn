from app.core.database import SessionLocal
from app.services.ai_engine import ai_tutor_engine
import json

db = SessionLocal()
user_rid = "test_user_rid"
subject = "General Relativity & Curved Spacetime"

print(f"Generating roadmap for: {subject}")
roadmap = ai_tutor_engine.generate_roadmap(db, user_rid, subject)

if isinstance(roadmap, dict) and "error" in roadmap:
    print(f"ERROR: {roadmap['error']}")
    print(f"DETAILS: {roadmap.get('details')}")
else:
    print(f"SUCCESS: Roadmap ID: {roadmap.id}")
    print(f"Units: {len(roadmap.roadmap_data.get('units', []))}")

db.close()
