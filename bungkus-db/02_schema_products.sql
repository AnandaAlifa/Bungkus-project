-- ============================================================================
-- BUNGKUS! CORE SCHEMA — Products & Inventory
-- ============================================================================
-- Products inherit merchant location for spatial queries without JOINs.
-- Prices are denormalized: p_current = dynamic pricing engine output,
-- cached in Redis with TTL matching decay interval.
-- ============================================================================

CREATE TABLE product_categories (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100)    UNIQUE NOT NULL,
    name_id             VARCHAR(100)    NOT NULL,  -- Indonesian name
    slug                VARCHAR(100)    UNIQUE NOT NULL,
    icon                VARCHAR(50),
    carbon_factor_kg    DECIMAL(8,4)    NOT NULL DEFAULT 1.0000,  -- kgCO2e per kg of food waste avoided
    parent_id           UUID            REFERENCES product_categories(id),
    sort_order          INTEGER         NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- Seed default categories (idempotent: safe to re-run)
INSERT INTO product_categories (name, name_id, slug, carbon_factor_kg) VALUES
    ('Bakery',      'Roti & Kue',       'bakery',       1.0),
    ('Dairy',       'Susu & Olahan',    'dairy',        3.2),
    ('Meat',        'Daging',           'meat',         15.0),
    ('Poultry',     'Unggas',           'poultry',      6.9),
    ('Seafood',     'Ikan & Seafood',   'seafood',      8.0),
    ('Vegetables',  'Sayuran',          'vegetables',   0.4),
    ('Fruits',      'Buah',             'fruits',       0.5),
    ('Ready Meals', 'Makanan Siap',     'ready-meals',  2.5),
    ('Beverages',   'Minuman',          'beverages',    0.8),
    ('Snacks',      'Snack & Cemilan',  'snacks',       1.2)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- PRODUCTS
-- ============================================================================

CREATE TABLE products (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID            NOT NULL REFERENCES merchants(id),
    category_id         UUID            REFERENCES product_categories(id),
    
    -- Product info
    sku                 VARCHAR(50)     NOT NULL,
    name                VARCHAR(200)    NOT NULL,
    description         TEXT,
    image_urls          TEXT[]          DEFAULT '{}',
    weight_grams        INTEGER,        -- for carbon calculation
    unit                VARCHAR(20)     NOT NULL DEFAULT 'pcs',  -- pcs, kg, pack
    
    -- Pricing
    p_base              DECIMAL(10,2)   NOT NULL,     -- original price (Rp)
    p_min               DECIMAL(10,2)   NOT NULL,     -- floor price (merchant won't go below)
    p_current           DECIMAL(10,2)   NOT NULL,     -- dynamic price (updated by pricing engine)
    discount_pct        DECIMAL(5,2)    GENERATED ALWAYS AS (
                            CASE WHEN p_base > 0 
                                 THEN ROUND(((p_base - p_current) / p_base * 100)::numeric, 2) 
                                 ELSE 0 
                            END
                        ) STORED,  -- auto-computed discount percentage
    
    -- Inventory
    q_init              INTEGER         NOT NULL,     -- initial quantity listed (must be > 0 at creation)
    q_rem               INTEGER         NOT NULL,     -- remaining quantity
    q_reserved          INTEGER         NOT NULL DEFAULT 0,  -- reserved in carts / group buys
    
    -- Expiry
    expiry_timestamp    TIMESTAMPTZ     NOT NULL,
    listed_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    delisted_at         TIMESTAMPTZ,
    
    -- Location (denormalized from merchant for fast spatial queries)
    location            GEOGRAPHY(POINT, 4326)  NOT NULL,
    
    -- Pricing engine metadata
    last_price_update   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    price_decay_hours   DECIMAL(6,2)    NOT NULL DEFAULT 0,  -- hours since listed, used by pricing engine
    
    -- Status
    status              product_status  NOT NULL DEFAULT 'ACTIVE',
    
    -- Group buy link
    group_buy_enabled   BOOLEAN         NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    
    -- Audit
    created_by          UUID,
    updated_by          UUID,
    
    -- Constraints
    CONSTRAINT chk_products_price_positive 
        CHECK (p_base > 0 AND p_min > 0 AND p_current > 0),
    CONSTRAINT chk_products_price_floor 
        CHECK (p_current >= p_min),
    CONSTRAINT chk_products_qty_valid 
        CHECK (q_init > 0 AND q_rem >= 0 AND q_reserved >= 0),
    CONSTRAINT chk_products_qty_consistent 
        CHECK (q_rem + q_reserved <= q_init),
    CONSTRAINT chk_products_expiry_future 
        CHECK (expiry_timestamp > created_at),
    CONSTRAINT chk_products_sku_unique_per_merchant 
        UNIQUE (merchant_id, sku)
);

-- Spatial Index (GIST) — for "find products near me"
CREATE INDEX idx_products_location 
    ON products USING GIST (location);

-- Other critical indexes
CREATE INDEX idx_products_merchant       ON products (merchant_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category       ON products (category_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status         ON products (status, expiry_timestamp)  WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active_near    ON products (expiry_timestamp, p_current)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;
CREATE INDEX idx_products_expiry         ON products (expiry_timestamp)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;
CREATE INDEX idx_products_price          ON products (p_current)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;
CREATE INDEX idx_products_group_buy      ON products (group_buy_enabled)
    WHERE group_buy_enabled = true AND status = 'ACTIVE' AND deleted_at IS NULL;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();
