import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.course import Course, Module, Video

def check_video_ids(course_id: str):
    db = SessionLocal()
    try:
        modules = db.query(Module).filter(Module.course_id == course_id).all()
        for m in modules:
            videos = db.query(Video).filter(Video.module_id == m.id).all()
            print(f"Module: {m.title}")
            for v in videos[:3]: # Just check first 3
                print(f"  Video: {v.title}")
                print(f"  YouTube ID: {v.youtube_id}")
            
    finally:
        db.close()

if __name__ == "__main__":
    target_id = "525f0cc8-3eb1-466c-9eac-6b669ff743c8"
    check_video_ids(target_id)
