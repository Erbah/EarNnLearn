import redis
from app.core.config import settings

# Thread-safe reusable redis client matching the new config
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
