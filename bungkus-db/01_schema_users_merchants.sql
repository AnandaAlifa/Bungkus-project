-- ============================================================================
-- BUNGKUS! CORE SCHEMA — Users & Authentication
-- ============================================================================
-- UU PDP Compliance: PII fields are pseudonymization-ready.
-- All sensitive data encrypted at application layer (AES-256-GCM).
-- ============================================================================

-- Users table (unified: consumer + merchant staff)
CREATE TABLE users (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Authentication (password never stored here, handled by auth service)
    email               VARCHAR(320)    NOT NULL,  -- RFC 5321 max
    phone_number        VARCHAR(20),
    auth_provider       VARCHAR(20)     DEFAULT 'LOCAL',  -- LOCAL, GOOGLE, APPLE
    auth_provider_id    VARCHAR(255),
    
    -- Profile
    display_name        VARCHAR(100)    NOT NULL,
    avatar_url          TEXT,
    role                user_role       NOT NULL DEFAULT 'CONSUMER',
    
    -- UU PDP / Compliance: These fields support anonymization
    -- When user requests deletion, we replace with anonymized values
    -- keeping referential integrity intact
    pii_email_hash      BYTEA,          -- sha256(email) for dedup after anonymization
    pii_phone_hash      BYTEA,          -- sha256(phone) for dedup after anonymization
    pii_name_hash       BYTEA,          -- sha256(name) for analytics after anonymization
    
    -- Notification preferences (JSONB for flexibility)
    notification_prefs  JSONB           NOT NULL DEFAULT '{
        "push_enabled": true,
        "email_enabled": true,
        "sms_enabled": false,
        "group_buy_alerts": true,
        "price_drop_alerts": true,
        "nearby_alerts": true
    }'::jsonb,
    
    -- ESG: Personal carbon tracker
    total_carbon_saved_kg   DECIMAL(12,4)   NOT NULL DEFAULT 0.0000,
    total_savings_rp        BIGINT          NOT NULL DEFAULT 0,  -- in Rupiah
    total_orders_completed  INTEGER         NOT NULL DEFAULT 0,
    
    -- Status & timestamps
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    is_verified         BOOLEAN         NOT NULL DEFAULT false,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Soft delete (UU PDP: right to erasure)
    deleted_at          TIMESTAMPTZ,
    
    -- Audit
    created_by          UUID,
    updated_by          UUID
);

-- Partial unique indexes (exclude soft-deleted users)
CREATE UNIQUE INDEX uq_users_email     ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_phone     ON users (phone_number) WHERE deleted_at IS NULL AND phone_number IS NOT NULL;

-- Indexes for users
CREATE INDEX idx_users_role             ON users (role)            WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_provider    ON users (auth_provider, auth_provider_id)
    WHERE auth_provider_id IS NOT NULL;
CREATE INDEX idx_users_active           ON users (is_active, created_at DESC)
    WHERE deleted_at IS NULL;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- MERCHANTS
-- ============================================================================

CREATE TABLE merchants (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID            NOT NULL REFERENCES users(id),
    
    -- Business info
    name                VARCHAR(200)    NOT NULL,
    slug                VARCHAR(200)    UNIQUE NOT NULL,  -- URL-friendly name
    description         TEXT,
    business_type       VARCHAR(50)     NOT NULL,  -- bakery, supermarket, restaurant, warung
    
    -- Location (PostGIS Geography, SRID 4326 = WGS84)
    location            GEOGRAPHY(POINT, 4326)  NOT NULL,
    address_full        TEXT            NOT NULL,
    address_city        VARCHAR(100)    NOT NULL,
    address_province    VARCHAR(100)    NOT NULL,
    address_postal      VARCHAR(10),
    
    -- Operational hours (JSONB for flexible schema)
    -- Format: {"mon": {"open": "08:00", "close": "21:00"}, "tue": {...}, ...}
    operational_hours   JSONB           NOT NULL DEFAULT '{}'::jsonb,
    
    -- POS Integration
    pos_provider        VARCHAR(50),    -- moka, pawoon, ireap, manual
    pos_api_key_hash    BYTEA,          -- AES-256-GCM encrypted
    pos_store_id        VARCHAR(255),
    pos_sync_enabled    BOOLEAN         NOT NULL DEFAULT false,
    pos_last_sync_at    TIMESTAMPTZ,
    
    -- Dynamic pricing config
    pricing_strategy    JSONB           NOT NULL DEFAULT '{
        "enabled": true,
        "decay_rate_per_hour": 5,
        "min_discount_pct": 10,
        "max_discount_pct": 70,
        "floor_price_mode": "absolute",
        "floor_price_value": 5000
    }'::jsonb,
    
    -- Group buy config
    group_buy_enabled   BOOLEAN         NOT NULL DEFAULT false,
    group_buy_config    JSONB           NOT NULL DEFAULT '{
        "min_participants": 5,
        "max_participants": 50,
        "duration_minutes": 60,
        "extra_discount_pct": 15
    }'::jsonb,
    
    -- Metrics (denormalized for fast reads)
    avg_rating          DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
    total_reviews       INTEGER         NOT NULL DEFAULT 0,
    total_orders        INTEGER         NOT NULL DEFAULT 0,
    total_waste_saved_kg DECIMAL(12,4)  NOT NULL DEFAULT 0.0000,
    
    -- Status & compliance
    status              merchant_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    tier                merchant_tier   NOT NULL DEFAULT 'BRONZE',
    bpom_number         VARCHAR(50),    -- Food safety registration
    npwp_number         VARCHAR(30),    -- Tax ID (encrypted at app layer)
    siup_number         VARCHAR(50),    -- Business license
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    
    -- Audit
    created_by          UUID,
    updated_by          UUID
);

-- Spatial Index (GIST) — CRITICAL for geofencing queries
CREATE INDEX idx_merchants_location 
    ON merchants USING GIST (location);

-- Other indexes
CREATE INDEX idx_merchants_slug         ON merchants (slug);
CREATE INDEX idx_merchants_owner        ON merchants (owner_id);
CREATE INDEX idx_merchants_status       ON merchants (status)      WHERE deleted_at IS NULL;
CREATE INDEX idx_merchants_city         ON merchants (address_city) WHERE deleted_at IS NULL;
CREATE INDEX idx_merchants_type         ON merchants (business_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_merchants_tier         ON merchants (tier);
CREATE INDEX idx_merchants_pos_sync     ON merchants (pos_sync_enabled, pos_last_sync_at)
    WHERE pos_sync_enabled = true AND deleted_at IS NULL;

CREATE TRIGGER trg_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();
