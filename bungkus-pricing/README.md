# Bungkus! Dynamic Pricing Engine

Deterministic, side-effect-free pricing algorithm for near-expiry inventory liquidation.

## Installation

```bash
pip install -e ".[dev]"
```

## Usage

```python
from datetime import timedelta
from bungkus_pricing import calculate_bungkus_dynamic_price

# Calculate price for a bakery item
price = calculate_bungkus_dynamic_price(
    p_base=20000,      # Rp 20,000 original price
    p_min=5000,        # Rp 5,000 floor price
    t_rem=timedelta(hours=2),    # 2 hours until expiry
    t_total=timedelta(hours=24), # Listed 24 hours ago
    q_rem=10,          # 10 items remaining
    q_init=50,         # Started with 50 items
)
# Returns: Rp 15,200 (24% discount)
```

## Mathematical Formula

```
P(t, q) = max(P_min, P_base * (1 - D_max * decay * pressure))

Where:
    decay    = (1 - T_rem / T_total)^1.5
    pressure = 0.5 + 0.5 * (Q_rem / Q_init)
    D_max    = 0.70 (70% max discount)
```

## Running Tests

```bash
pytest tests/ -v
```
