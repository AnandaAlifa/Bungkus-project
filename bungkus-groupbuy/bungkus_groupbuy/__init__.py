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

from .state_machine import (
    GroupBuyStateMachine,
    GroupBuyMeta,
    GroupBuyState,
    MemberRecord,
    PaymentStatus,
    EventType,
    EventPayload,
    StateTransitionResult,
)

from .webhook_handler import (
    PaymentWebhookHandler,
    PaymentProvider,
    MidtransWebhookPayload,
    XenditWebhookPayload,
    WebhookResponse,
)

from .events import (
    WSEvent,
    WSEventType,
    EventBuilder,
    GroupCreatedEvent,
    GroupUpdatedEvent,
    MemberJoinedEvent,
    MemberLeftEvent,
    QuotaMetEvent,
    GroupTimedOutEvent,
    PaymentHeldEvent,
    PaymentConfirmedEvent,
    PaymentFailedEvent,
    GroupLockedEvent,
    GroupCompletedEvent,
    GroupExpiredEvent,
    PriceUpdatedEvent,
    HeartbeatEvent,
    ErrorEvent,
)

__version__ = "1.0.0"

__all__ = [
    # State Machine
    "GroupBuyStateMachine",
    "GroupBuyMeta",
    "GroupBuyState",
    "MemberRecord",
    "PaymentStatus",
    "EventType",
    "EventPayload",
    "StateTransitionResult",
    
    # Webhook Handler
    "PaymentWebhookHandler",
    "PaymentProvider",
    "MidtransWebhookPayload",
    "XenditWebhookPayload",
    "WebhookResponse",
    
    # Events
    "WSEvent",
    "WSEventType",
    "EventBuilder",
    "GroupCreatedEvent",
    "GroupUpdatedEvent",
    "MemberJoinedEvent",
    "MemberLeftEvent",
    "QuotaMetEvent",
    "GroupTimedOutEvent",
    "PaymentHeldEvent",
    "PaymentConfirmedEvent",
    "PaymentFailedEvent",
    "GroupLockedEvent",
    "GroupCompletedEvent",
    "GroupExpiredEvent",
    "PriceUpdatedEvent",
    "HeartbeatEvent",
    "ErrorEvent",
]
