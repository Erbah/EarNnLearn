import sqlite3
import os
from datetime import datetime

db_path = "d:\\PROJECTS\\LearNnEarn\\backend\\ceditrees_dev.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Add last_used column if missing
try:
    cursor.execute("ALTER TABLE codes ADD COLUMN last_used DATETIME")
    print("Added 'last_used' column to 'codes' table.")
except sqlite3.OperationalError:
    print("'last_used' column already exists.")

# 2. Seed some codes if the pool is empty
cursor.execute("SELECT COUNT(*) FROM codes WHERE tier_type = 'public'")
count = cursor.fetchone()[0]

if count == 0:
    print("Seeding marketplace with test codes...")
    # Generate some realistic looking codes
    test_codes = [
        ("CT-A8K3-L9Q2", "public", 50.0),
        ("CT-P4X7-T1M8", "public", 50.0),
        ("CT-Z9R2-K6J5", "public", 50.0),
        ("CT-M3F8-W2L9", "public", 50.0)
    ]
    
    for product_code, tier, price in test_codes:
        # Mock owner_rid (system owned)
        owner_rid = "SYSTEM"
        cursor.execute("""
            INSERT INTO codes (id, product_code, owner_rid, tier_type, price, is_active, last_used, usage_count)
            VALUES (?, ?, ?, ?, ?, 1, ?, 0)
        """, (
            os.urandom(16).hex(), # Random hex for UUID in sqlite
            product_code,
            owner_rid,
            tier,
            price,
            datetime.utcnow().isoformat()
        ))
    conn.commit()
    print(f"Seeded {len(test_codes)} codes.")
else:
    print(f"Marketplace already has {count} public codes.")

conn.close()
