"""
Bungkus! Group Buy State Machine — Core Engine
================================================
Event-driven state machine for "Bungkus Bareng" flash sales.
Handles high concurrency with Redis distributed locking.

State Transitions:
    CREATED -> WAITING_MEMBERS -> LOCKED -> COMPLETED
                                  ↓
                               EXPIRED -> AUTO_REFUND
                                  ↓
                               CANCELLED
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Protocol

import redis.asyncio as aioredis
from pydantic import BaseModel, Field


# ============================================================================
# LOGGER
# ============================================================================

logger = logging.getLogger("bungkus.groupbuy.state_machine")


# ============================================================================
# ENUMS
# ============================================================================

class GroupBuyState(str, Enum):
    """Group buy lifecycle states."""
    CREATED = "CREATED"
    WAITING_MEMBERS = "WAITING_MEMBERS"
    LOCKED = "LOCKED"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    AUTO_REFUND = "AUTO_REFUND"


class PaymentStatus(str, Enum):
    """Payment status per member."""
    PENDING = "PENDING"
    HELD = "HELD"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class EventType(str, Enum):
    """WebSocket/Event bus event types."""
    GROUP_CREATED = "GROUP_CREATED"
    GROUP_UPDATED = "GROUP_UPDATED"
    MEMBER_JOINED = "MEMBER_JOINED"
    MEMBER_LEFT = "MEMBER_LEFT"
    GROUP_TIMED_OUT = "GROUP_TIMED_OUT"
    QUOTA_MET = "QUOTA_MET"
    PAYMENT_HELD = "PAYMENT_HELD"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    GROUP_LOCKED = "GROUP_LOCKED"
    GROUP_COMPLETED = "GROUP_COMPLETED"
    GROUP_EXPIRED = "GROUP_EXPIRED"
    AUTO_REFUND_TRIGGERED = "AUTO_REFUND_TRIGGERED"


# ============================================================================
# VALID STATE TRANSITIONS
# ============================================================================

VALID_TRANSITIONS: Dict[GroupBuyState, List[GroupBuyState]] = {
    GroupBuyState.CREATED: [
        GroupBuyState.WAITING_MEMBERS,
        GroupBuyState.EXPIRED,
        GroupBuyState.CANCELLED,
    ],
    GroupBuyState.WAITING_MEMBERS: [
        GroupBuyState.LOCKED,
        GroupBuyState.EXPIRED,
        GroupBuyState.CANCELLED,
    ],
    GroupBuyState.LOCKED: [
        GroupBuyState.COMPLETED,
        GroupBuyState.EXPIRED,
        GroupBuyState.CANCELLED,
    ],
    GroupBuyState.COMPLETED: [],  # Terminal state
    GroupBuyState.EXPIRED: [
        GroupBuyState.AUTO_REFUND,
    ],
    GroupBuyState.CANCELLED: [],  # Terminal state
    GroupBuyState.AUTO_REFUND: [],  # Terminal state
}


# ============================================================================
# MODELS
# ============================================================================

class GroupBuyMeta(BaseModel):
    """Group buy metadata."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    merchant_id: str
    leader_id: str
    
    required_quota: int = Field(..., gt=0)
    max_quota: int = Field(..., gt=0)
    current_quota: int = Field(default=0, ge=0)
    
    original_price: float = Field(..., gt=0)
    group_price: float = Field(..., gt=0)
    discount_pct: float = Field(..., ge=0, le=100)
    
    state: GroupBuyState = Field(default=GroupBuyState.CREATED)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    locked_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    quota_met_at: Optional[datetime] = None
    
    product_name: str = ""
    product_image: str = ""
    merchant_name: str = ""
    
    location_lng: float = 0.0
    location_lat: float = 0.0


class MemberRecord(BaseModel):
    """Individual member record."""
    user_id: str
    group_buy_id: str
    reserved_qty: int = 1
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payment_id: Optional[str] = None
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None


class StateTransitionResult(BaseModel):
    """Result of a state transition attempt."""
    success: bool
    old_state: Optional[GroupBuyState] = None
    new_state: GroupBuyState
    error_message: Optional[str] = None
    event: Optional[EventType] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EventPayload(BaseModel):
    """Event payload for WebSocket/Event bus."""
    event_type: EventType
    group_buy_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = Field(default_factory=dict)
    actor_id: Optional[str] = None


# ============================================================================
# LUA SCRIPT LOADER
# ============================================================================

LUA_DIR = Path(__file__).parent / "lua_scripts"

def load_lua_script(name: str) -> str:
    """Load a Lua script from the lua_scripts directory."""
    script_path = LUA_DIR / f"{name}.lua"
    if not script_path.exists():
        raise FileNotFoundError(f"Lua script not found: {script_path}")
    return script_path.read_text()


# ============================================================================
# STATE MACHINE
# ============================================================================

class GroupBuyStateMachine:
    """Event-driven state machine for Group Buy ("Bungkus Bareng").
    
    This implementation uses Redis for distributed state management
    and Lua scripts for atomic operations.
    
    Usage:
        sm = GroupBuyStateMachine(redis_client)
        
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
        if result.success and result.event == EventType.QUOTA_MET:
            # Trigger payment hold for all members
            await payment_service.hold_all_members(meta.id)
    """
    
    def __init__(
        self,
        redis: aioredis.Redis,
        event_handler: Optional[Callable[[EventPayload], Any]] = None,
    ):
        """Initialize the state machine.
        
        Args:
            redis: Async Redis client
            event_handler: Optional callback for publishing events
        """
        self.redis = redis
        self.event_handler = event_handler
        
        # Load Lua scripts
        self._reserve_slot_script = None
        self._release_slot_script = None
        self._transition_state_script = None
    
    async def _ensure_scripts_loaded(self) -> None:
        """Load Lua scripts into Redis if not already loaded."""
        if self._reserve_slot_script is None:
            script = load_lua_script("reserve_slot")
            self._reserve_slot_script = self.redis.register_script(script)
        
        if self._release_slot_script is None:
            script = load_lua_script("release_slot")
            self._release_slot_script = self.redis.register_script(script)
        
        if self._transition_state_script is None:
            script = load_lua_script("transition_state")
            self._transition_state_script = self.redis.register_script(script)
    
    def _key(self, group_id: str, suffix: str = "meta") -> str:
        """Generate Redis key for group buy."""
        return f"bungkus:group_buy:{group_id}:{suffix}"
    
    async def _emit_event(self, event: EventPayload) -> None:
        """Publish event to WebSocket/Event bus."""
        logger.info(f"Event: {event.event_type.value} for group {event.group_buy_id}")
        
        # Store event in Redis for late subscribers
        event_key = f"bungkus:group_buy:{event.group_buy_id}:events"
        await self.redis.lpush(event_key, event.model_dump_json())
        await self.redis.ltrim(event_key, 0, 99)  # Keep last 100 events
        await self.redis.expire(event_key, 86400)  # 24h TTL
        
        # Publish to channel for real-time subscribers
        channel = f"bungkus:group_buy:{event.group_buy_id}:stream"
        await self.redis.publish(channel, event.model_dump_json())
        
        # Call custom handler if provided
        if self.event_handler:
            try:
                await self.event_handler(event)
            except Exception as e:
                logger.error(f"Event handler error: {e}")
    
    # ========================================================================
    # CREATE GROUP BUY
    # ========================================================================
    
    async def create_group_buy(
        self,
        product_id: str,
        merchant_id: str,
        leader_id: str,
        required_quota: int,
        expires_in_hours: float,
        original_price: float,
        group_price: float,
        product_name: str = "",
        product_image: str = "",
        merchant_name: str = "",
        location_lng: float = 0.0,
        location_lat: float = 0.0,
    ) -> GroupBuyMeta:
        """Create a new group buy session.
        
        Args:
            product_id: Product being sold
            merchant_id: Merchant selling the product
            leader_id: User who created the group buy
            required_quota: Minimum members needed
            expires_in_hours: Time window for reaching quota
            original_price: Original product price
            group_price: Discounted group price
            product_name: Product display name
            product_image: Product image URL
            merchant_name: Merchant display name
            location_lng: Merchant longitude
            location_lat: Merchant latitude
        
        Returns:
            GroupBuyMeta with the created group buy details
        """
        await self._ensure_scripts_loaded()
        
        now = datetime.now(timezone.utc)
        discount_pct = ((original_price - group_price) / original_price) * 100
        
        meta = GroupBuyMeta(
            product_id=product_id,
            merchant_id=merchant_id,
            leader_id=leader_id,
            required_quota=required_quota,
            max_quota=required_quota * 2,  # Cap at 2x required
            original_price=original_price,
            group_price=group_price,
            discount_pct=round(discount_pct, 2),
            state=GroupBuyState.CREATED,
            created_at=now,
            expires_at=now.replace(
                hour=now.hour + int(expires_in_hours),
                minute=now.minute + int((expires_in_hours % 1) * 60)
            ),
            product_name=product_name,
            product_image=product_image,
            merchant_name=merchant_name,
            location_lng=location_lng,
            location_lat=location_lat,
        )
        
        # Store in Redis
        meta_key = self._key(meta.id, "meta")
        await self.redis.hset(meta_key, mapping={
            "id": meta.id,
            "product_id": meta.product_id,
            "merchant_id": meta.merchant_id,
            "leader_id": meta.leader_id,
            "required_quota": str(meta.required_quota),
            "max_quota": str(meta.max_quota),
            "current_quota": "0",
            "original_price": str(meta.original_price),
            "group_price": str(meta.group_price),
            "discount_pct": str(meta.discount_pct),
            "state": meta.state.value,
            "created_at": str(int(meta.created_at.timestamp())),
            "expires_at": str(int(meta.expires_at.timestamp())),
            "product_name": meta.product_name,
            "product_image": meta.product_image,
            "merchant_name": meta.merchant_name,
            "location_lng": str(meta.location_lng),
            "location_lat": str(meta.location_lat),
        })
        
        # Initialize slot counter
        await self.redis.set(self._key(meta.id, "slots"), "0")
        
        # Set TTL (expiry time + 24h buffer)
        ttl = int((meta.expires_at - now).total_seconds()) + 86400
        await self.redis.expire(meta_key, ttl)
        
        # Emit event
        await self._emit_event(EventPayload(
            event_type=EventType.GROUP_CREATED,
            group_buy_id=meta.id,
            data=meta.model_dump(mode="json"),
            actor_id=leader_id,
        ))
        
        logger.info(f"Created group buy {meta.id} for product {product_id}")
        return meta
    
    # ========================================================================
    # JOIN GROUP BUY
    # ========================================================================
    
    async def join_group(
        self,
        group_id: str,
        user_id: str,
        reserved_qty: int = 1,
    ) -> StateTransitionResult:
        """Join a group buy session.
        
        Uses Redis Lua script for atomic slot reservation.
        Prevents race conditions and overselling.
        
        Args:
            group_id: Group buy ID
            user_id: User joining
            reserved_qty: Quantity to reserve
        
        Returns:
            StateTransitionResult with success status and events
        """
        await self._ensure_scripts_loaded()
        
        now_ts = int(time.time())
        
        # Execute atomic Lua script
        result = await self._reserve_slot_script(
            keys=[
                self._key(group_id, "meta"),
                self._key(group_id, "members"),
                self._key(group_id, "slots"),
            ],
            args=[user_id, str(now_ts), str(reserved_qty)],
        )
        
        # Decode bytes from Redis
        decoded = [v.decode() if isinstance(v, bytes) else v for v in result]
        success, new_state, current_quota, required_quota, error_msg = decoded
        
        if not success:
            logger.warning(f"Join failed for {user_id}: {error_msg}")
            return StateTransitionResult(
                success=False,
                new_state=GroupBuyState(new_state) if new_state in GroupBuyState.__members__ else GroupBuyState.CREATED,
                error_message=error_msg if error_msg else None,
            )
        
        # Update meta in Redis with new quota
        await self.redis.hset(
            self._key(group_id, "meta"),
            "current_quota",
            str(current_quota),
        )

        # Store member record
        member = MemberRecord(
            user_id=user_id,
            group_buy_id=group_id,
            reserved_qty=reserved_qty,
            payment_status=PaymentStatus.PENDING,
        )
        
        member_key = self._key(group_id, "members") + f":{user_id}"
        await self.redis.hset(member_key, mapping={
            "user_id": member.user_id,
            "reserved_qty": str(member.reserved_qty),
            "payment_status": member.payment_status.value,
            "joined_at": str(int(member.joined_at.timestamp())),
        })
        
        # Determine event type
        event_type = EventType.MEMBER_JOINED
        state_enum = GroupBuyState(new_state)
        
        if state_enum == GroupBuyState.WAITING_MEMBERS and current_quota >= required_quota:
            event_type = EventType.QUOTA_MET
            logger.info(f"Quota met for group {group_id}: {current_quota}/{required_quota}")
        
        # Emit event
        await self._emit_event(EventPayload(
            event_type=event_type,
            group_buy_id=group_id,
            data={
                "user_id": user_id,
                "reserved_qty": reserved_qty,
                "current_quota": current_quota,
                "required_quota": required_quota,
                "new_state": new_state,
            },
            actor_id=user_id,
        ))
        
        return StateTransitionResult(
            success=True,
            old_state=GroupBuyState.CREATED,
            new_state=state_enum,
            event=event_type,
            metadata={
                "current_quota": current_quota,
                "required_quota": required_quota,
            },
        )
    
    # ========================================================================
    # LEAVE GROUP BUY
    # ========================================================================
    
    async def leave_group(
        self,
        group_id: str,
        user_id: str,
    ) -> StateTransitionResult:
        """Leave a group buy session.
        
        Releases the reserved slot atomically.
        
        Args:
            group_id: Group buy ID
            user_id: User leaving
        
        Returns:
            StateTransitionResult
        """
        await self._ensure_scripts_loaded()
        
        # Get member's reserved quantity
        member_key = self._key(group_id, "members") + f":{user_id}"
        reserved_qty = await self.redis.hget(member_key, "reserved_qty")
        reserved_qty = int(reserved_qty) if reserved_qty else 1
        
        # Execute atomic release
        result = await self._release_slot_script(
            keys=[
                self._key(group_id, "meta"),
                self._key(group_id, "members"),
                self._key(group_id, "slots"),
            ],
            args=[user_id, str(reserved_qty)],
        )
        
        # Decode bytes from Redis
        decoded = [v.decode() if isinstance(v, bytes) else v for v in result]
        success, new_state, current_quota, required_quota, error_msg = decoded
        
        if not success:
            return StateTransitionResult(
                success=False,
                new_state=GroupBuyState(new_state) if new_state in GroupBuyState.__members__ else GroupBuyState.CREATED,
                error_message=error_msg if error_msg else None,
            )
        
        # Update meta in Redis with new quota
        await self.redis.hset(
            self._key(group_id, "meta"),
            "current_quota",
            str(current_quota),
        )

        # Remove member record
        await self.redis.delete(member_key)
        
        # Emit event
        await self._emit_event(EventPayload(
            event_type=EventType.MEMBER_LEFT,
            group_buy_id=group_id,
            data={
                "user_id": user_id,
                "reserved_qty": reserved_qty,
                "current_quota": current_quota,
                "required_quota": required_quota,
            },
            actor_id=user_id,
        ))
        
        return StateTransitionResult(
            success=True,
            old_state=GroupBuyState.WAITING_MEMBERS,
            new_state=GroupBuyState(new_state),
            event=EventType.MEMBER_LEFT,
        )
    
    # ========================================================================
    # TRANSITION STATE
    # ========================================================================
    
    async def transition(
        self,
        group_id: str,
        target_state: GroupBuyState,
        actor_id: str,
        reason: str = "",
    ) -> StateTransitionResult:
        """Transition group buy to a new state.
        
        Validates the transition is allowed and executes atomically.
        
        Args:
            group_id: Group buy ID
            target_state: Desired new state
            actor_id: Who initiated the transition
            reason: Reason for transition
        
        Returns:
            StateTransitionResult
        """
        await self._ensure_scripts_loaded()
        
        now_ts = int(time.time())
        
        # Execute atomic transition
        result = await self._transition_state_script(
            keys=[
                self._key(group_id, "meta"),
                self._key(group_id, "members"),
                self._key(group_id, "slots"),
                self._key(group_id, "payments"),
            ],
            args=[
                target_state.value,
                str(now_ts),
                actor_id,
                reason,
            ],
        )
        
        # Decode bytes from Redis
        decoded = [v.decode() if isinstance(v, bytes) else v for v in result]
        success, old_state, new_state, error_msg = decoded
        
        if not success:
            return StateTransitionResult(
                success=False,
                old_state=GroupBuyState(old_state) if old_state in GroupBuyState.__members__ else None,
                new_state=target_state,
                error_message=error_msg if error_msg else None,
            )
        
        # Determine event type based on transition
        event_type_map = {
            (GroupBuyState.WAITING_MEMBERS, GroupBuyState.LOCKED): EventType.GROUP_LOCKED,
            (GroupBuyState.LOCKED, GroupBuyState.COMPLETED): EventType.GROUP_COMPLETED,
            (GroupBuyState.EXPIRED, GroupBuyState.AUTO_REFUND): EventType.AUTO_REFUND_TRIGGERED,
        }
        
        old_state_enum = GroupBuyState(old_state)
        event_type = event_type_map.get(
            (old_state_enum, target_state),
            EventType.GROUP_UPDATED,
        )
        
        # Emit event
        await self._emit_event(EventPayload(
            event_type=event_type,
            group_buy_id=group_id,
            data={
                "old_state": old_state,
                "new_state": target_state.value,
                "reason": reason,
            },
            actor_id=actor_id,
        ))
        
        return StateTransitionResult(
            success=True,
            old_state=old_state_enum,
            new_state=target_state,
            event=event_type,
        )
    
    # ========================================================================
    # PAYMENT OPERATIONS
    # ========================================================================
    
    async def record_payment(
        self,
        group_id: str,
        user_id: str,
        payment_id: str,
        status: PaymentStatus,
    ) -> StateTransitionResult:
        """Record payment status for a member.
        
        Args:
            group_id: Group buy ID
            user_id: User who paid
            payment_id: Payment gateway reference
            status: Payment status
        
        Returns:
            StateTransitionResult
        """
        # Update payment status
        payment_key = self._key(group_id, "payments")
        await self.redis.hset(payment_key, user_id, status.value)
        
        # Update member record
        member_key = self._key(group_id, "members") + f":{user_id}"
        await self.redis.hset(member_key, mapping={
            "payment_id": payment_id,
            "payment_status": status.value,
        })
        
        if status == PaymentStatus.PAID:
            await self.redis.hset(member_key, "paid_at", str(int(time.time())))
        
        # Determine event type
        event_type_map = {
            PaymentStatus.HELD: EventType.PAYMENT_HELD,
            PaymentStatus.PAID: EventType.PAYMENT_CONFIRMED,
            PaymentStatus.FAILED: EventType.PAYMENT_FAILED,
        }
        
        event_type = event_type_map.get(status, EventType.GROUP_UPDATED)
        
        # Emit event
        await self._emit_event(EventPayload(
            event_type=event_type,
            group_buy_id=group_id,
            data={
                "user_id": user_id,
                "payment_id": payment_id,
                "status": status.value,
            },
            actor_id=user_id,
        ))
        
        # Check if all members have paid
        if status in (PaymentStatus.PAID, PaymentStatus.HELD):
            all_paid = await self._check_all_members_paid(group_id)
            if all_paid:
                # Transition to LOCKED
                return await self.transition(
                    group_id,
                    GroupBuyState.LOCKED,
                    actor_id="system",
                    reason="All members have paid",
                )
        
        return StateTransitionResult(
            success=True,
            new_state=GroupBuyState.WAITING_MEMBERS,
            event=event_type,
        )
    
    async def _check_all_members_paid(self, group_id: str) -> bool:
        """Check if all members have paid or have held payments."""
        payment_key = self._key(group_id, "payments")
        payments_raw = await self.redis.hgetall(payment_key)
        # Decode bytes keys to strings
        payments = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in payments_raw.items()}
        member_key = self._key(group_id, "members")
        members = await self.redis.smembers(member_key)
        
        if not members:
            return False
        
        for member_id in members:
            member_id_str = member_id.decode() if isinstance(member_id, bytes) else member_id
            status = payments.get(member_id_str)
            if isinstance(status, bytes):
                status = status.decode()
            
            if status not in (PaymentStatus.PAID.value, PaymentStatus.HELD.value):
                return False
        
        return True
    
    # ========================================================================
    # TIMER MANAGEMENT
    # ========================================================================
    
    async def start_expiry_timer(self, group_id: str) -> None:
        """Start the expiry timer for a group buy.
        
        When the timer expires, transition to EXPIRED state.
        """
        meta = await self.get_meta(group_id)
        if not meta:
            return
        
        ttl = int((meta.expires_at - datetime.now(timezone.utc)).total_seconds())
        if ttl <= 0:
            # Already expired
            await self.transition(
                group_id,
                GroupBuyState.EXPIRED,
                actor_id="system",
                reason="Timer expired",
            )
            return
        
        # Schedule expiry check (in production, use Redis keyspace notifications
        # or a dedicated scheduler like Celery/APScheduler)
        logger.info(f"Expiry timer set for group {group_id}: {ttl}s")
    
    async def get_meta(self, group_id: str) -> Optional[GroupBuyMeta]:
        """Get group buy metadata from Redis."""
        meta_key = self._key(group_id, "meta")
        data = await self.redis.hgetall(meta_key)
        
        if not data:
            return None
        
        # Decode bytes to strings
        decoded = {}
        for k, v in data.items():
            key = k.decode() if isinstance(k, bytes) else k
            val = v.decode() if isinstance(v, bytes) else v
            decoded[key] = val
        
        try:
            return GroupBuyMeta(
                id=decoded.get("id", group_id),
                product_id=decoded.get("product_id", ""),
                merchant_id=decoded.get("merchant_id", ""),
                leader_id=decoded.get("leader_id", ""),
                required_quota=int(decoded.get("required_quota", 0)),
                max_quota=int(decoded.get("max_quota", 0)),
                current_quota=int(decoded.get("current_quota", 0)),
                original_price=float(decoded.get("original_price", 0)),
                group_price=float(decoded.get("group_price", 0)),
                discount_pct=float(decoded.get("discount_pct", 0)),
                state=GroupBuyState(decoded.get("state", "CREATED")),
                created_at=datetime.fromtimestamp(
                    int(decoded.get("created_at", 0)), tz=timezone.utc
                ),
                expires_at=datetime.fromtimestamp(
                    int(decoded.get("expires_at", 0)), tz=timezone.utc
                ),
                product_name=decoded.get("product_name", ""),
                product_image=decoded.get("product_image", ""),
                merchant_name=decoded.get("merchant_name", ""),
                location_lng=float(decoded.get("location_lng", 0)),
                location_lat=float(decoded.get("location_lat", 0)),
            )
        except Exception as e:
            logger.error(f"Error parsing meta: {e}")
            return None
    
    async def get_members(self, group_id: str) -> List[MemberRecord]:
        """Get all members of a group buy."""
        member_key = self._key(group_id, "members")
        members = await self.redis.smembers(member_key)
        
        records = []
        for member_id in members:
            member_id_str = member_id.decode() if isinstance(member_id, bytes) else member_id
            detail_key = self._key(group_id, "members") + f":{member_id_str}"
            detail = await self.redis.hgetall(detail_key)
            
            if detail:
                decoded = {}
                for k, v in detail.items():
                    key = k.decode() if isinstance(k, bytes) else k
                    val = v.decode() if isinstance(v, bytes) else v
                    decoded[key] = val
                
                records.append(MemberRecord(
                    user_id=decoded.get("user_id", member_id_str),
                    group_buy_id=group_id,
                    reserved_qty=int(decoded.get("reserved_qty", 1)),
                    payment_status=PaymentStatus(decoded.get("payment_status", "PENDING")),
                    payment_id=decoded.get("payment_id"),
                    joined_at=datetime.fromtimestamp(
                        int(decoded.get("joined_at", 0)), tz=timezone.utc
                    ) if decoded.get("joined_at") else datetime.now(timezone.utc),
                ))
        
        return records
