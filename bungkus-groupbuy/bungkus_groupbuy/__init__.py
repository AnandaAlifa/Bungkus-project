"""
Bungkus! Group Buy — Event-Driven State Engine
================================================
Resilient Group Buying State Engine for "Bungkus Bareng" flash sales.
Handles high concurrency with Redis distributed locking.

Usage:
    from bungkus_groupbuy import GroupBuyStateMachine, PaymentWebhookHandler
    
    # Initialize
    redis = aioredis.from_url("redis://localhost")
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
    
    # Join group buy
    result = await sm.join_group(meta.id, "user-101")
"""

from .events import (
    ErrorEvent,
    EventBuilder,
    GroupCompletedEvent,
    GroupCreatedEvent,
    GroupExpiredEvent,
    GroupLockedEvent,
    GroupTimedOutEvent,
    GroupUpdatedEvent,
    HeartbeatEvent,
    MemberJoinedEvent,
    MemberLeftEvent,
    PaymentConfirmedEvent,
    PaymentFailedEvent,
    PaymentHeldEvent,
    PriceUpdatedEvent,
    QuotaMetEvent,
    WSEvent,
    WSEventType,
)
from .state_machine import (
    EventPayload,
    EventType,
    GroupBuyMeta,
    GroupBuyState,
    GroupBuyStateMachine,
    MemberRecord,
    PaymentStatus,
    StateTransitionResult,
)
from .webhook_handler import (
    MidtransWebhookPayload,
    PaymentProvider,
    PaymentWebhookHandler,
    WebhookResponse,
    XenditWebhookPayload,
)

__version__ = "1.0.0"

__all__ = [
    # Events
    "ErrorEvent",
    # State Machine
    "EventBuilder",
    "EventPayload",
    "EventType",
    "GroupBuyMeta",
    "GroupBuyState",
    "GroupBuyStateMachine",
    "GroupCompletedEvent",
    "GroupCreatedEvent",
    "GroupExpiredEvent",
    "GroupLockedEvent",
    "GroupTimedOutEvent",
    "GroupUpdatedEvent",
    "HeartbeatEvent",
    "MemberJoinedEvent",
    "MemberLeftEvent",
    "MemberRecord",
    # Webhook Handler
    "MidtransWebhookPayload",
    "PaymentConfirmedEvent",
    "PaymentFailedEvent",
    "PaymentHeldEvent",
    "PaymentProvider",
    "PaymentStatus",
    "PaymentWebhookHandler",
    "PriceUpdatedEvent",
    "QuotaMetEvent",
    "StateTransitionResult",
    "WSEvent",
    "WSEventType",
    "WebhookResponse",
    "XenditWebhookPayload",
]
