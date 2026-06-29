import yt_dlp
import uuid
from sqlalchemy.orm import Session
from app.models.course import Course, Module, Video
from app.core.database import SessionLocal
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
            'ignoreerrors': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(playlist_url, download=False)
                if not info or 'entries' not in info:
                    raise Exception("Provided URL is not a playlist or no videos found.")
                
                # Filter out entries that failed to load (entries might be None if ignoreerrors is True)
                valid_entries = [entry for entry in info['entries'] if entry is not None]
                
                return {
                    "title": info.get('title', 'Untitled Course'),
                    "description": info.get('description', ''),
                    "videos": [
                        {
                            "title": entry.get('title'),
                            "youtube_id": entry.get('id'),
                            "duration": entry.get('duration', 0), # in seconds
                        } for entry in valid_entries
                    ]
                }
            except Exception as e:
                print(f"Extraction Error: {e}")
                raise e

    @staticmethod
    def fetch_youtube_transcript(youtube_id: str) -> str:
        """
        Fetches the transcript for a YouTube video using the youtube-transcript-api.
        Tries manual English first, then falls back to translation or any generated sub.
        Returns the raw text as a continuous string.
        """
        import re
        youtube_id = youtube_id.strip()
        if not (len(youtube_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', youtube_id)):
            match = re.search(r'(?:v=|\/embed\/|\/v\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', youtube_id)
            if match:
                youtube_id = match.group(1)

        from youtube_transcript_api import YouTubeTranscriptApi
        try:
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.list(youtube_id)
            # Try to get english first
            try:
                transcript = transcript_list.find_transcript(['en'])
            except:
                # Fallback to the first available transcript (often auto-generated)
                transcript = transcript_list.find_generated_transcript(['en'])
                
            pieces = transcript.fetch()
            # Join all pieces into a single text block
            full_text = " ".join([getattr(p, 'text', p.get('text', '') if isinstance(p, dict) else '') for p in pieces])
            return full_text
        except Exception as e:
            print(f"Transcript Fetch Error for {youtube_id}: {str(e)}")
            return ""

    @staticmethod
    def process_playlist(course_id: str):
        """
        Processes a playlist for an existing course.
        Creates its own DB session to be background-task safe.
        """
        db = SessionLocal()
        try:
            course = db.query(Course).filter(Course.id == course_id).first()
            if not course or not course.playlist_url:
                print(f"Ingestion Error: Course {course_id} not found or has no playlist URL.")
                return

            print(f"Ingestion Started: Processing playlist for course {course_id} ({course.playlist_url})")
            raw_info = PlaylistIngestor.extract_playlist_info(course.playlist_url)
            
            # 1. Update Course Info if missing
            if not course.description:
                course.description = raw_info["description"][:1000] # Cap description length
            
            # 2. Check if modules already exist to avoid duplicates
            existing_modules = db.query(Module).filter(Module.course_id == course_id).count()
            if existing_modules > 0:
                print(f"Ingestion Note: Course {course_id} already has modules. Skipping ingestion.")
                return

            # 3. Create single Module for all videos
            new_module = Module(
                course_id=course_id,
                title="Main Curriculum",
                position=1
            )
            db.add(new_module)
            db.flush()
            
            # 4. Create Videos
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
            print(f"Ingestion Success: Processed {len(raw_info['videos'])} videos for course {course_id}")
        except Exception as e:
            print(f"Ingestion Failed for course {course_id}: {str(e)}")
            db.rollback()
        finally:
            db.close()

ingestion_service = PlaylistIngestor()
