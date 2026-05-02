import sqlite3
import json

conn = sqlite3.connect('ceditrees_dev.db')
cursor = conn.cursor()
cursor.execute('SELECT id, subject, roadmap_data FROM subject_roadmaps')
rows = cursor.fetchall()

print(f"Found {len(rows)} roadmaps.")
for row in rows:
    print(f"ID: {row[0]}, Subject: {row[1]}")
    try:
        data = json.loads(row[2])
        units = data.get('units', [])
        for unit in units:
            print(f"  Unit: {unit.get('title')}")
            for topic in unit.get('topics', []):
                print(f"    - {topic.get('title')} ({topic.get('uai')})")
    except:
        print("  Error parsing roadmap data")

conn.close()
