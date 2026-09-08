"""
Bungkus! Dynamic Pricing Engine — Background Worker
====================================================
Asynchronous worker that periodically:
1. Recalculates prices for all active products
2. Auto-delists expired products
3. Auto-delists products below food safety threshold
4. Emits events for downstream systems
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Callable, List, Optional, Protocol

from .models import (
    PricingConfig,
    Product,
    ProductStatus,
    PriceCalculationResult,
    WorkerState,
)
from .pricing_engine import calculate_price_for_product


# ============================================================================
# LOGGER
# ============================================================================

logger = logging.getLogger("bungkus.pricing.worker")


# ============================================================================
# PROTOCOLS (Dependency Injection)
# ============================================================================

class ProductRepository(Protocol):
    """Protocol for product data access."""
    
    async def get_active_products(self) -> List[Product]:
        """Fetch all active products that need price updates."""
        ...
    
    async def update_product_price(
        self, 
        product_id: str, 
        new_price: float, 
        new_status: Optional[ProductStatus] = None,
    ) -> bool:
        """Update a product's price and optionally its status."""
        ...
    
    async def delist_product(
        self, 
        product_id: str, 
        reason: str,
    ) -> bool:
        """Delist a product with a reason."""
        ...


class PriceEventPublisher(Protocol):
    """Protocol for publishing price change events."""
    
    async def publish_price_changed(self, result: PriceCalculationResult) -> None:
        """Publish a price change event."""
        ...
    
    async def publish_product_delisted(
        self, 
        product_id: str, 
        reason: str,
    ) -> None:
        """Publish a product delisted event."""
        ...


# ============================================================================
# PRICING WORKER
# ============================================================================

class PricingWorker:
    """Background worker for dynamic price recalculation.
    
    This worker runs periodically and:
    1. Fetches all active products from the repository
    2. Recalculates prices using the pricing engine
    3. Updates prices in the database
    4. Delists expired or unsafe products
    5. Publishes events for real-time updates
    
    The worker is designed to be idempotent — running it multiple times
    with the same data produces the same results.
    
    Usage:
        worker = PricingWorker(
            repository=db,
            publisher=event_bus,
            config=PricingConfig(),
        )
        
        # Run once (for cron)
        await worker.run_once()
        
        # Or run continuously (for background service)
        await worker.run_forever(interval_seconds=60)
    """
    
    def __init__(
        self,
        repository: ProductRepository,
        publisher: PriceEventPublisher,
        config: Optional[PricingConfig] = None,
        interval_seconds: int = 60,
    ):
        """Initialize the pricing worker.
        
        Args:
            repository: Product data access layer
            publisher: Event publisher for price changes
            config: Pricing configuration
            interval_seconds: How often to run (default: 60s)
        """
        self.repository = repository
        self.publisher = publisher
        self.config = config or PricingConfig()
        self.interval_seconds = interval_seconds
        self.state = WorkerState()
        self._stop_event = asyncio.Event()
    
    async def run_once(self) -> WorkerState:
        """Execute one pricing cycle.
        
        This is the core logic that:
        1. Fetches active products
        2. Calculates new prices
        3. Updates database
        4. Delists if needed
        5. Publishes events
        
        Returns:
            WorkerState with metrics from this run
        """
        logger.info("Starting pricing cycle...")
        self.state.is_running = True
        self.state.products_processed = 0
        self.state.products_priced = 0
        self.state.products_delisted = 0
        
        try:
            # 1. Fetch all active products
            products = await self.repository.get_active_products()
            logger.info(f"Fetched {len(products)} active products")
            
            # 2. Process each product
            for product in products:
                try:
                    await self._process_product(product)
                except Exception as e:
                    logger.error(
                        f"Error processing product {product.id}: {e}",
                        exc_info=True,
                    )
                    self.state.errors += 1
                finally:
                    # Always count as processed, even on error
                    self.state.products_processed += 1
            
            self.state.last_run_at = datetime.utcnow()
            logger.info(
                f"Pricing cycle complete: "
                f"{self.state.products_priced} priced, "
                f"{self.state.products_delisted} delisted, "
                f"{self.state.errors} errors"
            )
            
        except Exception as e:
            logger.error(f"Pricing cycle failed: {e}", exc_info=True)
            self.state.errors += 1
        
        finally:
            self.state.is_running = False
        
        return self.state
    
    async def _process_product(self, product: Product) -> None:
        """Process a single product: calculate price and handle delisting."""
        
        # Calculate new price
        result = calculate_price_for_product(product, self.config)
        
        # Determine if status should change
        new_status = None
        if result.should_delist:
            if result.delist_reason == "SOLD_OUT":
                new_status = ProductStatus.SOLD_OUT
            elif result.delist_reason in ("EXPIRED", "FOOD_SAFETY_THRESHOLD"):
                new_status = ProductStatus.EXPIRED
            else:
                new_status = ProductStatus.DELISTED
        
        # Check if price actually changed
        price_changed = abs(result.p_new - product.p_current) > 0.01
        
        if price_changed or new_status:
            # Update price in database
            success = await self.repository.update_product_price(
                product_id=product.id,
                new_price=result.p_new,
                new_status=new_status,
            )
            
            if success:
                self.state.products_priced += 1
                
                # Publish price change event
                await self.publisher.publish_price_changed(result)
                
                logger.debug(
                    f"Product {product.id}: "
                    f"Rp {result.p_old:,.0f} → Rp {result.p_new:,.0f} "
                    f"(-{result.discount_pct:.1f}%)"
                )
        
        # Handle delisting
        if result.should_delist:
            success = await self.repository.delist_product(
                product_id=product.id,
                reason=result.delist_reason or "UNKNOWN",
            )
            
            if success:
                self.state.products_delisted += 1
                
                # Publish delist event
                await self.publisher.publish_product_delisted(
                    product_id=product.id,
                    reason=result.delist_reason or "UNKNOWN",
                )
                
                logger.info(
                    f"Delisted product {product.id}: {result.delist_reason}"
                )
    
    async def run_forever(
        self, 
        interval_seconds: Optional[int] = None,
    ) -> None:
        """Run the worker continuously until stopped.
        
        Args:
            interval_seconds: Override default interval
        """
        interval = interval_seconds or self.interval_seconds
        logger.info(f"Starting continuous pricing worker (interval: {interval}s)")
        
        self._stop_event.clear()
        
        while not self._stop_event.is_set():
            await self.run_once()
            
            # Wait for next cycle or stop signal
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=interval,
                )
                break  # Stop event was set
            except asyncio.TimeoutError:
                continue  # Timeout means we should run again
        
        logger.info("Pricing worker stopped")
    
    def stop(self) -> None:
        """Signal the worker to stop after current cycle."""
        self._stop_event.set()
        logger.info("Stop signal received")


# ============================================================================
# IN-MEMORY REPOSITORY (for testing)
# ============================================================================

class InMemoryProductRepository:
    """In-memory product repository for testing.
    
    This is NOT for production use. It's provided for:
    - Unit testing the worker
    - Integration testing
    - Development/prototyping
    """
    
    def __init__(self):
        self.products: dict[str, Product] = {}
        self.price_history: list[tuple[str, float, datetime]] = []
    
    async def get_active_products(self) -> List[Product]:
        """Return all active products."""
        return [
            p for p in self.products.values()
            if p.status in (ProductStatus.ACTIVE, ProductStatus.LOW_STOCK)
        ]
    
    async def update_product_price(
        self,
        product_id: str,
        new_price: float,
        new_status: Optional[ProductStatus] = None,
    ) -> bool:
        """Update product price and status."""
        if product_id not in self.products:
            return False
        
        product = self.products[product_id]
        old_price = product.p_current
        
        # Create updated product
        updated = product.model_copy(update={
            "p_current": new_price,
            "status": new_status or product.status,
        })
        self.products[product_id] = updated
        
        # Track history
        self.price_history.append((product_id, new_price, datetime.utcnow()))
        
        return True
    
    async def delist_product(
        self,
        product_id: str,
        reason: str,
    ) -> bool:
        """Delist a product."""
        if product_id not in self.products:
            return False
        
        product = self.products[product_id]
        updated = product.model_copy(update={
            "status": ProductStatus.DELISTED,
        })
        self.products[product_id] = updated
        
        return True
    
    def add_product(self, product: Product) -> None:
        """Add a product to the repository."""
        self.products[product.id] = product


# ============================================================================
# IN-MEMORY EVENT PUBLISHER (for testing)
# ============================================================================

class InMemoryEventPublisher:
    """In-memory event publisher for testing."""
    
    def __init__(self):
        self.price_events: List[PriceCalculationResult] = []
        self.delist_events: List[tuple[str, str]] = []
    
    async def publish_price_changed(self, result: PriceCalculationResult) -> None:
        """Record a price change event."""
        self.price_events.append(result)
    
    async def publish_product_delisted(
        self,
        product_id: str,
        reason: str,
    ) -> None:
        """Record a delist event."""
        self.delist_events.append((product_id, reason))
