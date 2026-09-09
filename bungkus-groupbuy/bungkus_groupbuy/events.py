"""
Bungkus! Group Buy — WebSocket Event Schemas
=============================================
Real-time event payloads for Group Buy ("Bungkus Bareng")
pushed to nearby clients via WebSocket connections.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# EVENT TYPES
# ============================================================================

class WSEventType(str, Enum):
    """WebSocket event types for Group Buy."""
    
    # Lifecycle events
    GROUP_CREATED = "GROUP_CREATED"
    GROUP_UPDATED = "GROUP_UPDATED"
    GROUP_TIMED_OUT = "GROUP_TIMED_OUT"
    GROUP_CANCELLED = "GROUP_CANCELLED"
    
    # Member events
    MEMBER_JOINED = "MEMBER_JOINED"
    MEMBER_LEFT = "MEMBER_LEFT"
    MEMBER_COUNT_UPDATED = "MEMBER_COUNT_UPDATED"
    
    # Quota events
    QUOTA_MET = "QUOTA_MET"
    QUOTA_UNMET = "QUOTA_UNMET"
    
    # Payment events
    PAYMENT_HELD = "PAYMENT_HELD"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_REFUNDED = "PAYMENT_REFUNDED"
    
    # State transition events
    GROUP_LOCKED = "GROUP_LOCKED"
    GROUP_COMPLETED = "GROUP_COMPLETED"
    GROUP_EXPIRED = "GROUP_EXPIRED"
    
    # Pricing events
    PRICE_UPDATED = "PRICE_UPDATED"
    
    # System events
    HEARTBEAT = "HEARTBEAT"
    ERROR = "ERROR"


# ============================================================================
# BASE EVENT SCHEMA
# ============================================================================

class WSEvent(BaseModel):
    """Base WebSocket event schema."""
    
    event_type: WSEventType
    group_buy_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    data: dict[str, Any] = Field(default_factory=dict)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "event_type": "MEMBER_JOINED",
                "group_buy_id": "550e8400-e29b-41d4-a716-446655440000",
                "timestamp": "2026-09-07T12:00:00Z",
                "data": {
                    "user_id": "user-123",
                    "display_name": "Budi",
                    "current_quota": 5,
                    "required_quota": 10,
                },
            }
        }
    )


# ============================================================================
# SPECIFIC EVENT SCHEMAS
# ============================================================================

class GroupCreatedEvent(WSEvent):
    """Emitted when a new group buy is created."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_CREATED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "product_id": "",
        "product_name": "",
        "product_image": "",
        "merchant_id": "",
        "merchant_name": "",
        "leader_id": "",
        "leader_name": "",
        "original_price": 0,
        "group_price": 0,
        "discount_pct": 0,
        "required_quota": 0,
        "max_quota": 0,
        "expires_at": "",
        "location": {"lng": 0, "lat": 0},
    })


class GroupUpdatedEvent(WSEvent):
    """Emitted on any group buy state change."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_UPDATED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "old_state": "",
        "new_state": "",
        "current_quota": 0,
        "required_quota": 0,
        "time_remaining_seconds": 0,
    })


class MemberJoinedEvent(WSEvent):
    """Emitted when a new member joins the group buy."""
    
    event_type: WSEventType = Field(default=WSEventType.MEMBER_JOINED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "user_id": "",
        "display_name": "",
        "avatar_url": "",
        "reserved_qty": 1,
        "current_quota": 0,
        "required_quota": 0,
        "progress_pct": 0,
        "recent_members": [],  # Last 5 members for social proof
    })


class MemberLeftEvent(WSEvent):
    """Emitted when a member leaves the group buy."""
    
    event_type: WSEventType = Field(default=WSEventType.MEMBER_LEFT, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "user_id": "",
        "display_name": "",
        "reserved_qty": 1,
        "current_quota": 0,
        "required_quota": 0,
        "reason": "voluntary",  # voluntary, payment_failed, timeout
    })


class QuotaMetEvent(WSEvent):
    """Emitted when the minimum quota is reached."""
    
    event_type: WSEventType = Field(default=WSEventType.QUOTA_MET, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "current_quota": 0,
        "required_quota": 0,
        "excess_members": 0,
        "message": "Target achieved! Payment window opening...",
    })


class GroupTimedOutEvent(WSEvent):
    """Emitted when the group buy timer expires."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_TIMED_OUT, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "final_quota": 0,
        "required_quota": 0,
        "was_successful": False,
        "message": "Time's up! Group buy has ended.",
        "refund_info": {
            "auto_refund": True,
            "estimated_refund_time": "1-3 business days",
        },
    })


class PaymentHeldEvent(WSEvent):
    """Emitted when a payment is held in escrow."""
    
    event_type: WSEventType = Field(default=WSEventType.PAYMENT_HELD, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "user_id": "",
        "payment_id": "",
        "amount": 0,
        "currency": "IDR",
        "payment_method": "",
        "expires_at": "",
    })


class PaymentConfirmedEvent(WSEvent):
    """Emitted when a payment is confirmed."""
    
    event_type: WSEventType = Field(default=WSEventType.PAYMENT_CONFIRMED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "user_id": "",
        "payment_id": "",
        "amount": 0,
        "confirmed_at": "",
        "total_paid": 0,
        "total_expected": 0,
    })


class PaymentFailedEvent(WSEvent):
    """Emitted when a payment fails."""
    
    event_type: WSEventType = Field(default=WSEventType.PAYMENT_FAILED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "user_id": "",
        "payment_id": "",
        "failure_reason": "",
        "retry_available": True,
        "retry_deadline": "",
    })


class GroupLockedEvent(WSEvent):
    """Emitted when all payments are confirmed and group is locked."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_LOCKED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "total_members": 0,
        "total_amount": 0,
        "currency": "IDR",
        "pickup_deadline": "",
        "message": "All payments confirmed! Ready for pickup.",
    })


class GroupCompletedEvent(WSEvent):
    """Emitted when the group buy is completed (all items picked up)."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_COMPLETED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "total_members": 0,
        "total_savings": 0,
        "carbon_saved_kg": 0,
        "completed_at": "",
        "message": "Group buy completed! Thank you for reducing food waste!",
    })


class GroupExpiredEvent(WSEvent):
    """Emitted when the group buy expires (quota not met)."""
    
    event_type: WSEventType = Field(default=WSEventType.GROUP_EXPIRED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "final_quota": 0,
        "required_quota": 0,
        "reason": "quota_not_met",
        "refund_info": {
            "auto_refund": True,
            "estimated_time": "1-3 business days",
        },
        "message": "Group buy did not reach target. Full refund processing.",
    })


class PriceUpdatedEvent(WSEvent):
    """Emitted when the dynamic price changes."""
    
    event_type: WSEventType = Field(default=WSEventType.PRICE_UPDATED, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "product_id": "",
        "old_price": 0,
        "new_price": 0,
        "discount_pct": 0,
        "reason": "time_decay",
    })


class HeartbeatEvent(WSEvent):
    """Heartbeat event to keep connection alive."""
    
    event_type: WSEventType = Field(default=WSEventType.HEARTBEAT, frozen=True)
    data: dict[str, Any] = Field(default_factory=lambda: {
        "server_time": datetime.now(UTC).isoformat(),
    })


class ErrorEvent(WSEvent):
    """Error event for client-side handling."""
    
    event_type: WSEventType = Field(default=WSEventType.ERROR, frozen=True)
    
    data: dict[str, Any] = Field(default_factory=lambda: {
        "error_code": "",
        "error_message": "",
        "retryable": True,
    })


# ============================================================================
# EVENT BUILDER HELPERS
# ============================================================================

class EventBuilder:
    """Helper class to build WebSocket events."""
    
    @staticmethod
    def member_joined(
        group_buy_id: str,
        user_id: str,
        display_name: str,
        avatar_url: str,
        reserved_qty: int,
        current_quota: int,
        required_quota: int,
        recent_members: list[dict[str, Any]] | None = None,
    ) -> MemberJoinedEvent:
        """Build a MEMBER_JOINED event."""
        progress_pct = (current_quota / required_quota * 100) if required_quota > 0 else 0
        
        return MemberJoinedEvent(
            group_buy_id=group_buy_id,
            data={
                "user_id": user_id,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "reserved_qty": reserved_qty,
                "current_quota": current_quota,
                "required_quota": required_quota,
                "progress_pct": round(progress_pct, 1),
                "recent_members": recent_members or [],
            },
        )
    
    @staticmethod
    def quota_met(
        group_buy_id: str,
        current_quota: int,
        required_quota: int,
    ) -> QuotaMetEvent:
        """Build a QUOTA_MET event."""
        return QuotaMetEvent(
            group_buy_id=group_buy_id,
            data={
                "current_quota": current_quota,
                "required_quota": required_quota,
                "excess_members": current_quota - required_quota,
                "message": "Target achieved! Payment window opening...",
            },
        )
    
    @staticmethod
    def group_timed_out(
        group_buy_id: str,
        final_quota: int,
        required_quota: int,
    ) -> GroupTimedOutEvent:
        """Build a GROUP_TIMED_OUT event."""
        return GroupTimedOutEvent(
            group_buy_id=group_buy_id,
            data={
                "final_quota": final_quota,
                "required_quota": required_quota,
                "was_successful": final_quota >= required_quota,
                "message": (
                    "Time's up! Group buy has ended."
                    if final_quota < required_quota
                    else "Group buy successful!"
                ),
                "refund_info": {
                    "auto_refund": True,
                    "estimated_refund_time": "1-3 business days",
                },
            },
        )
    
    @staticmethod
    def payment_confirmed(
        group_buy_id: str,
        user_id: str,
        payment_id: str,
        amount: float,
        total_paid: int,
        total_expected: int,
    ) -> PaymentConfirmedEvent:
        """Build a PAYMENT_CONFIRMED event."""
        return PaymentConfirmedEvent(
            group_buy_id=group_buy_id,
            data={
                "user_id": user_id,
                "payment_id": payment_id,
                "amount": amount,
                "confirmed_at": datetime.now(UTC).isoformat(),
                "total_paid": total_paid,
                "total_expected": total_expected,
            },
        )
    
    @staticmethod
    def group_locked(
        group_buy_id: str,
        total_members: int,
        total_amount: float,
        pickup_deadline: str,
    ) -> GroupLockedEvent:
        """Build a GROUP_LOCKED event."""
        return GroupLockedEvent(
            group_buy_id=group_buy_id,
            data={
                "total_members": total_members,
                "total_amount": total_amount,
                "currency": "IDR",
                "pickup_deadline": pickup_deadline,
                "message": "All payments confirmed! Ready for pickup.",
            },
        )
    
    @staticmethod
    def group_completed(
        group_buy_id: str,
        total_members: int,
        total_savings: float,
        carbon_saved_kg: float,
    ) -> GroupCompletedEvent:
        """Build a GROUP_COMPLETED event."""
        return GroupCompletedEvent(
            group_buy_id=group_buy_id,
            data={
                "total_members": total_members,
                "total_savings": total_savings,
                "carbon_saved_kg": carbon_saved_kg,
                "completed_at": datetime.now(UTC).isoformat(),
                "message": "Group buy completed! Thank you for reducing food waste!",
            },
        )
    
    @staticmethod
    def group_expired(
        group_buy_id: str,
        final_quota: int,
        required_quota: int,
        reason: str = "quota_not_met",
    ) -> GroupExpiredEvent:
        """Build a GROUP_EXPIRED event."""
        return GroupExpiredEvent(
            group_buy_id=group_buy_id,
            data={
                "final_quota": final_quota,
                "required_quota": required_quota,
                "reason": reason,
                "refund_info": {
                    "auto_refund": True,
                    "estimated_time": "1-3 business days",
                },
                "message": "Group buy did not reach target. Full refund processing.",
            },
        )


# ============================================================================
# JSON SCHEMA EXPORT
# ============================================================================

def get_all_schemas() -> dict[str, Any]:
    """Export all event schemas as JSON Schema."""
    schemas = {}
    
    for event_class in [
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
    ]:
        schema_name = event_class.__name__
        schemas[schema_name] = event_class.model_json_schema()
    
    return schemas
