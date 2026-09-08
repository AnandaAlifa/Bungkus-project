# ============================================================================
# BUNGKUS! — Redis Data Structures & Distributed Locking
# Key Naming Convention & Cache Eviction Strategy
# Version: 1.0.0 | Redis 7+ Required
# ============================================================================

## 1. KEY NAMING CONVENTION

```
Pattern:  bungkus:{namespace}:{entity}:{id}:{subkey}

Examples:
  bungkus:user:session:{user_id}              → Hash
  bungkus:product:{product_id}:price_cache    → String (JSON)
  bungkus:product:{product_id}:inventory      → Hash
  bungkus:lock:bungkus:product:{product_id}:inventory → String (lock token)
  bungkus:geo:merchants                        → GeoSet
  bungkus:geo:products                         → GeoSet
  bungkus:group_buy:{gb_id}:participants      → Set
  bungkus:group_buy:{gb_id}:quota             → String (atomic counter)
  bungkus:dynamic_price:{product_id}          → Hash
  bungkus:rate_limit:{user_id}:{endpoint}     → String (counter)
  bungkus:cart:{user_id}                      → Hash
```


## 2. REDIS DATA STRUCTURES

### 2.1 User Session
```redis
# Hash: stores active session data
KEY:    bungkus:user:session:{user_id}
FIELDS:
  user_id        → UUID
  token          → JWT (encrypted)
  refresh_token  → refresh JWT
  role           → CONSUMER | MERCHANT_ADMIN | MERCHANT_STAFF
  created_at     → ISO timestamp
  expires_at     → ISO timestamp
TTL:    24 hours (refresh before expiry via sliding window)
```

### 2.2 Product Price Cache (Dynamic Pricing)
```redis
# Hash: cached dynamic price for fast reads
KEY:    bungkus:product:{product_id}:price_cache
FIELDS:
  p_base         → original price (Rp)
  p_current      → dynamic price (Rp)
  p_min          → floor price (Rp)
  discount_pct   → current discount percentage
  last_update    → ISO timestamp of last price engine run
  next_decay_at  → ISO timestamp of next scheduled price drop
  version        → optimistic lock version (incremented on each update)
TTL:    Matches price decay interval (default: 3600 seconds = 1 hour)
        EXPIRE bungkus:product:{id}:price_cache 3600

# Why this matters:
# Consumer app reads price ~100x/sec during peak.
# Redis serves in <1ms vs PostgreSQL at ~5-20ms.
# TTL ensures price stays fresh without hammering DB.
```

### 2.3 Product Inventory (Atomic Operations)
```redis
# Hash: real-time inventory state
KEY:    bungkus:product:{product_id}:inventory
FIELDS:
  q_rem          → remaining quantity
  q_reserved     → reserved in carts / group buys
  q_init         → initial quantity (for % calculation)
  version        → optimistic lock version
TTL:    6 hours (re-synced from DB on cache miss)

# Atomic decrement during checkout:
# HINCRBY bungkus:product:{id}:inventory q_rem -1
# HINCRBY bungkus:product:{id}:inventory q_reserved 1

# Atomic release (cancellation):
# HINCRBY bungkus:product:{id}:inventory q_rem 1
# HINCRBY bungkus:product:{id}:inventory q_reserved -1
```

### 2.4 Geospatial Index (Merchant Discovery)
```redis
# Redis GEO for fast "near me" queries
KEY:    bungkus:geo:merchants
TYPE:   GEOSET
ADD:    GEOADD bungkus:geo:merchants {longitude} {latitude} {merchant_id}
QUERY:  GEORADIUS bungkus:geo:merchants {lng} {lat} {radius} km WITHDIST ASC

# Secondary index: products
KEY:    bungkus:geo:products
TYPE:   GEOSET
ADD:    GEOADD bungkus:geo:products {longitude} {latitude} {product_id}
QUERY:  GEORADIUS bungkus:geo:products {lng} {lat} {radius} km WITHDIST ASC

# TTL: 1 hour (synced from PostgreSQL PostGIS on cache miss)
# Update triggers: merchant location change, new product listing
```

### 2.5 Group Buy Quota (Atomic Counter)
```redis
# String: atomic counter for group buy participation
KEY:    bungkus:group_buy:{gb_id}:quota
VALUE:  5 (current participants)
TTL:    Matches group_buy.expires_at

# Atomic join:
# WATCH bungkus:group_buy:{gb_id}:quota
# MULTI
# INCR bungkus:group_buy:{gb_id}:quota
# EXEC

# Or use Lua script for atomic check-and-increment:
# local current = tonumber(redis.call('GET', KEYS[1]) or '0')
# if current < tonumber(ARGV[1]) then
#     redis.call('INCR', KEYS[1])
#     redis.call('EXPIRE', KEYS[1], ARGV[2])
#     return 1
# end
# return 0
```

### 2.6 Group Buy Participants
```redis
# Set: tracks which users are in a group buy
KEY:    bungkus:group_buy:{gb_id}:participants
TYPE:   SET
ADD:    SADD bungkus:group_buy:{gb_id}:participants {user_id}
CHECK:  SISMEMBER bungkus:group_buy:{gb_id}:participants {user_id}
COUNT:  SCARD bungkus:group_buy:{gb_id}:participants
TTL:    Matches group_buy.expires_at + 1 hour (for post-completion queries)
```

### 2.7 Shopping Cart
```redis
# Hash: user's current cart state
KEY:    bungkus:cart:{user_id}
FIELDS:
  {product_id}:qty       → quantity
  {product_id}:price     → locked price snapshot
  {product_id}:added_at  → ISO timestamp
  {group_buy_id}:gb      → 1 (if part of group buy)
TTL:    6 hours (abandoned cart cleanup)

# Cart price lock duration: 5 minutes
# If user doesn't checkout within 5 min, price lock expires
# and we re-fetch from dynamic pricing engine.
```

### 2.8 Rate Limiting
```redis
# String: sliding window rate limiter
KEY:    bungkus:rate_limit:{user_id}:{endpoint}
VALUE:  42 (request count)
TTL:    60 seconds (sliding window)

# Implementation: Redis Sliding Window with INCR + EXPIRE
# GET bungkus:rate_limit:{user_id}:{endpoint}
# IF count >= limit → REJECT (HTTP 429)
# ELSE INCR + EXPIRE
```


## 3. DISTRIBUTED LOCKING STRATEGY

### 3.1 Lock Key Pattern
```
KEY:    lock:bungkus:{namespace}:{entity}:{id}:{operation}
VALUES:
  token     → unique lock token (UUID + timestamp, for safe release)
  owner     → service instance ID
  acquired  → ISO timestamp
  expires   → ISO timestamp
TTL:    Lock timeout (default: 10 seconds for inventory, 30 seconds for group buy)
```

### 3.2 Inventory Lock (Product Stock Operations)
```redis
# ACQUIRE LOCK (SET NX EX):
# SET lock:bungkus:product:{product_id}:inventory "{token}" NX EX 10
#
# If return OK → lock acquired
# If return nil → lock held by another process → RETRY with exponential backoff

# RELEASE LOCK (Lua script for atomicity):
# if redis.call("GET", KEYS[1]) == ARGV[1] then
#     return redis.call("DEL", KEYS[1])
# else
#     return 0
# end

# Usage flow:
# 1. Consumer clicks "Buy Now"
# 2. Acquire lock: lock:bungkus:product:{id}:inventory
# 3. Read q_rem from Redis
# 4. If q_rem > 0: HINCRBY q_rem -1, HINCRBY q_reserved +1
# 5. Release lock
# 6. Create order in PostgreSQL (with fn_reserve_inventory)
# 7. If PostgreSQL fails: release inventory back in Redis
```

### 3.3 Group Buy Lock (Quota Join Operation)
```redis
# ACQUIRE LOCK:
# SET lock:bungkus:group_buy:{gb_id}:quota "{token}" NX EX 30
#
# Flow:
# 1. Consumer clicks "Join Group Buy"
# 2. Acquire lock: lock:bungkus:group_buy:{gb_id}:quota
# 3. Check current participants (SCARD)
# 4. Check user not already member (SISMEMBER)
# 5. If quota available and not duplicate: SADD participant, INCR quota
# 6. If quota met: update status to QUOTA_MET
# 7. Release lock
# 8. Create participant record in PostgreSQL
```

### 3.4 Lock Acquisition Strategy
```python
# Pseudocode for distributed lock acquisition with backoff

import time
import uuid

def acquire_lock(key, ttl_seconds=10, max_retries=5, base_delay_ms=50):
    token = f"{uuid.uuid4()}:{time.time()}"
    
    for attempt in range(max_retries):
        acquired = redis.set(key, token, nx=True, ex=ttl_seconds)
        
        if acquired:
            return token  # Lock acquired
        
        # Exponential backoff with jitter
        delay_ms = base_delay_ms * (2 ** attempt)
        jitter = random.randint(0, delay_ms // 2)
        time.sleep((delay_ms + jitter) / 1000)
    
    raise LockAcquisitionError(f"Failed to acquire lock {key} after {max_retries} retries")

def release_lock(key, token):
    # Lua script ensures we only release OUR lock
    script = """
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    else
        return 0
    end
    """
    return redis.eval(script, 1, key, token)
```


## 4. CACHE EVICTION STRATEGY

### 4.1 TTL-Based Expiration (Primary Strategy)
```redis
# All keys have explicit TTL to prevent memory bloat

Namespace              TTL              Rationale
─────────────────────────────────────────────────────
user:session           24h             Sliding window, refresh on activity
product:price_cache    1h              Matches price decay interval
product:inventory      6h              Re-synced on cache miss
geo:merchants          1h              Periodic sync from PostGIS
geo:products           1h              Periodic sync from PostGIS
group_buy:quota        expiry_at       Auto-expires with group buy
group_buy:participants expiry_at+1h    Post-completion grace period
cart                   6h              Abandoned cart cleanup
rate_limit             60s             Sliding window reset
```

### 4.2 LRU Eviction (Fallback for Memory Pressure)
```redis
# Redis config (redis.conf or CONFIG SET):
maxmemory 2gb
maxmemory-policy allkeys-lru

# This means: when memory hits 2GB, evict least-recently-used keys
# across all namespaces. TTL-based expiration is PRIMARY;
# LRU is only the safety net.
```

### 4.3 Cache Invalidation Events
```redis
# Publish/Subscribe for cross-service cache invalidation

CHANNEL: bungkus:cache:invalidate

MESSAGES:
  {
    "event": "price_updated",
    "product_id": "uuid",
    "old_price": 15000,
    "new_price": 12000,
    "trigger": "TIME_DECAY",
    "timestamp": "2026-09-07T10:30:00Z"
  }

  {
    "event": "inventory_changed",
    "product_id": "uuid",
    "q_rem": 3,
    "trigger": "ORDER_CREATED",
    "timestamp": "2026-09-07T10:30:00Z"
  }

  {
    "event": "group_buy_joined",
    "group_buy_id": "uuid",
    "current_quota": 8,
    "required_quota": 10,
    "timestamp": "2026-09-07T10:30:00Z"
  }
```


## 5. REDIS CLUSTER TOPOLOGY (Production)

```
┌─────────────────────────────────────────────────┐
│                REDIS CLUSTER                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Shard 1 (Master)     Shard 1 (Replica)         │
│  ┌──────────┐         ┌──────────┐               │
│  │ Redis 01 │ ──sync──│ Redis 02 │               │
│  │ 6379     │         │ 6380     │               │
│  └──────────┘         └──────────┘               │
│                                                  │
│  Shard 2 (Master)     Shard 2 (Replica)         │
│  ┌──────────┐         ┌──────────┐               │
│  │ Redis 03 │ ──sync──│ Redis 04 │               │
│  │ 6379     │         │ 6380     │               │
│  └──────────┘         └──────────┘               │
│                                                  │
│  Shard 3 (Master)     Shard 3 (Replica)         │
│  ┌──────────┐         ┌──────────┐               │
│  │ Redis 05 │ ──sync──│ Redis 06 │               │
│  │ 6379     │         │ 6380     │               │
│  └──────────┘         └──────────┘               │
│                                                  │
│  Sentinel (x3) for automatic failover            │
│                                                  │
└─────────────────────────────────────────────────┘

Key Distribution:
- Shard 1: user sessions, rate limits, carts
- Shard 2: product prices, inventory, geo data
- Shard 3: group buys, locks, pub/sub
```


## 6. REDIS CONFIGURATION (Production)

```redis
# redis.conf (key settings)

# Network
bind 0.0.0.0
port 6379
protected-mode yes
requirepass ${REDIS_PASSWORD}

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (RDB + AOF for durability)
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Performance
tcp-backlog 511
tcp-keepalive 300
timeout 0
databases 16

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```


## 7. MONITORING & ALERTS

```yaml
# Key metrics to monitor (Prometheus + Grafana)

metrics:
  - redis_connected_clients
  - redis_used_memory_bytes
  - redis_used_memory_peak_bytes
  - redis_keyspace_hits_total
  - redis_keyspace_misses_total
  - redis_commands_processed_total
  - redis_instantaneous_ops_per_sec
  - redis_rejected_connections_total
  - redis_latest_fork_usec

alerts:
  - name: redis_memory_high
    condition: redis_used_memory_bytes > 1.5GB (75% of 2GB)
    action: scale or flush stale keys
    
  - name: redis_hit_rate_low
    condition: (hits / (hits + misses)) < 0.8 for 5 minutes
    action: investigate cache invalidation patterns
    
  - name: redis_lock_contention_high
    condition: lock_acquisition_failures > 100/min
    action: increase lock TTL or add more shards
```
