import yt_dlp
import uuid
from sqlalchemy.orm import Session
from app.models import Course, Module, Video
from decimal import Decimal

class PlaylistIngestor:
    """
    Automated service to ingest YouTube playlists as EarNnLearn Courses.
    """
    
    @staticmethod
    def extract_playlist_info(playlist_url: str):
        """
        Extracts metadata using yt-dlp.
        """
        ydl_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist',
            'skip_download': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(playlist_url, download=False)
                if 'entries' not in info:
                    raise Exception("Provided URL is not a playlist or no videos found.")
                
                return {
                    "title": info.get('title', 'Untitled Course'),
                    "description": info.get('description', ''),
                    "videos": [
                        {
                            "title": entry.get('title'),
                            "youtube_id": entry.get('id'),
                            "duration": entry.get('duration', 0), # in seconds
                        } for entry in info['entries']
                    ]
                }
            except Exception as e:
                print(f"Extraction Error: {e}")
                raise e

    @staticmethod
    def ingest_as_course(db: Session, playlist_url: str, creator_rid: str, category: str = "General", price: float = 0.0):
        """
        Main entry point for batch ingestion.
        Creates Course -> Module (single default) -> Videos.
        """
        raw_info = PlaylistIngestor.extract_playlist_info(playlist_url)
        
        # 1. Create Course
        new_course = Course(
            title=raw_info["title"],
            description=raw_info["description"],
            creator_rid=creator_rid,
            category=category,
            playlist_url=playlist_url,
            price=Decimal(str(price)),
            status="APPROVED" # Admin-injected are auto-approved
        )
        db.add(new_course)
        db.flush()
        
        # 2. Create single Module for all videos (simplest mapping)
        new_module = Module(
            course_id=new_course.id,
            title="Main Curriculum",
            position=1
        )
        db.add(new_module)
        db.flush()
        
        # 3. Create Videos
        for pos, vid_data in enumerate(raw_info["videos"], start=1):
            new_video = Video(
                module_id=new_module.id,
                title=vid_data["title"],
                youtube_id=vid_data["youtube_id"],
                duration=vid_data["duration"],
                position=pos
            )
            db.add(new_video)
            
        db.commit()
        return new_course

ingestion_service = PlaylistIngestor()
