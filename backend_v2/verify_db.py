from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap, AILesson
import json

db = SessionLocal()

print("ROADMAPS:")
roadmaps = db.query(SubjectRoadmap).all()
for r in roadmaps:
    print(f"ID: {r.id}, Subject: {r.subject}")

print("\nLESSONS:")
lessons = db.query(AILesson).order_by(AILesson.created_at.desc()).limit(5).all()
for l in lessons:
    print(f"ID: {l.id}, Topic: {l.topic}")

db.close()
