from celery import Celery
import os

redis_url = os.getenv("REDIS_URL", "redis://localhost")

celery_app = Celery(
    "cedi_workers",
    broker=redis_url,
    backend=redis_url,
    include=["app.workers.profit_tasks", "app.workers.ai_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
