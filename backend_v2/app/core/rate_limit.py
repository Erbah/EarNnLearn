import time
import uuid
import logging
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException, status
from app.core.redis import redis_client
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, key_prefix: str):
        self.limit = limit
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        
        # Thread-safe in-memory fallback storage
        self._memory_storage = defaultdict(list)
        self._lock = Lock()

    async def __call__(self, request: Request):
        # Determine client IP
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Get the first IP if there is a list (e.g. proxies)
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        key = f"{self.key_prefix}:{client_ip}"
        now = time.time()

        # Try Redis first
        try:
            pipeline = redis_client.pipeline()
            # Remove elements older than window_seconds
            pipeline.zremrangebyscore(key, 0, now - self.window_seconds)
            # Add current timestamp with a unique value to prevent overwrites
            unique_val = f"{now}-{uuid.uuid4()}"
            pipeline.zadd(key, {unique_val: now})
            # Get current card
            pipeline.zcard(key)
            # Refresh TTL
            pipeline.expire(key, self.window_seconds)
            
            # Execute pipeline
            _, _, count, _ = pipeline.execute()
            
            if count > self.limit:
                logger.warning(f"Rate limit exceeded for {self.key_prefix} from IP {client_ip}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            return
        except RedisError as re:
            # Log redis failure and use memory fallback
            logger.warning(f"Redis rate limiter failed, falling back to in-memory: {re}")
        
        # In-memory fallback
        with self._lock:
            cutoff = now - self.window_seconds
            timestamps = self._memory_storage[client_ip]
            # Keep only timestamps within window
            timestamps = [t for t in timestamps if t > cutoff]
            
            if len(timestamps) >= self.limit:
                self._memory_storage[client_ip] = timestamps
                logger.warning(f"Memory Rate limit exceeded for {self.key_prefix} from IP {client_ip}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            
            timestamps.append(now)
            self._memory_storage[client_ip] = timestamps

# Instantiations as dependencies
login_rate_limiter = RateLimiter(limit=5, window_seconds=60, key_prefix="rate_limit:login")
register_rate_limiter = RateLimiter(limit=3, window_seconds=60, key_prefix="rate_limit:register")
otp_rate_limiter = RateLimiter(limit=3, window_seconds=60, key_prefix="rate_limit:otp")
upload_rate_limiter = RateLimiter(limit=5, window_seconds=60, key_prefix="rate_limit:upload")
payment_verify_limiter = RateLimiter(limit=5, window_seconds=60, key_prefix="rate_limit:payment_verify")
