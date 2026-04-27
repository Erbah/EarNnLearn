import redis
import json
from common.core.config import settings

# Shared Redis Client
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

# Cache Keys
CACHE_PREFIX = "ceditrees:v1"
ANCESTOR_CACHE_KEY = f"{CACHE_PREFIX}:ancestors:{{}}" # rid

def get_cached_ancestors(user_rid: str):
    """Retrieves the full list of ancestor RIDs for a user from Redis."""
    key = ANCESTOR_CACHE_KEY.format(user_rid)
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None

def set_cached_ancestors(user_rid: str, ancestors: list, ttl: int = 3600):
    """Stores the list of ancestor RIDs in Redis."""
    key = ANCESTOR_CACHE_KEY.format(user_rid)
    try:
        redis_client.setex(key, ttl, json.dumps(ancestors))
    except Exception:
        pass

def invalidate_ancestor_cache(user_rid: str):
    """Removes a specific user's ancestor cache."""
    key = ANCESTOR_CACHE_KEY.format(user_rid)
    try:
        redis_client.delete(key)
    except Exception:
        pass
