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

from .pricing_engine import (
    calculate_bungkus_dynamic_price,
    calculate_price_for_product,
    _round_down_to_nearest,
)
from .models import (
    PricingConfig,
    Product,
    PriceCalculationResult,
    ProductStatus,
    WorkerState,
)
from .worker import (
    PricingWorker,
    InMemoryProductRepository,
    InMemoryEventPublisher,
)

__version__ = "1.0.0"

__all__ = [
    # Core pricing function
    "calculate_bungkus_dynamic_price",
    "calculate_price_for_product",
    "_round_down_to_nearest",
    
    # Models
    "PricingConfig",
    "Product",
    "PriceCalculationResult",
    "ProductStatus",
    "WorkerState",
    
    # Worker
    "PricingWorker",
    "InMemoryProductRepository",
    "InMemoryEventPublisher",
]
