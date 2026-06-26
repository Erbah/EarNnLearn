from celery import Celery
import os

# Allow overriding via environment variables, otherwise default to local redis
redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost")

celery_app = Celery(
    "earnnlearn",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.task_routes = {
    "app.tasks.profit_tasks.*": {"queue": "profit_queue"}
}
