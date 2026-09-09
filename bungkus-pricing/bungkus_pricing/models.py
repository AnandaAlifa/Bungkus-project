"""
Bungkus! Dynamic Pricing Engine — Pydantic Models
==================================================
Type-safe configuration and data models for the pricing engine.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ProductStatus(str, Enum):
    """Product lifecycle status."""
    ACTIVE = "ACTIVE"
    LOW_STOCK = "LOW_STOCK"
    SOLD_OUT = "SOLD_OUT"
    EXPIRED = "EXPIRED"
    DELISTED = "DELISTED"


class PricingConfig(BaseModel):
    """Configuration for the dynamic pricing algorithm.
    
    All discount/ratio values are in range [0.0, 1.0].
    Currency values are in IDR (Indonesian Rupiah).
    """
    
    d_max: float = Field(
        default=0.70,
        ge=0.0,
        le=1.0,
        description="Maximum discount ratio (0.70 = 70% off)"
    )
    
    time_decay_exponent: float = Field(
        default=1.5,
        gt=0.0,
        description="Exponent for time-decay curve (>1.0 = aggressive late decay)"
    )
    
    stock_pressure_min: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum stock pressure factor (at 0% stock remaining)"
    )
    
    stock_pressure_max: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Maximum stock pressure factor (at 100% stock remaining)"
    )
    
    rounding_nearest: int = Field(
        default=100,
        gt=0,
        description="Round down to nearest N IDR (100 = nearest 100 Rp)"
    )
    
    auto_delist_threshold_hours: float = Field(
        default=0.0,
        ge=0.0,
        description="Auto-delist when expiry is within N hours (0 = exact expiry)"
    )
    
    food_safety_buffer_hours: float = Field(
        default=2.0,
        ge=0.0,
        description="Food safety buffer: delist N hours before expiry"
    )
    
    @field_validator("stock_pressure_max")
    @classmethod
    def max_ge_min(cls, v: float, info) -> float:
        if "stock_pressure_min" in info.data and v < info.data["stock_pressure_min"]:
            raise ValueError("stock_pressure_max must be >= stock_pressure_min")
        return v


class Product(BaseModel):
    """Represents a near-expiry product for pricing calculation."""
    
    id: str = Field(..., description="Product UUID")
    merchant_id: str = Field(..., description="Merchant UUID")
    
    # Pricing
    p_base: float = Field(..., gt=0, description="Original price (Rp)")
    p_min: float = Field(..., gt=0, description="Floor price (Rp)")
    p_current: float = Field(..., gt=0, description="Current dynamic price (Rp)")
    
    # Inventory
    q_init: int = Field(..., gt=0, description="Initial quantity listed")
    q_rem: int = Field(..., ge=0, description="Remaining quantity")
    
    # Timing
    listed_at: datetime = Field(..., description="When the product was listed")
    expiry_timestamp: datetime = Field(..., description="When the product expires")
    
    # Status
    status: ProductStatus = Field(default=ProductStatus.ACTIVE)
    
    @field_validator("p_min")
    @classmethod
    def min_lte_base(cls, v: float, info) -> float:
        if "p_base" in info.data and v > info.data["p_base"]:
            raise ValueError("p_min must be <= p_base")
        return v
    
    @field_validator("q_rem")
    @classmethod
    def rem_lte_init(cls, v: int, info) -> int:
        if "q_init" in info.data and v > info.data["q_init"]:
            raise ValueError("q_rem must be <= q_init")
        return v
    
    @property
    def t_total(self) -> timedelta:
        """Total listing duration."""
        return self.expiry_timestamp - self.listed_at
    
    @property
    def t_rem(self) -> timedelta:
        """Time remaining until expiry."""
        return self.expiry_timestamp - datetime.now(timezone.utc)


class PriceCalculationResult(BaseModel):
    """Result of a price calculation."""
    
    product_id: str
    p_base: float
    p_min: float
    p_old: float
    p_new: float
    discount_pct: float = Field(..., ge=0, le=100)
    t_rem_hours: float
    q_rem: int
    q_init: int
    should_delist: bool
    delist_reason: Optional[str] = None
    
    @property
    def savings(self) -> float:
        """Consumer savings from original price."""
        return self.p_base - self.p_new


class WorkerState(BaseModel):
    """State of the background pricing worker."""
    
    last_run_at: Optional[datetime] = None
    products_processed: int = 0
    products_priced: int = 0
    products_delisted: int = 0
    errors: int = 0
    is_running: bool = False
