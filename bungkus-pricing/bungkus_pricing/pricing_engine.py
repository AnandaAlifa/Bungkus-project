"""
Bungkus! Dynamic Pricing Engine — Core Algorithm
=================================================
Deterministic, side-effect-free pricing function for near-expiry
inventory liquidation based on continuous time-decay and stock pressure.

Mathematical Specification:
    P(t, q) = max(P_min, P_base * (1 - D_max * (1 - T_rem / T_total)^1.5 * (0.5 + 0.5 * (Q_rem / Q_init))))

Where:
    - D_max = 0.70 (Max 70% discount)
    - Currency rounding: Round down to nearest 100 IDR (Rupiah)
"""

from __future__ import annotations

from datetime import timedelta

from .models import PriceCalculationResult, PricingConfig, Product

# ============================================================================
# CONSTANTS
# ============================================================================

DEFAULT_CONFIG = PricingConfig()


# ============================================================================
# CORE PRICING FUNCTION (Pure, Side-Effect-Free)
# ============================================================================

def calculate_bungkus_dynamic_price(
    p_base: float,
    p_min: float,
    t_rem: timedelta,
    t_total: timedelta,
    q_rem: int,
    q_init: int,
    config: PricingConfig | None = None,
) -> float:
    """Calculate the dynamic price for a near-expiry product.
    
    This is a pure, deterministic function with no side effects.
    Given the same inputs, it always returns the same output.
    
    Mathematical Formula:
        P(t, q) = max(P_min, P_base * (1 - D_max * decay * pressure))
        
        Where:
            decay = (1 - T_rem / T_total)^1.5
            pressure = 0.5 + 0.5 * (Q_rem / Q_init)
    
    Args:
        p_base: Original price in IDR (must be > 0)
        p_min: Floor price in IDR (must be > 0 and <= p_base)
        t_rem: Time remaining until expiry
        t_total: Total listing duration (listed_at to expiry)
        q_rem: Remaining quantity
        q_init: Initial quantity
        config: Pricing configuration (uses defaults if None)
    
    Returns:
        Calculated price in IDR, rounded down to nearest 100,
        with floor protection at p_min.
    
    Raises:
        ValueError: If inputs are invalid (negative prices, etc.)
    """
    cfg = config or DEFAULT_CONFIG
    
    # ========================================================================
    # EDGE CASE: Immediate return to floor price
    # ========================================================================
    # If product is expired or out of stock, return minimum price immediately.
    # This prevents further calculations and ensures floor protection.
    if t_rem.total_seconds() <= 0 or q_rem <= 0:
        return _round_down_to_nearest(p_min, cfg.rounding_nearest)
    
    # ========================================================================
    # EDGE CASE: Zero-division safety
    # ========================================================================
    # If total duration is zero or initial quantity is zero,
    # return floor price to avoid division by zero.
    if t_total.total_seconds() <= 0 or q_init <= 0:
        return _round_down_to_nearest(p_min, cfg.rounding_nearest)
    
    # ========================================================================
    # INPUT VALIDATION
    # ========================================================================
    if p_base <= 0 or p_min <= 0:
        raise ValueError(f"Prices must be positive: p_base={p_base}, p_min={p_min}")
    
    if p_min > p_base:
        raise ValueError(f"p_min ({p_min}) must be <= p_base ({p_base})")
    
    if q_rem < 0 or q_init <= 0:
        raise ValueError(f"Quantities invalid: q_rem={q_rem}, q_init={q_init}")
    
    if q_rem > q_init:
        raise ValueError(f"q_rem ({q_rem}) must be <= q_init ({q_init})")
    
    # ========================================================================
    # CORE CALCULATION
    # ========================================================================
    
    # 1. Time Decay Factor
    #    Maps [0, 1] → [0, 1] with exponent curve
    #    At t_rem = t_total (just listed): ratio = 0, decay = 0
    #    At t_rem = 0 (about to expire): ratio = 1, decay = 1
    t_ratio = 1.0 - (t_rem.total_seconds() / t_total.total_seconds())
    
    # Clamp to [0, 1] for safety (should already be in range)
    t_ratio = max(0.0, min(1.0, t_ratio))
    
    # Apply exponent for curve shape (>1.0 = more aggressive late decay)
    decay = t_ratio ** cfg.time_decay_exponent
    
    # 2. Stock Pressure Factor
    #    Maps [0, q_init] → [stock_pressure_max, stock_pressure_min]
    #    At q_rem = q_init (full stock): pressure = 0.5 + 0.5 * 1.0 = 1.0
    #    At q_rem = 0 (empty stock): pressure = 0.5 + 0.5 * 0.0 = 0.5
    stock_ratio = q_rem / q_init
    pressure = cfg.stock_pressure_min + (cfg.stock_pressure_max - cfg.stock_pressure_min) * stock_ratio
    
    # 3. Discount Factor
    #    Combines time decay and stock pressure
    discount_factor = cfg.d_max * decay * pressure
    
    # 4. Clamp discount factor to [0, d_max]
    #    This ensures we never exceed the maximum discount
    discount_factor = max(0.0, min(cfg.d_max, discount_factor))
    
    # 5. Calculate raw price
    raw_price = p_base * (1.0 - discount_factor)
    
    # ========================================================================
    # FLOOR PROTECTION
    # ========================================================================
    # Never return a price below p_min, regardless of calculation
    protected_price = max(p_min, raw_price)
    
    # ========================================================================
    # CURRENCY ROUNDING
    # ========================================================================
    # Round down to nearest N IDR (e.g., nearest 100 Rp)
    # This is standard for Indonesian pricing display
    final_price = _round_down_to_nearest(protected_price, cfg.rounding_nearest)
    
    return final_price


# ============================================================================
# CURRENCY ROUNDING HELPER
# ============================================================================

def _round_down_to_nearest(value: float, nearest: int) -> float:
    """Round down to nearest N units.
    
    Examples:
        _round_down_to_nearest(15750, 100) → 15700
        _round_down_to_nearest(15000, 100) → 15000
        _round_down_to_nearest(15001, 100) → 15000
        _round_down_to_nearest(999, 100)   → 900
    
    Args:
        value: The value to round
        nearest: Round down to nearest this many units
    
    Returns:
        Rounded down value
    """
    if nearest <= 0:
        return value
    
    # Use floor division for round-down behavior
    return float(int(value // nearest) * nearest)


# ============================================================================
# HIGH-LEVEL CALCULATION WITH RESULT
# ============================================================================

def calculate_price_for_product(
    product: Product,
    config: PricingConfig | None = None,
) -> PriceCalculationResult:
    """Calculate dynamic price for a Product model.
    
    This is a convenience wrapper that returns a detailed result
    including metadata for logging and audit trails.
    
    Args:
        product: Product model with all required fields
        config: Pricing configuration (uses defaults if None)
    
    Returns:
        PriceCalculationResult with pricing details and delist decision
    """
    cfg = config or DEFAULT_CONFIG
    
    # Calculate time durations
    t_total = product.t_total
    t_rem = product.t_rem
    
    # Calculate new price
    p_new = calculate_bungkus_dynamic_price(
        p_base=product.p_base,
        p_min=product.p_min,
        t_rem=t_rem,
        t_total=t_total,
        q_rem=product.q_rem,
        q_init=product.q_init,
        config=cfg,
    )
    
    # Calculate discount percentage
    discount_pct = ((product.p_base - p_new) / product.p_base) * 100.0
    
    # Determine if should delist
    should_delist = False
    delist_reason = None
    
    # Check expiry
    if t_rem.total_seconds() <= 0:
        should_delist = True
        delist_reason = "EXPIRED"
    
    # Check food safety buffer
    elif t_rem.total_seconds() <= cfg.food_safety_buffer_hours * 3600:
        should_delist = True
        delist_reason = "FOOD_SAFETY_THRESHOLD"
    
    # Check out of stock
    elif product.q_rem <= 0:
        should_delist = True
        delist_reason = "SOLD_OUT"
    
    # Check if price hit floor (optional: delist if no margin left)
    elif p_new <= product.p_min and t_rem.total_seconds() > 0:
        # Don't auto-delist at floor price; let merchant decide
        pass
    
    return PriceCalculationResult(
        product_id=product.id,
        p_base=product.p_base,
        p_min=product.p_min,
        p_old=product.p_current,
        p_new=p_new,
        discount_pct=round(discount_pct, 2),
        t_rem_hours=round(t_rem.total_seconds() / 3600, 2),
        q_rem=product.q_rem,
        q_init=product.q_init,
        should_delist=should_delist,
        delist_reason=delist_reason,
    )


# ============================================================================
# FORMULA REFERENCE (for documentation)
# ============================================================================

"""
MATHEMATICAL DERIVATION:
========================

Given:
    P_base    = Original price
    P_min     = Floor price
    D_max     = Maximum discount (0.70)
    T_rem     = Time remaining
    T_total   = Total listing duration
    Q_rem     = Remaining quantity
    Q_init    = Initial quantity
    alpha     = Time decay exponent (1.5)
    beta_min  = Stock pressure minimum (0.5)
    beta_max  = Stock pressure maximum (1.0)

Step 1: Time Decay
    t_ratio = 1 - (T_rem / T_total)     # [0, 1]
    decay   = t_ratio^alpha              # [0, 1], curve shaped by alpha

Step 2: Stock Pressure
    stock_ratio = Q_rem / Q_init         # [0, 1]
    pressure    = beta_min + (beta_max - beta_min) * stock_ratio  # [0.5, 1.0]

Step 3: Discount Factor
    df = D_max * decay * pressure        # [0, D_max]

Step 4: Price Calculation
    P_raw = P_base * (1 - df)

Step 5: Floor Protection
    P_protected = max(P_min, P_raw)

Step 6: Currency Rounding
    P_final = floor(P_protected / 100) * 100

Behavior Analysis:
    - At listing (t_rem = T_total): decay = 0, df = 0, P = P_base
    - At 50% time (t_rem = 0.5*T_total): decay = 0.354, df ≈ 0.248
    - At expiry (t_rem = 0): decay = 1, df = D_max * pressure, P = P_min
    - Full stock (Q_rem = Q_init): pressure = 1.0, faster discount
    - Low stock (Q_rem ≈ 0): pressure = 0.5, slower discount
    
    The 1.5 exponent creates an accelerating curve:
    - Early listing: prices stay high
    - Mid-life: moderate drops
    - Near expiry: aggressive drops (clearing inventory)
"""
