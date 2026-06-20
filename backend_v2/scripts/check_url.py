import os
import sqlalchemy as sa
db_url = os.getenv('DATABASE_URL', '').replace('postgres://', 'postgresql://', 1)
engine = sa.create_engine(db_url)
engine.execute("UPDATE notifications SET link='/admin/content' WHERE link LIKE '/admin/courses/review/%'")
print("Updated notifications")
