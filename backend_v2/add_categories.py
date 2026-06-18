import os
import sys

# Add the backend path to sys.path so app modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.marketplace import CourseCategory

def main():
    db = SessionLocal()
    existing_cats = [c.name for c in db.query(CourseCategory).all()]
    new_categories = [
        ("Science", "🔬"), ("Maths", "📐"), ("Technology", "🖥️")
    ]
    position = len(existing_cats)
    added = 0
    for name, icon in new_categories:
        if name not in existing_cats:
            db.add(CourseCategory(name=name, icon=icon, position=position))
            position += 1
            added += 1
            print(f"Adding category: {name}")

    if added > 0:
        db.commit()
        print(f"Added {added} new categories to the database.")
    else:
        print("Categories already exist.")
        
    db.close()

if __name__ == "__main__":
    main()
