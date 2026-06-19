import json
import logging
from redis.exceptions import RedisError
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

class CacheService:
    """
    A unified application-level caching service.
    Fails silently if Redis is down, gracefully degrading back to Postgres.
    """
    
    def get_json(self, key: str):
        """Retrieve and parse a JSON string from Redis."""
        try:
            cached_data = redis_client.get(key)
            if cached_data:
                logger.info(f"Cache HIT for key: {key}")
                return json.loads(cached_data)
            logger.debug(f"Cache MISS for key: {key}")
            return None
        except RedisError as e:
            logger.warning(f"Cache miss (Redis error): {e}")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Cache decode error for key {key}: {e}")
            return None

    def set_json(self, key: str, value: dict | list, expire_seconds: int = 3600):
        """Serialize and store a dictionary or list into Redis with a TTL."""
        try:
            # We use default str casting or a custom encoder if needed. 
            # We assume value is JSON serializable.
            json_str = json.dumps(value, default=str)
            redis_client.setex(key, expire_seconds, json_str)
            return True
        except RedisError as e:
            logger.warning(f"Cache set failed (Redis error): {e}")
            return False
        except TypeError as e:
            logger.warning(f"Cache set failed (JSON encode error) for key {key}: {e}")
            return False

    def invalidate(self, key: str):
        """Delete a specific key from Redis."""
        try:
            redis_client.delete(key)
        except RedisError as e:
            logger.warning(f"Cache invalidation failed for key {key}: {e}")

    def invalidate_pattern(self, pattern: str):
        """
        Delete multiple keys matching a pattern (e.g. 'roadmaps:*').
        Note: keys() is fine for small datasets, but for millions of keys, scan_iter is safer.
        """
        try:
            # Use scan_iter for safer production scaling instead of keys()
            keys_to_delete = []
            for key in redis_client.scan_iter(match=pattern, count=100):
                keys_to_delete.append(key)
            
            if keys_to_delete:
                redis_client.delete(*keys_to_delete)
                logger.info(f"Invalidated {len(keys_to_delete)} keys matching {pattern}")
        except RedisError as e:
            logger.warning(f"Cache pattern invalidation failed for {pattern}: {e}")

cache_service = CacheService()
