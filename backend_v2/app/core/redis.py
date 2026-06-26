import redis
from app.core.config import settings

# Thread-safe reusable connection pool with max limits and connect timeouts
redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True,
    socket_timeout=1.0,
    socket_connect_timeout=1.0
)

redis_client = redis.Redis(connection_pool=redis_pool)

def get_redis_client():
    yield redis_client
