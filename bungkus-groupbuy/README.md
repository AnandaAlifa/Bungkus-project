# Bungkus! Group Buy State Engine

Event-driven state machine for "Bungkus Bareng" flash sales with Redis distributed locking.

## Features

- **Atomic Operations**: Redis Lua scripts for race-condition-free slot reservation
- **State Machine**: Validated transitions (CREATED → WAITING_MEMBERS → LOCKED → COMPLETED)
- **Payment Webhooks**: Midtrans/Xendit integration with signature verification
- **WebSocket Events**: Real-time group sync payloads

## Installation

```bash
pip install -e ".[dev]"
```

## Usage

```python
import redis.asyncio as aioredis
from bungkus_groupbuy import GroupBuyStateMachine

# Connect to Redis
redis = aioredis.from_url("redis://localhost")

# Initialize state machine
sm = GroupBuyStateMachine(redis)

# Create group buy
meta = await sm.create_group_buy(
    product_id="prod-123",
    merchant_id="merch-456",
    leader_id="user-789",
    required_quota=10,
    expires_in_hours=2,
    original_price=20000,
    group_price=15000,
)

# Members join
result = await sm.join_group(meta.id, "user-101")
if result.event == EventType.QUOTA_MET:
    # Trigger payment for all members
    pass
```

## Running Tests

```bash
pytest tests/ -v
```
