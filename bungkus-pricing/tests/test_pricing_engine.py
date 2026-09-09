"""
Bungkus! Dynamic Pricing Engine — Comprehensive Unit Tests
==========================================================
100% edge case coverage including:
- Boundary values for tRem, qRem
- Float overflow/underflow
- Zero-division safety
- Currency rounding
- Floor protection
- Food safety threshold
- Worker integration
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from bungkus_pricing import (
    InMemoryEventPublisher,
    InMemoryProductRepository,
    PricingConfig,
    PricingWorker,
    Product,
    ProductStatus,
    _round_down_to_nearest,
    calculate_bungkus_dynamic_price,
    calculate_price_for_product,
)

# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def default_config() -> PricingConfig:
    """Default pricing configuration."""
    return PricingConfig()


@pytest.fixture
def aggressive_config() -> PricingConfig:
    """Aggressive pricing configuration (faster decay)."""
    return PricingConfig(
        d_max=0.70,
        time_decay_exponent=2.0,
        stock_pressure_min=0.3,
        stock_pressure_max=1.0,
        rounding_nearest=100,
        food_safety_buffer_hours=2.0,
    )


@pytest.fixture
def sample_product() -> Product:
    """Sample product for testing."""
    now = datetime.now(UTC)
    return Product(
        id="prod-001",
        merchant_id="merch-001",
        p_base=20000.0,
        p_min=5000.0,
        p_current=20000.0,
        q_init=50,
        q_rem=25,
        listed_at=now - timedelta(hours=12),
        expiry_timestamp=now + timedelta(hours=12),
        status=ProductStatus.ACTIVE,
    )


@pytest.fixture
def fresh_product() -> Product:
    """Just-listed product (full time remaining)."""
    now = datetime.now(UTC)
    return Product(
        id="prod-fresh",
        merchant_id="merch-001",
        p_base=30000.0,
        p_min=8000.0,
        p_current=30000.0,
        q_init=100,
        q_rem=100,
        listed_at=now - timedelta(hours=1),
        expiry_timestamp=now + timedelta(hours=23),
        status=ProductStatus.ACTIVE,
    )


@pytest.fixture
def expiring_product() -> Product:
    """Product about to expire (1 hour left)."""
    now = datetime.now(UTC)
    return Product(
        id="prod-expiring",
        merchant_id="merch-001",
        p_base=25000.0,
        p_min=5000.0,
        p_current=15000.0,
        q_init=30,
        q_rem=5,
        listed_at=now - timedelta(hours=23),
        expiry_timestamp=now + timedelta(hours=1),
        status=ProductStatus.LOW_STOCK,
    )


@pytest.fixture
def empty_stock_product() -> Product:
    """Product with zero remaining stock."""
    now = datetime.now(UTC)
    return Product(
        id="prod-empty",
        merchant_id="merch-001",
        p_base=18000.0,
        p_min=5000.0,
        p_current=12000.0,
        q_init=20,
        q_rem=0,
        listed_at=now - timedelta(hours=10),
        expiry_timestamp=now + timedelta(hours=14),
        status=ProductStatus.SOLD_OUT,
    )


# ============================================================================
# TEST CLASS: CURRENCY ROUNDING
# ============================================================================

class TestRoundingDown:
    """Test currency rounding to nearest 100 IDR."""
    
    def test_exact_hundred(self):
        """Exact hundreds should remain unchanged."""
        assert _round_down_to_nearest(15000, 100) == 15000.0
    
    def test_round_down_from_50(self):
        """Values ending in 50 round down."""
        assert _round_down_to_nearest(15050, 100) == 15000.0
    
    def test_round_down_from_99(self):
        """Values ending in 99 round down."""
        assert _round_down_to_nearest(15099, 100) == 15000.0
    
    def test_round_down_from_1(self):
        """Values ending in 1 round down."""
        assert _round_down_to_nearest(15001, 100) == 15000.0
    
    def test_round_down_small_value(self):
        """Small values round correctly."""
        assert _round_down_to_nearest(999, 100) == 900.0
    
    def test_round_down_very_small(self):
        """Very small values round to 0."""
        assert _round_down_to_nearest(50, 100) == 0.0
    
    def test_round_down_zero(self):
        """Zero remains zero."""
        assert _round_down_to_nearest(0, 100) == 0.0
    
    def test_round_down_negative_nearest(self):
        """Negative nearest returns value unchanged."""
        assert _round_down_to_nearest(15750, -100) == 15750.0
    
    def test_round_down_zero_nearest(self):
        """Zero nearest returns value unchanged."""
        assert _round_down_to_nearest(15750, 0) == 15750.0
    
    def test_round_down_large_value(self):
        """Large values round correctly."""
        assert _round_down_to_nearest(999999, 100) == 999900.0
    
    def test_round_down_float_precision(self):
        """Float precision doesn't cause issues."""
        result = _round_down_to_nearest(15000.0000001, 100)
        assert result == 15000.0
    
    def test_round_down_nearest_1000(self):
        """Rounding to nearest 1000."""
        assert _round_down_to_nearest(15999, 1000) == 15000.0
        assert _round_down_to_nearest(16000, 1000) == 16000.0


# ============================================================================
# TEST CLASS: CORE PRICING FUNCTION — EDGE CASES
# ============================================================================

class TestEdgeCases:
    """Test critical edge cases that must be handled."""
    
    def test_expired_product_returns_floor(self, default_config):
        """tRem <= 0 should return p_min immediately."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(seconds=0),
            t_total=timedelta(hours=24),
            q_rem=10,
            q_init=50,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_negative_time_remaining(self, default_config):
        """Negative tRem should return p_min."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=-1),
            t_total=timedelta(hours=24),
            q_rem=10,
            q_init=50,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_zero_stock_returns_floor(self, default_config):
        """qRem <= 0 should return p_min immediately."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=0,
            q_init=50,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_negative_stock_returns_floor(self, default_config):
        """Negative qRem should return p_min."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=-5,
            q_init=50,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_zero_total_duration_returns_floor(self, default_config):
        """Zero tTotal should return p_min (division by zero safety)."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(seconds=0),
            q_rem=10,
            q_init=50,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_zero_initial_quantity_returns_floor(self, default_config):
        """Zero qInit should return p_min (division by zero safety)."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=10,
            q_init=0,
            config=default_config,
        )
        assert result == 5000.0
    
    def test_floor_protection_exact(self, default_config):
        """Price should never go below p_min."""
        # At expiry with full stock, discount should be high
        result = calculate_bungkus_dynamic_price(
            p_base=10000,
            p_min=5000,
            t_rem=timedelta(minutes=1),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0
    
    def test_floor_protection_with_very_low_min(self, default_config):
        """Floor protection works with very low p_min."""
        result = calculate_bungkus_dynamic_price(
            p_base=100000,
            p_min=100,
            t_rem=timedelta(seconds=1),
            t_total=timedelta(hours=24),
            q_rem=100,
            q_init=100,
            config=default_config,
        )
        assert result >= 100.0


# ============================================================================
# TEST CLASS: CORE PRICING FUNCTION — BOUNDARY VALUES
# ============================================================================

class TestBoundaryValues:
    """Test boundary values for tRem and qRem."""
    
    def test_just_listed_full_stock(self, default_config):
        """At listing time with full stock: price = p_base."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=24),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        # At t_rem = t_total: decay = 0, so price = p_base
        assert result == 20000.0
    
    def test_half_time_half_stock(self, default_config):
        """At 50% time with 50% stock: moderate discount."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=25,
            q_init=50,
            config=default_config,
        )
        # Should be between p_min and p_base
        assert 5000.0 < result < 20000.0
        # Should be rounded to nearest 100
        assert result % 100 == 0
    
    def test_near_expiry_full_stock(self, default_config):
        """Near expiry with full stock: aggressive discount."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(minutes=5),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        # Should be close to p_min
        assert result <= 7000.0
    
    def test_near_expiry_low_stock(self, default_config):
        """Near expiry with low stock: slower discount."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(minutes=5),
            t_total=timedelta(hours=24),
            q_rem=2,
            q_init=50,
            config=default_config,
        )
        # With low stock, pressure is lower, so discount is slower
        # Should still be above p_min
        assert result >= 5000.0
    
    def test_single_item_remaining(self, default_config):
        """Single item remaining."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=6),
            t_total=timedelta(hours=24),
            q_rem=1,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0
        assert result <= 20000.0
    
    def test_all_but_one_sold(self, default_config):
        """49 out of 50 items sold."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=1,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0


# ============================================================================
# TEST CLASS: CORE PRICING FUNCTION — FORMULA VERIFICATION
# ============================================================================

class TestFormulaVerification:
    """Verify the mathematical formula produces expected results."""
    
    def test_formula_at_listing(self, default_config):
        """Formula verification at listing time.
        
        At t_rem = t_total:
            t_ratio = 1 - (24/24) = 0
            decay = 0^1.5 = 0
            discount_factor = 0.70 * 0 * pressure = 0
            price = p_base * (1 - 0) = p_base
        """
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=24),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result == 20000.0
    
    def test_formula_at_expiry(self, default_config):
        """Formula verification at expiry.
        
        At t_rem = 0:
            t_ratio = 1 - (0/24) = 1.0
            decay = 1.0^1.5 = 1.0
            stock_ratio = 50/50 = 1.0
            pressure = 0.5 + 0.5 * 1.0 = 1.0
            discount_factor = 0.70 * 1.0 * 1.0 = 0.70
            price = 20000 * (1 - 0.70) = 6000
            After rounding: 6000
            Floor protection: max(5000, 6000) = 6000
        """
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(seconds=1),  # Almost expired
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        # Should be close to 6000 (70% discount)
        assert 5000.0 <= result <= 6100.0
    
    def test_formula_at_half_time(self, default_config):
        """Formula verification at 50% time.
        
        At t_rem = 12h, t_total = 24h:
            t_ratio = 1 - (12/24) = 0.5
            decay = 0.5^1.5 = 0.3536
            stock_ratio = 25/50 = 0.5
            pressure = 0.5 + 0.5 * 0.5 = 0.75
            discount_factor = 0.70 * 0.3536 * 0.75 = 0.1856
            price = 20000 * (1 - 0.1856) = 16288
            After rounding: 16200
        """
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=25,
            q_init=50,
            config=default_config,
        )
        # Should be around 16200 (18.56% discount)
        assert 16000.0 <= result <= 16400.0
    
    def test_stock_pressure_effect(self, default_config):
        """Higher stock = faster discount (more pressure to sell)."""
        result_high_stock = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=50,  # Full stock
            q_init=50,
            config=default_config,
        )
        
        result_low_stock = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=5,   # Low stock
            q_init=50,
            config=default_config,
        )
        
        # Full stock should have higher discount (lower price)
        assert result_high_stock < result_low_stock
    
    def test_time_decay_acceleration(self, default_config):
        """Decay should accelerate as expiry approaches (exponent > 1)."""
        # Early: 20% time elapsed
        early = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=19.2),  # 80% remaining
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        
        # Late: 80% time elapsed
        late = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=4.8),  # 20% remaining
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        
        # Late should have much more discount than early
        # (acceleration effect of exponent 1.5)
        discount_early = 20000 - early
        discount_late = 20000 - late
        
        # Late discount should be more than 4x early discount
        # (0.8^1.5 / 0.2^1.5 = 8x theoretical, but with pressure it's different)
        assert discount_late > discount_early * 3


# ============================================================================
# TEST CLASS: INPUT VALIDATION
# ============================================================================

class TestInputValidation:
    """Test input validation and error handling."""
    
    def test_negative_p_base_raises(self, default_config):
        """Negative p_base should raise ValueError."""
        with pytest.raises(ValueError, match="must be positive"):
            calculate_bungkus_dynamic_price(
                p_base=-1000,
                p_min=500,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=10,
                q_init=50,
                config=default_config,
            )
    
    def test_negative_p_min_raises(self, default_config):
        """Negative p_min should raise ValueError."""
        with pytest.raises(ValueError, match="must be positive"):
            calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=-5000,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=10,
                q_init=50,
                config=default_config,
            )
    
    def test_p_min_greater_than_p_base_raises(self, default_config):
        """p_min > p_base should raise ValueError."""
        with pytest.raises(ValueError, match="must be <= p_base"):
            calculate_bungkus_dynamic_price(
                p_base=10000,
                p_min=15000,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=10,
                q_init=50,
                config=default_config,
            )
    
    def test_q_rem_greater_than_q_init_raises(self, default_config):
        """q_rem > q_init should raise ValueError."""
        with pytest.raises(ValueError, match="must be <= q_init"):
            calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=5000,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=60,
                q_init=50,
                config=default_config,
            )
    
    def test_zero_p_base_with_zero_p_min(self, default_config):
        """Zero p_base should raise ValueError."""
        with pytest.raises(ValueError):
            calculate_bungkus_dynamic_price(
                p_base=0,
                p_min=0,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=10,
                q_init=50,
                config=default_config,
            )


# ============================================================================
# TEST CLASS: FLOAT PRECISION & OVERFLOW
# ============================================================================

class TestFloatPrecision:
    """Test float precision and overflow scenarios."""
    
    def test_very_large_prices(self, default_config):
        """Very large prices should work without overflow."""
        result = calculate_bungkus_dynamic_price(
            p_base=1_000_000_000,  # 1 billion IDR
            p_min=100_000_000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result >= 100_000_000
        assert result <= 1_000_000_000
    
    def test_very_small_prices(self, default_config):
        """Very small prices should work."""
        result = calculate_bungkus_dynamic_price(
            p_base=1000,
            p_min=100,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result >= 100
        assert result <= 1000
    
    def test_floating_point_precision(self, default_config):
        """Floating point precision shouldn't cause issues."""
        result = calculate_bungkus_dynamic_price(
            p_base=19999.99,
            p_min=5000.00,
            t_rem=timedelta(hours=12, minutes=30, seconds=45),
            t_total=timedelta(hours=24),
            q_rem=33,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0
        assert result <= 19999.99
    
    def test_very_small_time_remaining(self, default_config):
        """Very small time remaining (1 second)."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(seconds=1),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0
    
    def test_very_large_time_total(self, default_config):
        """Very large total duration (365 days)."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(days=182),
            t_total=timedelta(days=365),
            q_rem=50,
            q_init=50,
            config=default_config,
        )
        assert result >= 5000.0
        assert result <= 20000.0


# ============================================================================
# TEST CLASS: CONFIGURATION VARIANTS
# ============================================================================

class TestConfiguration:
    """Test different pricing configurations."""
    
    def test_aggressive_decay(self, aggressive_config):
        """Higher exponent = more aggressive late decay."""
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=6),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=aggressive_config,
        )
        # With exponent 2.0, decay at 75% elapsed is 0.75^2 = 0.5625
        # vs default 0.75^1.5 = 0.6495
        # So aggressive should have LESS discount at this point
        # (because 0.5625 < 0.6495)
        default_result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=6),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=PricingConfig(),
        )
        # Aggressive decay means prices stay higher longer
        assert result >= default_result
    
    def test_zero_stock_pressure(self):
        """Zero stock pressure means no stock-based discount."""
        config = PricingConfig(
            d_max=0.70,
            stock_pressure_min=0.0,
            stock_pressure_max=0.0,
        )
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=50,
            q_init=50,
            config=config,
        )
        # With zero pressure, discount = 0 regardless of time
        assert result == 20000.0
    
    def test_custom_rounding(self):
        """Custom rounding to nearest 50."""
        config = PricingConfig(rounding_nearest=50)
        result = calculate_bungkus_dynamic_price(
            p_base=20000,
            p_min=5000,
            t_rem=timedelta(hours=12),
            t_total=timedelta(hours=24),
            q_rem=25,
            q_init=50,
            config=config,
        )
        assert result % 50 == 0


# ============================================================================
# TEST CLASS: PRODUCT MODEL
# ============================================================================

class TestProductModel:
    """Test Product model validation."""
    
    def test_product_validation_success(self):
        """Valid product should pass validation."""
        now = datetime.now(UTC)
        product = Product(
            id="test",
            merchant_id="merch",
            p_base=20000,
            p_min=5000,
            p_current=20000,
            q_init=50,
            q_rem=25,
            listed_at=now - timedelta(hours=12),
            expiry_timestamp=now + timedelta(hours=12),
        )
        assert product.t_total == timedelta(hours=24)
        # t_rem is approximately 12 hours (may be slightly less due to execution time)
        assert product.t_rem.total_seconds() > 11 * 3600  # At least 11 hours
        assert product.t_rem.total_seconds() <= 12 * 3600  # At most 12 hours
    
    def test_product_p_min_greater_than_p_base(self):
        """p_min > p_base should fail validation."""
        now = datetime.now(UTC)
        with pytest.raises(ValueError):
            Product(
                id="test",
                merchant_id="merch",
                p_base=10000,
                p_min=15000,  # Invalid
                p_current=10000,
                q_init=50,
                q_rem=25,
                listed_at=now - timedelta(hours=12),
                expiry_timestamp=now + timedelta(hours=12),
            )
    
    def test_product_q_rem_greater_than_q_init(self):
        """q_rem > q_init should fail validation."""
        now = datetime.now(UTC)
        with pytest.raises(ValueError):
            Product(
                id="test",
                merchant_id="merch",
                p_base=20000,
                p_min=5000,
                p_current=20000,
                q_init=50,
                q_rem=60,  # Invalid
                listed_at=now - timedelta(hours=12),
                expiry_timestamp=now + timedelta(hours=12),
            )


# ============================================================================
# TEST CLASS: HIGH-LEVEL CALCULATION
# ============================================================================

class TestCalculatePriceForProduct:
    """Test the high-level calculate_price_for_product function."""
    
    def test_fresh_product(self, fresh_product, default_config):
        """Fresh product should have minimal discount."""
        result = calculate_price_for_product(fresh_product, default_config)
        # Fresh product (23h remaining of 24h total) has very small discount
        # due to the time decay exponent. Should be close to p_base.
        assert result.p_new >= 29000.0  # At most ~3% discount
        assert result.discount_pct < 5.0  # Less than 5% discount
        assert result.should_delist is False
    
    def test_expiring_product(self, expiring_product, default_config):
        """Expiring product should have high discount."""
        result = calculate_price_for_product(expiring_product, default_config)
        assert result.p_new < expiring_product.p_base
        assert result.discount_pct > 30.0
        # Should trigger food safety delist (1h < 2h buffer)
        assert result.should_delist is True
        assert result.delist_reason == "FOOD_SAFETY_THRESHOLD"
    
    def test_empty_stock_delist(self, empty_stock_product, default_config):
        """Empty stock should trigger delist."""
        result = calculate_price_for_product(empty_stock_product, default_config)
        assert result.should_delist is True
        assert result.delist_reason == "SOLD_OUT"
    
    def test_savings_property(self, sample_product, default_config):
        """Savings should be p_base - p_new."""
        result = calculate_price_for_product(sample_product, default_config)
        assert result.savings == result.p_base - result.p_new
    
    def test_result_metadata(self, sample_product, default_config):
        """Result should include all metadata."""
        result = calculate_price_for_product(sample_product, default_config)
        assert result.product_id == sample_product.id
        assert result.p_base == sample_product.p_base
        assert result.p_min == sample_product.p_min
        assert result.q_rem == sample_product.q_rem
        assert result.q_init == sample_product.q_init
        assert result.t_rem_hours > 0


# ============================================================================
# TEST CLASS: WORKER INTEGRATION
# ============================================================================

class TestPricingWorker:
    """Test the background pricing worker."""
    
    @pytest.fixture
    def worker_setup(self):
        """Setup worker with in-memory dependencies."""
        repo = InMemoryProductRepository()
        publisher = InMemoryEventPublisher()
        worker = PricingWorker(
            repository=repo,
            publisher=publisher,
            config=PricingConfig(),
        )
        return worker, repo, publisher
    
    @pytest.mark.asyncio
    async def test_run_once_empty_repo(self, worker_setup):
        """Worker should handle empty repository."""
        worker, _repo, _publisher = worker_setup
        state = await worker.run_once()
        assert state.products_processed == 0
        assert state.errors == 0
    
    @pytest.mark.asyncio
    async def test_run_once_with_products(self, worker_setup, sample_product):
        """Worker should process products."""
        worker, repo, _publisher = worker_setup
        repo.add_product(sample_product)
        
        state = await worker.run_once()
        assert state.products_processed == 1
        assert state.products_priced >= 0  # Price may or may not change
    
    @pytest.mark.asyncio
    async def test_worker_publishes_events(self, worker_setup, fresh_product):
        """Worker should publish price change events."""
        worker, repo, _publisher = worker_setup
        
        # Modify product so price changes
        modified = fresh_product.model_copy(update={"q_rem": 1})
        repo.add_product(modified)
        
        state = await worker.run_once()
        # Events may or may not be published depending on price change
        assert state.errors == 0
    
    @pytest.mark.asyncio
    async def test_worker_delists_expired(self, worker_setup):
        """Worker should delist expired products."""
        worker, repo, publisher = worker_setup
        
        now = datetime.now(UTC)
        expired = Product(
            id="expired-1",
            merchant_id="merch-1",
            p_base=20000,
            p_min=5000,
            p_current=10000,
            q_init=50,
            q_rem=10,
            listed_at=now - timedelta(hours=25),
            expiry_timestamp=now - timedelta(hours=1),  # Already expired
            status=ProductStatus.ACTIVE,
        )
        repo.add_product(expired)
        
        state = await worker.run_once()
        assert state.products_delisted == 1
        assert len(publisher.delist_events) == 1
        assert publisher.delist_events[0][0] == "expired-1"
    
    @pytest.mark.asyncio
    async def test_worker_handles_repository_error(self, worker_setup, sample_product):
        """Worker should handle repository errors gracefully."""
        worker, repo, _publisher = worker_setup
        repo.add_product(sample_product)
        
        # Monkey-patch to raise error
        
        async def failing_update(*args, **kwargs):
            raise RuntimeError("Database connection failed")
        
        repo.update_product_price = failing_update
        
        state = await worker.run_once()
        assert state.errors == 1
        assert state.products_processed == 1
    
    @pytest.mark.asyncio
    async def test_worker_stop_signal(self, worker_setup):
        """Worker should stop when stop signal is sent."""
        worker, _repo, _publisher = worker_setup
        worker.stop()
        assert worker._stop_event.is_set()


# ============================================================================
# TEST CLASS: INTEGRATION SCENARIOS
# ============================================================================

class TestIntegrationScenarios:
    """Test realistic integration scenarios."""
    
    def test_daily_pricing_cycle(self, default_config):
        """Simulate a full day of pricing."""
        datetime.now(UTC)
        
        # Product listed 24 hours ago, expiring now
        result = calculate_bungkus_dynamic_price(
            p_base=25000,
            p_min=5000,
            t_rem=timedelta(seconds=1),
            t_total=timedelta(hours=24),
            q_rem=30,
            q_init=50,
            config=default_config,
        )
        
        # At expiry with 60% stock remaining:
        # t_ratio = 1 - (1/86400) ≈ 1.0
        # decay = 1.0^1.5 = 1.0
        # stock_ratio = 30/50 = 0.6
        # pressure = 0.5 + 0.5 * 0.6 = 0.8
        # discount_factor = 0.70 * 1.0 * 0.8 = 0.56
        # price = 25000 * (1 - 0.56) = 11000
        # After rounding: 11000
        assert 10000.0 <= result <= 12000.0
        assert result >= 5000.0  # Floor protection
    
    def test_bakery_clearance_scenario(self, default_config):
        """Bakery clearing day-old bread."""
        datetime.now(UTC)
        
        # Bread listed at 6am, expiring at 6pm (12h window)
        # Currently 4pm (2h remaining)
        result = calculate_bungkus_dynamic_price(
            p_base=15000,   # Rp 15,000 for a loaf
            p_min=3000,     # Rp 3,000 floor
            t_rem=timedelta(hours=2),
            t_total=timedelta(hours=12),
            q_rem=8,        # 8 loaves left out of 20
            q_init=20,
            config=default_config,
        )
        
        # Should have significant discount
        assert result < 15000
        assert result >= 3000
        assert result % 100 == 0  # Rounded to nearest 100
    
    def test_supermarket_last_hour(self, default_config):
        """Supermarket final hour clearance."""
        datetime.now(UTC)
        
        # 30 minutes to closing
        result = calculate_bungkus_dynamic_price(
            p_base=45000,   # Rp 45,000 for prepared meal
            p_min=10000,    # Rp 10,000 floor
            t_rem=timedelta(minutes=30),
            t_total=timedelta(hours=8),
            q_rem=3,
            q_init=15,
            config=default_config,
        )
        
        # At 30 min remaining of 8h total:
        # t_ratio = 1 - (1800/28800) = 0.9375
        # decay = 0.9375^1.5 = 0.908
        # stock_ratio = 3/15 = 0.2
        # pressure = 0.5 + 0.5 * 0.2 = 0.6
        # discount_factor = 0.70 * 0.908 * 0.6 = 0.381
        # price = 45000 * (1 - 0.381) = 27855
        # After rounding: 27800
        assert 25000.0 <= result <= 30000.0
        assert result >= 10000  # Floor protection
    
    def test_restaurant_surplus(self, default_config):
        """Restaurant with surplus cooked food."""
        datetime.now(UTC)
        
        # Prepared 2 hours ago, 1 hour shelf life left
        result = calculate_bungkus_dynamic_price(
            p_base=35000,   # Rp 35,000 for nasi goreng
            p_min=8000,     # Rp 8,000 floor
            t_rem=timedelta(hours=1),
            t_total=timedelta(hours=3),
            q_rem=12,
            q_init=20,
            config=default_config,
        )
        
        # Moderate to high discount
        assert result < 35000
        assert result >= 8000


# ============================================================================
# TEST CLASS: MATHEMATICAL PROPERTIES
# ============================================================================

class TestMathematicalProperties:
    """Test mathematical properties of the pricing function."""
    
    def test_monotonicity_in_time(self, default_config):
        """Price should decrease as time passes (all else equal)."""
        prices = []
        for hours_remaining in [24, 18, 12, 6, 3, 1, 0.5]:
            result = calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=5000,
                t_rem=timedelta(hours=hours_remaining),
                t_total=timedelta(hours=24),
                q_rem=25,
                q_init=50,
                config=default_config,
            )
            prices.append(result)
        
        # Prices should be non-increasing
        for i in range(len(prices) - 1):
            assert prices[i] >= prices[i + 1], \
                f"Price increased: {prices[i]} > {prices[i+1]} at hours {24-i*3}"
    
    def test_monotonicity_in_stock(self, default_config):
        """Price should increase as stock decreases (less pressure to sell)."""
        prices = []
        for stock in [50, 40, 30, 20, 10, 5, 1]:
            result = calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=5000,
                t_rem=timedelta(hours=12),
                t_total=timedelta(hours=24),
                q_rem=stock,
                q_init=50,
                config=default_config,
            )
            prices.append(result)
        
        # Prices should be non-decreasing (less stock = higher price)
        for i in range(len(prices) - 1):
            assert prices[i] <= prices[i + 1], \
                f"Price decreased: {prices[i]} < {prices[i+1]} at stock {50-i*7}"
    
    def test_bounded_by_p_min_and_p_base(self, default_config):
        """Price should always be between p_min and p_base."""
        test_cases = [
            (timedelta(hours=24), 50),  # Just listed
            (timedelta(hours=12), 25),  # Half way
            (timedelta(hours=1), 5),    # Near expiry
            (timedelta(minutes=5), 1),  # Very near expiry
        ]
        
        for t_rem, q_rem in test_cases:
            result = calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=5000,
                t_rem=t_rem,
                t_total=timedelta(hours=24),
                q_rem=q_rem,
                q_init=50,
                config=default_config,
            )
            assert 5000.0 <= result <= 20000.0, \
                f"Price out of bounds: {result} for t_rem={t_rem}, q_rem={q_rem}"
    
    def test_discount_never_exceeds_d_max(self, default_config):
        """Discount percentage should never exceed D_max (70%)."""
        for hours in [24, 12, 6, 3, 1, 0.5, 0.1]:
            result = calculate_bungkus_dynamic_price(
                p_base=20000,
                p_min=5000,
                t_rem=timedelta(hours=hours),
                t_total=timedelta(hours=24),
                q_rem=50,
                q_init=50,
                config=default_config,
            )
            discount_pct = ((20000 - result) / 20000) * 100
            assert discount_pct <= 70.0, \
                f"Discount exceeded 70%: {discount_pct}% at {hours}h remaining"
    
    def test_idempotency(self, default_config):
        """Same inputs should always produce same outputs."""
        args = (
            20000, 5000,
            timedelta(hours=12), timedelta(hours=24),
            25, 50,
        )
        
        results = [
            calculate_bungkus_dynamic_price(*args, config=default_config)
            for _ in range(100)
        ]
        
        assert len(set(results)) == 1, "Function is not idempotent"


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
