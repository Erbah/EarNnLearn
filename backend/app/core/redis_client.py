import os
import redis

redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

# Reusable Redis client for distributed locks and caching
redis_client = redis.from_url(redis_url)
