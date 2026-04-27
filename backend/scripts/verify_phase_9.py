import sys
import os
from sqlalchemy.orm import Session

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import SessionLocal, engine
from app.models import Base, Course, Module, Video, Season, User, Wallet
from app.services.ingestion_service import ingestion_service
from app.services.season_engine import season_engine

def verify_phase_9():
    # Reset DB for consistency
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("--- PHASE 9 VERIFICATION ---")
        
        # 1. Verify Ingestion (Simulation)
        # Using a reliable educational playlist
        test_playlist = "https://www.youtube.com/playlist?list=PLBlnK6fEyqRhqJPDXcvYlLfL97ZJdgP44" # C Programming playlist
        
        print(f"Testing ingestion for: {test_playlist}")
        try:
            course = ingestion_service.ingest_as_course(
                db=db,
                playlist_url=test_playlist,
                creator_rid="ADMIN_001",
                category="Programming",
                price=50.0
            )
            print(f"SUCCESS: Ingested Course '{course.title}' (ID: {course.id})")
            
            # Verify children
            modules = db.query(Module).filter(Module.course_id == course.id).all()
            print(f"Modules found: {len(modules)}")
            for m in modules:
                videos = db.query(Video).filter(Video.module_id == m.id).all()
                print(f"  Videos in module '{m.title}': {len(videos)}")
        except Exception as e:
            print(f"Ingestion failed: {e}")

        print("\n--- Season Management Verification ---")
        # 2. Verify Season Engine
        print("Starting Season 1...")
        s1 = season_engine.start_new_season(db, "Season 1")
        print(f"Season 1 ID: {s1.id}, Active: {s1.is_active}")
        
        print("Starting Season 2 (Check Auto-Close)...")
        s2 = season_engine.start_new_season(db, "Season 2")
        db.refresh(s1)
        print(f"Season 1 Active: {s1.is_active}, End Date: {s1.end_date}")
        print(f"Season 2 Active: {s2.is_active}, Prev Season: {s2.previous_season_id}")

        print("\n--- Leaderboard Verification ---")
        # Create a mock user/wallet for leaderboard
        user = User(username="top_earner", email="top@test.com", password_hash="hash")
        db.add(user)
        db.flush()
        db.add(Wallet(user_id=user.id, balance=500.0))
        db.commit()
        
        lb = season_engine.get_leaderboard(db)
        print("Top Earner:")
        for u, w in lb:
            print(f"  {u.username}: {w.balance}")

        print("\nPHASE 9 VERIFICATION COMPLETE")

    finally:
        db.close()

if __name__ == "__main__":
    verify_phase_9()
