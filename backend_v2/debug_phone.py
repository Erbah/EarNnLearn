import sqlite3
import pandas as pd

conn = sqlite3.connect('ceditrees_dev.db')
query = "SELECT id, name, email, phone, parent_rid, status FROM users"
df = pd.read_sql_query(query, conn)
print(df[df['phone'].str.contains('200148419', na=False) | df['email'].str.contains('200148419', na=False)])
