# ============================================================================
# BUNGKUS! Database Architecture
# ============================================================================
# Production-Grade PostgreSQL 15+ with PostGIS
# Sustainable Food-Waste Clearance & Social E-Commerce Platform
# ============================================================================

## File Structure

```
bungkus-db/
├── 00_extensions.sql              # Extensions & custom ENUM types
├── 01_schema_users_merchants.sql  # Users + Merchants (with PostGIS location)
├── 02_schema_products.sql         # Products + Categories + Inventory
├── 03_schema_orders_groupbuys.sql # Orders + Group Buys + Participants
├── 04_schema_payments_notifications_audit.sql
│                                 # Payments + Notifications + Reviews + Audit Trail
├── 05_functions.sql               # Business logic (auto-delist, reserve, pickup, etc.)
├── 06_views.sql                   # Spatial views + Analytics views
├── 07_redis_strategy.md           # Redis key conventions + distributed locking
└── 00_run_all.sql                 # Master runner script
```

## Quick Start

```bash
# Create database
createdb -U postgres bungkus

# Run full schema
psql -U postgres -d bungkus -f 00_run_all.sql

# Verify
psql -U postgres -d bungkus -c "\dt"   # List all tables
psql -U postgres -d bungkus -c "\di"   # List all indexes
```

## Schema Overview

### Tables (15 total)

| Table                    | Purpose                                    | Row Est. (Y1) |
|--------------------------|--------------------------------------------|---------------|
| users                    | Unified consumer + merchant user accounts  | 100K          |
| merchants                | B2B merchant profiles with PostGIS location | 5K            |
| merchant_staff           | Merchant team member permissions           | 15K           |
| product_categories       | Food category taxonomy with carbon factors | 10            |
| products                 | Near-expiry listings with dynamic pricing  | 500K          |
| group_buys               | "Bungkus Bareng" group buy sessions        | 50K           |
| group_buy_participants   | Individual joins per group buy             | 250K          |
| orders                   | Purchase orders (direct + group)           | 200K          |
| order_items              | Line items per order                       | 400K          |
| payments                 | Payment ledger with gateway details        | 250K          |
| notifications            | Push/email/SMS notification queue          | 2M            |
| reviews                  | Merchant ratings and food quality feedback | 100K          |
| audit_log                | Immutable audit trail (append-only)        | 5M            |
| product_price_history    | Dynamic price change log                   | 2M            |

### Indexes (30+ total)

| Index                              | Type   | Purpose                              |
|------------------------------------|--------|--------------------------------------|
| idx_merchants_location             | GIST   | Spatial: "find merchants near me"    |
| idx_products_location              | GIST   | Spatial: "find products near me"     |
| idx_products_active_near           | BTREE  | Fast expiry lookup for active items  |
| idx_products_status                | BTREE  | Filter by status + expiry            |
| idx_group_buys_open                | BTREE  | Active group buys for discovery      |
| idx_orders_qr_hash                 | BTREE  | QR verification lookup               |
| idx_orders_pickup_deadline         | BTREE  | Pickup timeout monitoring            |
| idx_audit_entity                   | BTREE  | Compliance audit queries             |

### Key Functions

| Function                    | Purpose                                  |
|-----------------------------|------------------------------------------|
| fn_auto_delist_products()   | Mark expired products, called by cron    |
| fn_expire_group_buys()      | Close expired group buys                 |
| fn_reserve_inventory()      | Atomic stock reservation with row lock   |
| fn_release_inventory()      | Release reserved stock on cancellation   |
| fn_confirm_pickup()         | QR verification and order completion     |
| fn_anonymize_user()         | UU PDP right to erasure                  |
| fn_generate_order_number()  | BG-YYYYMMDD-XXXXX format                |
| fn_update_merchant_rating() | Auto-recalculate merchant avg rating     |

## Redis Strategy Summary

### Key Patterns

```
bungkus:user:session:{user_id}              → Session cache (24h TTL)
bungkus:product:{product_id}:price_cache    → Dynamic price (1h TTL)
bungkus:product:{product_id}:inventory      → Atomic stock ops
bungkus:geo:merchants                        → GEOSET for spatial queries
bungkus:geo:products                         → GEOSET for spatial queries
bungkus:group_buy:{gb_id}:quota             → Atomic participant counter
bungkus:group_buy:{gb_id}:participants      → SET of joined users
bungkus:cart:{user_id}                      → Shopping cart (6h TTL)
bungkus:rate_limit:{user_id}:{endpoint}     → Sliding window limiter
lock:bungkus:product:{id}:inventory         → Distributed lock (10s TTL)
lock:bungkus:group_buy:{id}:quota           → Distributed lock (30s TTL)
```

### Distributed Lock Flow

```
1. Consumer clicks "Buy Now"
2. ACQUIRE: SET lock:bungkus:product:{id}:inventory "{token}" NX EX 10
3. READ:    HGET bungkus:product:{id}:inventory q_rem
4. CHECK:   q_rem > 0 ?
5. WRITE:   HINCRBY q_rem -1, HINCRBY q_reserved +1
6. RELEASE: Lua script (compare token before DEL)
7. PERSIST: INSERT into PostgreSQL orders table
8. FALLBACK: If PostgreSQL fails → fn_release_inventory()
```

### Cache Eviction

- **Primary**: TTL-based expiration (all keys have explicit TTL)
- **Fallback**: Redis LRU eviction at maxmemory (2GB limit)
- **Invalidation**: Pub/Sub channel `bungkus:cache:invalidate` for cross-service sync

## UU PDP Compliance

| Requirement        | Implementation                                    |
|--------------------|---------------------------------------------------|
| Right to Erasure   | `deleted_at` soft-delete on all user-facing tables|
| Data Anonymization | `fn_anonymize_user()` replaces PII with hashes    |
| Audit Trail        | `audit_log` table (immutable, append-only)        |
| Data Classification| `data_classification` field on audit entries      |
| Consent Tracking   | `notification_prefs` JSONB per user               |

## Performance Targets

| Query                        | Target Latency | Index Used          |
|------------------------------|---------------|---------------------|
| Find products within 5km     | < 50ms        | GIST on location    |
| Dynamic price lookup         | < 1ms         | Redis cache         |
| Reserve inventory            | < 50ms        | Row-level lock      |
| QR verification              | < 100ms       | BTREE on qr_hash    |
| Group buy join               | < 100ms       | Redis distributed lock |
| Merchant analytics dashboard | < 200ms       | Denormalized metrics |
