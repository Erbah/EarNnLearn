import sqlite3, json

conn = sqlite3.connect('ceditrees_dev.db')
cur = conn.cursor()
cur.execute('SELECT id, user_rid, subject, roadmap_data, difficulty_level, learning_goal FROM subject_roadmaps LIMIT 1')
row = cur.fetchone()
if row:
    print(f"ID: {row[0]}")
    print(f"User: {row[1]}")
    print(f"Subject: {row[2]}")
    data = json.loads(row[3]) if row[3] else {}
    print(f"Keys: {list(data.keys())}")
    units = data.get("units", [])
    print(f"Units: {len(units)}")
    for u in units:
        topics = u.get("topics", [])
        print(f"  Unit: {u.get('title')} ({len(topics)} topics)")
        for t in topics[:2]:
            print(f"    Topic: {t}")
    # Print section_a if exists
    if "section_a" in data:
        print(f"\nsection_a: {json.dumps(data['section_a'], indent=2)[:500]}")
else:
    print("No roadmaps found")
conn.close()
