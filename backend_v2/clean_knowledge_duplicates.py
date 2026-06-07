import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.ai import KnowledgeSource
from collections import defaultdict

def clean_duplicates():
    db = SessionLocal()
    try:
        sources = db.query(KnowledgeSource).all()
        # Group by title and size (or filename and size)
        groups = defaultdict(list)
        for s in sources:
            key = (s.title, s.file_size_bytes)
            groups[key].append(s)
        
        for key, source_list in groups.items():
            if len(source_list) > 1:
                print(f"Found {len(source_list)} duplicates for '{key[0]}'")
                # Keep the first one (oldest), delete others
                source_list.sort(key=lambda x: x.created_at)
                to_keep = source_list[0]
                to_delete = source_list[1:]
                
                for s in to_delete:
                    print(f"  Deleting duplicate ID: {s.id}")
                    db.delete(s)
        
        db.commit()
        print("Cleanup complete.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_duplicates()
