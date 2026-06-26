import sqlite3

columns = [
    "payment_method",
    "payment_provider",
    "payment_identifier",
    "payout_method",
    "payout_provider",
    "payout_identifier",
    "payout_name",
    "paystack_customer_id"
]

conn = sqlite3.connect('d:/PROJECTS/LearNnEarn/backend/ceditrees_dev.db')
for col in columns:
    try:
        conn.execute(f"ALTER TABLE users ADD COLUMN {col} VARCHAR;")
    except sqlite3.OperationalError as e:
        print(f"Column {col} might already exist: {e}")
conn.commit()
conn.close()
print("Alterations complete.")
