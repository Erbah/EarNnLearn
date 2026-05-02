import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.ingestion_service import ingestion_service

def fix_course(course_id: str):
    try:
        print(f"Starting ingestion for course: {course_id}...")
        ingestion_service.process_playlist(course_id)
        print("Done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # The course ID from the user's screenshot
    target_id = "525f0cc8-3eb1-466c-9eac-6b669ff743c8"
    fix_course(target_id)
