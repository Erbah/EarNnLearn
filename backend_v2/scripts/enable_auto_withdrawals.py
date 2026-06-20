import os
import sys

# Ensure backend_v2 is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.admin import SystemSetting

def enable_automated_withdrawals():
    db = SessionLocal()
    try:
        # Check if it already exists
        setting = db.query(SystemSetting).filter(SystemSetting.key == 'automated_withdrawals').first()
        if setting:
            setting.value = 'true'
            print("Updated existing setting 'automated_withdrawals' to 'true'")
        else:
            setting = SystemSetting(
                key='automated_withdrawals',
                value='true',
                description='Enable Paystack API Payouts'
            )
            db.add(setting)
            print("Inserted new setting 'automated_withdrawals' with value 'true'")
        
        db.commit()
        print("Success!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    enable_automated_withdrawals()
