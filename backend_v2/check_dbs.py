from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.course import Course
import os

db_paths = [
    r"D:\PROJECTS\LearNnEarn\ceditrees_dev.db",
    r"D:\PROJECTS\LearNnEarn\backend\ceditrees_dev.db",
    r"D:\PROJECTS\LearNnEarn\backend_v2\ceditrees_dev.db"
]

for path in db_paths:
    print(f"--- Checking {path} ---")
    if not os.path.exists(path):
        print("Does not exist")
        continue
    fixed_path = path.replace('\\', '/')
    engine = create_engine(f"sqlite:///{fixed_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        courses = db.query(Course).all()
        print(f"Found {len(courses)} courses:")
        for c in courses:
            print(f"  ID: {c.id}, Title: {c.title}")
    except Exception as e:
        print(f"Error: {e}")
    db.close()
