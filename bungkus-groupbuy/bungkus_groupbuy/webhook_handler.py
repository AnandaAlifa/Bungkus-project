"""
Bungkus! Group Buy — Payment Webhook Handler
==============================================
Handles payment gateway webhooks for:
- Midtrans (Indonesian payment gateway)
- Xendit (Alternative payment gateway)

Supports:
- Payment hold (escrow)
- Payment confirmation
- Payment failure
- Refund processing
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any

from pydantic import BaseModel

from .state_machine import (
    GroupBuyStateMachine,
    PaymentStatus,
)

# ============================================================================
# LOGGER
# ============================================================================

logger = logging.getLogger("bungkus.groupbuy.webhook")


# ============================================================================
# PAYMENT PROVIDER ENUMS
# ============================================================================

class PaymentProvider(str, Enum):
    MIDTRANS = "MIDTRANS"
    XENDIT = "XENDIT"


class MidtransStatus(str, Enum):
    """Midtrans transaction status values."""
    CAPTURE = "capture"
    AUTHORIZE = "authorize"
    SETTLEMENT = "settlement"
    PENDING = "pending"
    DENY = "deny"
    CANCEL = "cancel"
    EXPIRE = "expire"
    FAILURE = "failure"
    REFUND = "refund"
    CHARGEBACK = "chargeback"
    REVERSE = "reverse"


class XenditStatus(str, Enum):
    """Xendit payment status values."""
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


# ============================================================================
# WEBHOOK PAYLOAD MODELS
# ============================================================================

class MidtransWebhookPayload(BaseModel):
    """Midtrans notification payload."""
    
    # Transaction info
    transaction_id: str
    order_id: str
    gross_amount: str
    
    # Payment info
    payment_type: str
    transaction_time: str
    transaction_status: str
    status_code: str
    status_message: str
    
    # Fraud
    fraud_status: str | None = None
    
    # Signature (for verification)
    signature_key: str
    
    # Custom fields
    custom_field1: str | None = None  # group_buy_id
    custom_field2: str | None = None  # user_id
    custom_field3: str | None = None  # reserved_qty


class XenditWebhookPayload(BaseModel):
    """Xendit payment notification payload."""
    
    # Payment info
    id: str
    external_id: str
    user_id: str
    
    # Status
    status: str
    
    # Amount
    amount: float
    currency: str = "IDR"
    
    # Payment method
    payment_method: str | None = None
    payment_channel: str | None = None
    
    # Timestamps
    created: str
    updated: str
    
    # Description
    description: str | None = None
    
    # Metadata
    metadata: dict[str, Any] | None = None


class WebhookResponse(BaseModel):
    """Standard webhook response."""
    status: str = "ok"
    message: str = ""
    data: dict[str, Any] | None = None


# ============================================================================
# WEBHOOK HANDLER
# ============================================================================

class PaymentWebhookHandler:
    """Handles payment gateway webhooks for Group Buy escrow system.
    
    This handler processes webhooks from Midtrans and Xendit,
    updating the group buy state machine accordingly.
    
    Flow:
    1. User joins group buy → slot reserved
    2. Quota met → trigger payment hold for all members
    3. Payment gateway holds funds (escrow)
    4. All members confirmed → transition to LOCKED
    5. Items picked up → settle payments
    6. If timeout → auto-refund all held payments
    
    Usage:
        handler = PaymentWebhookHandler(state_machine, config)
        
        # In your FastAPI/Flask route:
        @app.post("/webhook/midtrans")
        async def midtrans_webhook(request: Request):
            payload = await request.json()
            return await handler.handle_midtrans(payload)
    """
    
    def __init__(
        self,
        state_machine: GroupBuyStateMachine,
        config: dict[str, Any],
    ):
        """Initialize the webhook handler.
        
        Args:
            state_machine: Group buy state machine
            config: Configuration with keys:
                - midtrans_server_key: Midtrans server key
                - midtrans_client_key: Midtrans client key
                - xendit_secret_key: Xendit secret key
                - settlement_delay_hours: Hours to wait before settling
        """
        self.state_machine = state_machine
        self.config = config
        
        # Payment provider handlers
    
    # ========================================================================
    # MAIN WEBHOOK ENTRY POINTS
    # ========================================================================
    
    async def handle_midtrans(
        self,
        payload: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> WebhookResponse:
        """Handle Midtrans webhook notification.
        
        Args:
            payload: Raw webhook payload
            headers: HTTP headers (for signature verification)
        
        Returns:
            WebhookResponse
        """
        try:
            # Parse payload
            data = MidtransWebhookPayload(**payload)
            
            # Verify signature
            if not self._verify_midtrans_signature(data):
                logger.warning(f"Invalid Midtrans signature for order {data.order_id}")
                return WebhookResponse(
                    status="error",
                    message="Invalid signature",
                )
            
            # Process based on status
            return await self._process_midtrans_status(data)
            
        except Exception as e:
            logger.exception("Midtrans webhook error")
            return WebhookResponse(
                status="error",
                message=str(e),
            )
    
    async def handle_xendit(
        self,
        payload: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> WebhookResponse:
        """Handle Xendit webhook notification.
        
        Args:
            payload: Raw webhook payload
            headers: HTTP headers (for signature verification)
        
        Returns:
            WebhookResponse
        """
        try:
            # Parse payload
            data = XenditWebhookPayload(**payload)
            
            # Verify signature
            if not self._verify_xendit_signature(payload, headers):
                logger.warning(f"Invalid Xendit signature for {data.external_id}")
                return WebhookResponse(
                    status="error",
                    message="Invalid signature",
                )
            
            # Process based on status
            return await self._process_xendit_status(data)
            
        except Exception as e:
            logger.exception("Xendit webhook error")
            return WebhookResponse(
                status="error",
                message=str(e),
            )
    
    # ========================================================================
    # MIDTRANS PROCESSING
    # ========================================================================
    
    def _verify_midtrans_signature(self, data: MidtransWebhookPayload) -> bool:
        """Verify Midtrans webhook signature.
        
        Signature = SHA512(order_id + status_code + gross_amount + server_key)
        """
        server_key = self.config.get("midtrans_server_key", "")
        
        # Build signature string
        signature_parts = [
            data.order_id,
            data.status_code,
            data.gross_amount,
            server_key,
        ]
        signature_string = "".join(signature_parts)
        
        # Calculate expected signature
        expected_signature = hashlib.sha512(
            signature_string.encode("utf-8")
        ).hexdigest()
        
        return hmac.compare_digest(data.signature_key, expected_signature)
    
    async def _process_midtrans_status(
        self,
        data: MidtransWebhookPayload,
    ) -> WebhookResponse:
        """Process Midtrans transaction status."""
        
        # Extract group buy info from order_id or custom fields
        group_buy_id = data.custom_field1 or self._extract_group_buy_id(data.order_id)
        user_id = data.custom_field2 or self._extract_user_id(data.order_id)
        payment_id = data.transaction_id
        
        if not group_buy_id or not user_id:
            logger.warning(f"Missing group buy/user info in order {data.order_id}")
            return WebhookResponse(
                status="error",
                message="Missing metadata",
            )
        
        # Map Midtrans status to PaymentStatus
        status_map = {
            MidtransStatus.CAPTURE.value: PaymentStatus.PAID,
            MidtransStatus.AUTHORIZE.value: PaymentStatus.HELD,
            MidtransStatus.SETTLEMENT.value: PaymentStatus.PAID,
            MidtransStatus.PENDING.value: PaymentStatus.PENDING,
            MidtransStatus.DENY.value: PaymentStatus.FAILED,
            MidtransStatus.CANCEL.value: PaymentStatus.FAILED,
            MidtransStatus.EXPIRE.value: PaymentStatus.FAILED,
            MidtransStatus.FAILURE.value: PaymentStatus.FAILED,
            MidtransStatus.REFUND.value: PaymentStatus.REFUNDED,
        }
        
        payment_status = status_map.get(data.transaction_status)
        if not payment_status:
            logger.warning(f"Unknown Midtrans status: {data.transaction_status}")
            return WebhookResponse(
                status="ok",
                message=f"Unhandled status: {data.transaction_status}",
            )
        
        # Record payment in state machine
        result = await self.state_machine.record_payment(
            group_id=group_buy_id,
            user_id=user_id,
            payment_id=payment_id,
            status=payment_status,
        )
        
        logger.info(
            f"Midtrans payment recorded: {data.order_id} -> {payment_status.value}"
        )
        
        return WebhookResponse(
            status="ok",
            message=f"Payment {payment_status.value}",
            data={
                "group_buy_id": group_buy_id,
                "user_id": user_id,
                "payment_status": payment_status.value,
                "state_transition": result.new_state.value if result.success else None,
            },
        )
    
    # ========================================================================
    # XENDIT PROCESSING
    # ========================================================================
    
    def _verify_xendit_signature(
        self,
        payload: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> bool:
        """Verify Xendit webhook signature.
        
        Xendit uses HMAC-SHA256 with the secret key.
        In production, rejects requests without valid signature.
        In development, allows requests without signature for testing.
        """
        is_production = os.getenv("ENVIRONMENT", "development") == "production"
        
        if not headers:
            if is_production:
                logger.warning("No headers provided in production - rejecting")
                return False
            return True  # Skip verification in dev mode
        
        xendit_signature = headers.get("x-callback-token") or headers.get("X-Callback-Token")
        if not xendit_signature:
            # Try alternative header
            xendit_signature = headers.get("x-signature")
        
        if not xendit_signature:
            logger.warning("No Xendit signature header found")
            return is_production  # Reject in production, allow in dev
        
        secret_key = self.config.get("xendit_secret_key", "")
        
        # Xendit signs the raw body
        body = json.dumps(payload, separators=(",", ":"))
        expected_signature = hmac.new(
            secret_key.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        
        return hmac.compare_digest(xendit_signature, expected_signature)
    
    async def _process_xendit_status(
        self,
        data: XenditWebhookPayload,
    ) -> WebhookResponse:
        """Process Xendit payment status."""
        
        # Extract group buy info
        group_buy_id = data.metadata.get("group_buy_id") if data.metadata else None
        user_id = data.metadata.get("user_id") if data.metadata else None
        payment_id = data.id
        
        if not group_buy_id or not user_id:
            # Try to extract from external_id
            group_buy_id = self._extract_group_buy_id(data.external_id)
            user_id = self._extract_user_id(data.external_id)
        
        if not group_buy_id or not user_id:
            logger.warning(f"Missing metadata in Xendit payment {data.external_id}")
            return WebhookResponse(
                status="error",
                message="Missing metadata",
            )
        
        # Map Xendit status to PaymentStatus
        status_map = {
            XenditStatus.PENDING.value: PaymentStatus.PENDING,
            XenditStatus.SUCCEEDED.value: PaymentStatus.PAID,
            XenditStatus.FAILED.value: PaymentStatus.FAILED,
            XenditStatus.EXPIRED.value: PaymentStatus.FAILED,
        }
        
        payment_status = status_map.get(data.status)
        if not payment_status:
            logger.warning(f"Unknown Xendit status: {data.status}")
            return WebhookResponse(
                status="ok",
                message=f"Unhandled status: {data.status}",
            )
        
        # Record payment
        result = await self.state_machine.record_payment(
            group_id=group_buy_id,
            user_id=user_id,
            payment_id=payment_id,
            status=payment_status,
        )
        
        logger.info(
            f"Xendit payment recorded: {data.external_id} -> {payment_status.value}"
        )
        
        return WebhookResponse(
            status="ok",
            message=f"Payment {payment_status.value}",
            data={
                "group_buy_id": group_buy_id,
                "user_id": user_id,
                "payment_status": payment_status.value,
                "state_transition": result.new_state.value if result.success else None,
            },
        )
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    def _extract_group_buy_id(self, order_id: str) -> str | None:
        """Extract group buy ID from order ID.
        
        Order ID format: GB-{group_buy_id_short}-{timestamp}
        """
        parts = order_id.split("-")
        if len(parts) >= 2 and parts[0] == "GB":
            return parts[1]
        return None
    
    def _extract_user_id(self, order_id: str) -> str | None:
        """Extract user ID from order ID.
        
        Order ID format: GB-{group_buy_id_short}-{user_id_short}-{timestamp}
        """
        parts = order_id.split("-")
        if len(parts) >= 3 and parts[0] == "GB":
            return parts[2]
        return None
    
    # ========================================================================
    # PAYMENT INITIATION
    # ========================================================================
    
    async def initiate_payment_hold(
        self,
        group_id: str,
        user_id: str,
        amount: float,
        payment_method: str = "QRIS",
    ) -> dict[str, Any]:
        """Initiate a payment hold (escrow) for a member.
        
        This creates a pending transaction that will be settled
        when the group buy completes.
        
        Args:
            group_id: Group buy ID
            user_id: User to charge
            amount: Amount to hold
            payment_method: Payment method
        
        Returns:
            Dict with payment gateway response
        """
        # Generate order ID
        order_id = f"GB-{group_id[:8]}-{user_id[:8]}-{int(datetime.now(UTC).timestamp())}"
        
        # In production, call Midtrans/Xendit API here
        # For now, return a mock response
        payment_data = {
            "order_id": order_id,
            "group_buy_id": group_id,
            "user_id": user_id,
            "amount": amount,
            "payment_method": payment_method,
            "status": "PENDING",
            "payment_url": f"https://app.sandbox.midtrans.com/snap/v1/vtweb/{order_id}",
            "expires_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        }
        
        logger.info(f"Payment hold initiated: {order_id} for {amount} IDR")
        
        return payment_data
    
    async def settle_payment(
        self,
        payment_id: str,
        group_id: str,
    ) -> bool:
        """Settle (capture) a held payment.
        
        Called when group buy transitions to COMPLETED.
        
        Args:
            payment_id: Payment gateway reference
            group_id: Group buy ID
        
        Returns:
            True if successful
        """
        # In production, call Midtrans/Xendit capture API here
        logger.info(f"Payment settled: {payment_id} for group {group_id}")
        return True
    
    async def refund_payment(
        self,
        payment_id: str,
        group_id: str,
        reason: str = "Group buy expired",
    ) -> bool:
        """Refund a held payment.
        
        Called when group buy transitions to EXPIRED.
        
        Args:
            payment_id: Payment gateway reference
            group_id: Group buy ID
            reason: Refund reason
        
        Returns:
            True if successful
        """
        # In production, call Midtrans/Xendit refund API here
        logger.info(f"Payment refunded: {payment_id} for group {group_id}: {reason}")
        return True
