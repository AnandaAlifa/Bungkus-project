-- ============================================================================
-- BUNGKUS! CORE SCHEMA — Group Buys ("Bungkus Bareng")
-- ============================================================================
-- State Machine:
--   OPEN → QUOTA_MET → LOCKED → PAYMENT_IN_PROGRESS → COMPLETED
--                  ↓              ↓
--               EXPIRED        FAILED → (auto-refund)
--                  ↓
--              CANCELLED
--
-- Redis Lock: lock:bungkus:group_buy:{id}:quota
-- Prevents race condition when multiple users join simultaneously.
-- ============================================================================

CREATE TABLE group_buys (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    leader_id           UUID            NOT NULL REFERENCES users(id),
    product_id          UUID            NOT NULL REFERENCES products(id),
    merchant_id         UUID            NOT NULL REFERENCES merchants(id),
    
    -- Quota management
    required_quota      INTEGER         NOT NULL,       -- minimum participants to succeed
    current_quota       INTEGER         NOT NULL DEFAULT 0,
    max_quota           INTEGER         NOT NULL,       -- cap on participants
    
    -- Pricing
    original_price      DECIMAL(10,2)   NOT NULL,       -- snapshot of p_base at creation
    group_price         DECIMAL(10,2)   NOT NULL,       -- discounted price per person
    discount_pct        DECIMAL(5,2)    GENERATED ALWAYS AS (
                            CASE WHEN original_price > 0 
                                 THEN ROUND(((original_price - group_price) / original_price * 100)::numeric, 2) 
                                 ELSE 0 
                            END
                        ) STORED,  -- auto-computed discount percentage
    
    -- Timing
    started_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ     NOT NULL,
    locked_at           TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    
    -- Status
    status              group_buy_status NOT NULL DEFAULT 'OPEN',
    
    -- Location (denormalized for fast spatial queries)
    location            GEOGRAPHY(POINT, 4326)  NOT NULL,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    
    -- Audit
    created_by          UUID,
    updated_by          UUID,
    
    -- Constraints
    CONSTRAINT chk_group_buy_quota 
        CHECK (required_quota > 0 AND max_quota >= required_quota),
    CONSTRAINT chk_group_buy_pricing 
        CHECK (group_price < original_price AND group_price > 0),
    CONSTRAINT chk_group_buy_expiry 
        CHECK (expires_at > started_at)
);

-- Indexes
CREATE INDEX idx_group_buys_product     ON group_buys (product_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_group_buys_merchant    ON group_buys (merchant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_buys_leader      ON group_buys (leader_id);
CREATE INDEX idx_group_buys_status      ON group_buys (status, expires_at)  WHERE deleted_at IS NULL;
CREATE INDEX idx_group_buys_open        ON group_buys (expires_at)
    WHERE status = 'OPEN' AND deleted_at IS NULL;
CREATE INDEX idx_group_buys_location    ON group_buys USING GIST (location);

CREATE TRIGGER trg_group_buys_updated_at
    BEFORE UPDATE ON group_buys
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- GROUP BUY PARTICIPANTS (join table with status per participant)
-- ============================================================================

CREATE TABLE group_buy_participants (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    group_buy_id        UUID            NOT NULL REFERENCES group_buys(id),
    user_id             UUID            NOT NULL REFERENCES users(id),
    
    -- Reservation: qty reserved for this participant
    reserved_qty        INTEGER         NOT NULL DEFAULT 1,
    
    -- Payment state per participant
    is_paid             BOOLEAN         NOT NULL DEFAULT false,
    paid_at             TIMESTAMPTZ,
    payment_id          UUID,           -- links to orders table
    
    -- Status
    joined_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    left_at             TIMESTAMPTZ,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    
    -- Prevent duplicate joins
    CONSTRAINT uq_group_buy_user 
        UNIQUE (group_buy_id, user_id)
);

CREATE INDEX idx_gbp_group_buy   ON group_buy_participants (group_buy_id) WHERE is_active = true;
CREATE INDEX idx_gbp_user        ON group_buy_participants (user_id);
CREATE INDEX idx_gbp_payment     ON group_buy_participants (payment_id) WHERE payment_id IS NOT NULL;


-- ============================================================================
-- ORDERS
-- ============================================================================
-- Supports both direct purchase and group buy orders.
-- QR verification hash used for pickup verification by merchant.
-- ============================================================================

CREATE TABLE orders (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    user_id             UUID            NOT NULL REFERENCES users(id),
    merchant_id         UUID            NOT NULL REFERENCES merchants(id),
    group_buy_id        UUID            REFERENCES group_buys(id),  -- NULL for direct orders
    
    -- Order details
    order_number        VARCHAR(20)     UNIQUE NOT NULL,  -- human-readable: BG-20260907-XXXXX
    status              order_status    NOT NULL DEFAULT 'PENDING_PAYMENT',
    
    -- Pricing snapshot (immutable at order creation)
    subtotal            DECIMAL(12,2)   NOT NULL,          -- sum of line items before discount
    discount_amount     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    total_price         DECIMAL(12,2)   NOT NULL,          -- final amount paid
    
    -- QR Verification
    qr_code_data        TEXT            NOT NULL,          -- QR payload (signed JWT)
    qr_verification_hash BYTEA          NOT NULL,          -- SHA-256 of qr_code_data for fast lookup
    qr_verified_at      TIMESTAMPTZ,
    qr_verified_by      UUID            REFERENCES users(id),
    
    -- Pickup
    pickup_deadline     TIMESTAMPTZ     NOT NULL,          -- must pick up before this time
    picked_up_at        TIMESTAMPTZ,
    
    -- Payment
    payment_method      payment_method,
    payment_provider    payment_provider,
    payment_reference   VARCHAR(255),   -- external payment gateway ref
    payment_token       BYTEA,          -- encrypted payment token
    paid_at             TIMESTAMPTZ,
    
    -- Refund
    refund_amount       DECIMAL(12,2)   DEFAULT 0,
    refund_reason       TEXT,
    refunded_at         TIMESTAMPTZ,
    
    -- ESG metrics (snapshot at order time)
    carbon_saved_kg     DECIMAL(10,4)   NOT NULL DEFAULT 0,
    waste_avoided_grams INTEGER         NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    
    -- Audit
    created_by          UUID,
    updated_by          UUID,
    
    -- Constraints
    CONSTRAINT chk_orders_price_positive 
        CHECK (subtotal >= 0 AND total_price >= 0 AND discount_amount >= 0),
    CONSTRAINT chk_orders_price_consistent
        CHECK (total_price = subtotal - discount_amount),
    CONSTRAINT chk_orders_carbon_non_negative 
        CHECK (carbon_saved_kg >= 0),
    CONSTRAINT chk_orders_refund_valid
        CHECK (refund_amount >= 0 AND refund_amount <= total_price)
);

-- Indexes
CREATE INDEX idx_orders_user           ON orders (user_id, created_at DESC)  WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_merchant       ON orders (merchant_id, created_at DESC)  WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status         ON orders (status)  WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_group_buy      ON orders (group_buy_id)
    WHERE group_buy_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_orders_qr_hash        ON orders (qr_verification_hash)
    WHERE qr_verified_at IS NULL;
CREATE INDEX idx_orders_pickup_deadline ON orders (pickup_deadline)
    WHERE status IN ('PAID', 'READY_FOR_PICKUP');
CREATE INDEX idx_orders_created        ON orders (created_at DESC)  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- ORDER ITEMS (line items)
-- ============================================================================

CREATE TABLE order_items (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID            NOT NULL REFERENCES orders(id),
    product_id          UUID            NOT NULL REFERENCES products(id),
    
    -- Snapshot at order time (immutable)
    product_name        VARCHAR(200)    NOT NULL,
    product_sku         VARCHAR(50)     NOT NULL,
    quantity            INTEGER         NOT NULL DEFAULT 1,
    unit_price          DECIMAL(10,2)   NOT NULL,  -- price per unit at order time
    line_total          DECIMAL(12,2)   NOT NULL,  -- quantity × unit_price
    
    -- ESG per item
    carbon_saved_kg     DECIMAL(10,4)   NOT NULL DEFAULT 0,
    
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_order_items_qty_positive 
        CHECK (quantity > 0 AND unit_price >= 0),
    CONSTRAINT chk_order_items_total 
        CHECK (line_total = quantity * unit_price)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);
