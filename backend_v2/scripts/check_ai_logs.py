from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json
import sys
import os

# Set up DB connection
db_path = "d:/PROJECTS/LearNnEarn/backend_v2/ceditrees_dev.db"
engine = create_engine(f"sqlite:///{db_path}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_logs():
    db = SessionLocal()
    try:
        from app.models.monitoring import AIPerformanceLog
        logs = db.query(AIPerformanceLog).order_by(AIPerformanceLog.created_at.desc()).limit(10).all()
        print(f"{'Time':<20} | {'Type':<15} | {'Topic':<15} | {'Success':<8} | {'Reason':<30}")
        print("-" * 100)
        for log in logs:
            print(f"{str(log.created_at):<20} | {str(log.operation_type):<15} | {str(log.topic):<15} | {str(log.success):<8} | {str(log.failure_reason):<30}")
            if not log.success and log.operation_metadata:
                print(f"  Metadata: {log.operation_metadata}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_logs()
