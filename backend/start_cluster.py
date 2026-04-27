import multiprocessing
import uvicorn
import time
import os
import sys

# Ensure backend root is in path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

def run_service(app_module, port):
    print(f"Starting {app_module} on port {port}...")
    try:
        uvicorn.run(app_module, host="127.0.0.1", port=port, log_level="info")
    except Exception as e:
        print(f"Error in {app_module}: {e}")

def main():
    services = [
        ("auth_service.main:app", 8001),
        ("economy_service.main:app", 8002),
        ("referral_service.main:app", 8003),
        ("wallet_service.main:app", 8004),
        ("course_service.main:app", 8005),
        ("creator_service.main:app", 8006),
        ("ai_service.main:app", 8007),
        ("admin_service.main:app", 8008),
        ("analytics_service.main:app", 8009),
        ("season_service.main:app", 8010),
        ("api_gateway.main:app", 8000),
    ]

    processes = []
    for app_module, port in services:
        p = multiprocessing.Process(target=run_service, args=(app_module, port))
        p.start()
        processes.append(p)

    # Start Celery Worker (Windows requires -P solo)
    print("Starting Celery Worker...")
    import subprocess
    celery_proc = subprocess.Popen(
        ["celery", "-A", "app.core.celery_app", "worker", "--loglevel=info", "-P", "solo"],
        env=os.environ
    )

    print("--- Microservices Cluster Started ---")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
        celery_proc.terminate()
        for p in processes:
            p.terminate()

if __name__ == "__main__":
    # Standard check for absolute path database
    from common.core.config import settings
    print(f"Database Target: {settings.SQLALCHEMY_DATABASE_URI}")
    
    main()
