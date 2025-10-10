import os
import redis

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 2))

print(f"🔗 Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}...")

try:
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
    r.ping()
    print("✅ Redis connection successful")
except redis.ConnectionError as e:
    print(f"❌ Redis connection failed: {e}")
    raise

def store_page_token(page_id: str, access_token: str, expires_in: int = 3600*24*30):
    key = f"page_token:{page_id}"
    r.setex(key, expires_in, access_token)
    print(f"✅ Stored token for page_id={page_id} with key={key}")
    return True

def get_page_token(page_id: str):
    key = f"page_token:{page_id}"
    print(f"🔍 Checking Redis for key: {key}")
    token = r.get(key)
    if token:
        print(f"✅ Found token for page_id={page_id}")
    else:
        print(f"⚠️ Token not found for page_id={page_id} in Redis {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
    return token

def delete_page_token(page_id: str):
    key = f"page_token:{page_id}"
    r.delete(key)
    print(f"🗑 Deleted token for page_id={page_id}")
    return True