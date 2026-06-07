from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.ai import SubjectRoadmap, AILesson
import uuid
from datetime import datetime

def seed_library():
    db = SessionLocal()
    try:
        # 1. Seed Roadmaps
        roadmaps = [
            {
                "subject": "Quantum Computing",
                "difficulty_level": "advanced",
                "is_public": True,
                "popularity_score": 95,
                "roadmap_data": {
                    "units": [
                        {"title": "Qubits and Superposition", "topics": ["Linear Algebra", "Dirac Notation", "Bloch Sphere"]},
                        {"title": "Quantum Algorithms", "topics": ["Deutsch-Jozsa", "Grover's Search", "Shor's Factoring"]}
                    ]
                }
            },
            {
                "subject": "Sustainable Architecture",
                "difficulty_level": "intermediate",
                "is_public": True,
                "popularity_score": 88,
                "roadmap_data": {
                    "units": [
                        {"title": "Passive Solar Design", "topics": ["Orientation", "Thermal Mass", "Insulation"]},
                        {"title": "Eco-Friendly Materials", "topics": ["Recycled Concrete", "Bamboo Framing", "Hempcrete"]}
                    ]
                }
            }
        ]

        for r_data in roadmaps:
            existing = db.query(SubjectRoadmap).filter(SubjectRoadmap.subject == r_data["subject"]).first()
            if not existing:
                r = SubjectRoadmap(
                    id=str(uuid.uuid4()),
                    user_rid="system_seed",
                    subject=r_data["subject"],
                    difficulty_level=r_data["difficulty_level"],
                    is_public=r_data["is_public"],
                    popularity_score=r_data["popularity_score"],
                    roadmap_data=r_data["roadmap_data"],
                    dependency_graph={},
                    version=1,
                    created_at=datetime.utcnow()
                )
                db.add(r)

        # 2. Seed Lessons
        lessons = [
            {
                "topic": "Neural Networks",
                "title": "Architecture of the Brain",
                "is_public": True,
                "popularity_score": 92,
                "scenes": [
                    {"title": "The Neuron Model", "content": "Visualizing the mathematical neuron..."},
                    {"title": "Backpropagation", "content": "How machines learn from error..."}
                ]
            }
        ]

        for l_data in lessons:
            existing = db.query(AILesson).filter(AILesson.topic == l_data["topic"]).first()
            if not existing:
                l = AILesson(
                    id=str(uuid.uuid4()),
                    creator_rid="system_seed",
                    topic=l_data["topic"],
                    title=l_data["title"],
                    is_public=l_data["is_public"],
                    popularity_score=l_data["popularity_score"],
                    scenes=l_data["scenes"],
                    total_scenes=len(l_data["scenes"]),
                    version=1,
                    created_at=datetime.utcnow()
                )
                db.add(l)

        db.commit()
        print("Knowledge Library seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_library()
