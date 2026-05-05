import redis
from app.core.config import settings

# Thread-safe reusable redis client with timeouts to prevent hangs if Redis is down
redis_client = redis.from_url(
    settings.REDIS_URL, 
    decode_responses=True,
    socket_timeout=1.0,
    socket_connect_timeout=1.0
)
