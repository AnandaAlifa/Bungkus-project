"""
Bungkus! Dynamic Pricing Engine
================================
Deterministic, side-effect-free pricing algorithm for near-expiry
inventory liquidation in the Indonesian food-waste clearance market.

Usage:
    from bungkus_pricing import calculate_bungkus_dynamic_price
    from datetime import timedelta
    
    price = calculate_bungkus_dynamic_price(
        p_base=20000,      # Rp 20,000
        p_min=5000,        # Rp 5,000 floor
        t_rem=timedelta(hours=2),    # 2 hours left
        t_total=timedelta(hours=24), # Listed 24 hours ago
        q_rem=10,          # 10 items left
        q_init=50,         # Started with 50
    )
    # Returns: Rp 15,200 (24% discount)
"""

from .models import (
    PriceCalculationResult,
    PricingConfig,
    Product,
    ProductStatus,
    WorkerState,
)
from .pricing_engine import (
    _round_down_to_nearest,
    calculate_bungkus_dynamic_price,
    calculate_price_for_product,
)
from .worker import (
    InMemoryEventPublisher,
    InMemoryProductRepository,
    PricingWorker,
)

__version__ = "1.0.0"

__all__ = [
    # Models
    "InMemoryEventPublisher",
    "InMemoryProductRepository",
    "PriceCalculationResult",
    "PricingConfig",
    # Worker
    "PricingWorker",
    "Product",
    "ProductStatus",
    "WorkerState",
    # Core pricing function
    "_round_down_to_nearest",
    "calculate_bungkus_dynamic_price",
    "calculate_price_for_product",
]
