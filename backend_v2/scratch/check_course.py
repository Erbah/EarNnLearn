import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.course import Course, Module, Video

def check_course(course_id: str):
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            print(f"Course {course_id} not found.")
            return
        
        print(f"Course: {course.title}")
        print(f"Playlist URL: {course.playlist_url}")
        
        modules = db.query(Module).filter(Module.course_id == course_id).all()
        print(f"Modules Count: {len(modules)}")
        
        for m in modules:
            videos = db.query(Video).filter(Video.module_id == m.id).all()
            print(f"  Module '{m.title}' has {len(videos)} videos.")
            
    finally:
        db.close()

if __name__ == "__main__":
    target_id = "525f0cc8-3eb1-466c-9eac-6b669ff743c8"
    check_course(target_id)
