-- ============================================================================
-- BUNGKUS! SCHEMA — Payments, Notifications, Reviews, Audit Trail
-- ============================================================================


-- ============================================================================
-- PAYMENTS (detailed payment ledger)
-- ============================================================================

CREATE TABLE payments (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID            NOT NULL REFERENCES orders(id),
    
    -- Payment details
    amount              DECIMAL(12,2)   NOT NULL,
    currency            VARCHAR(3)      NOT NULL DEFAULT 'IDR',
    method              payment_method  NOT NULL,
    provider            payment_provider NOT NULL,
    
    -- Provider response
    provider_ref        VARCHAR(255),   -- external reference ID
    provider_status     VARCHAR(50),    -- raw status from gateway
    provider_response   JSONB,          -- full webhook payload
    
    -- Virtual Account specifics
    va_number           VARCHAR(50),
    va_bank             VARCHAR(20),
    va_expires_at       TIMESTAMPTZ,
    
    -- QRIS specifics
    qris_string         TEXT,
    qris_image_url      TEXT,
    
    -- Status
    is_success          BOOLEAN         NOT NULL DEFAULT false,
    is_refund           BOOLEAN         NOT NULL DEFAULT false,
    refunded_amount     DECIMAL(12,2)   DEFAULT 0,
    
    -- Timestamps
    initiated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT chk_payments_refund_valid
        CHECK (refunded_amount >= 0 AND refunded_amount <= amount)
);

CREATE INDEX idx_payments_order        ON payments (order_id);
CREATE INDEX idx_payments_provider_ref ON payments (provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX idx_payments_status       ON payments (is_success, created_at DESC);
CREATE INDEX idx_payments_pending      ON payments (expires_at)
    WHERE is_success = false AND expires_at IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES users(id),
    
    type                notification_type NOT NULL,
    title               VARCHAR(200)    NOT NULL,
    body                TEXT            NOT NULL,
    
    -- Deep link payload
    action_url          TEXT,           -- e.g., "bungkus://product/uuid"
    entity_type         VARCHAR(50),    -- 'product', 'group_buy', 'order'
    entity_id           UUID,           -- referenced entity
    
    -- Delivery tracking
    is_read             BOOLEAN         NOT NULL DEFAULT false,
    read_at             TIMESTAMPTZ,
    is_push_sent        BOOLEAN         NOT NULL DEFAULT false,
    push_sent_at        TIMESTAMPTZ,
    is_email_sent       BOOLEAN         NOT NULL DEFAULT false,
    email_sent_at       TIMESTAMPTZ,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user     ON notifications (user_id, created_at DESC)  WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_unread   ON notifications (user_id, created_at DESC)
    WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX idx_notifications_entity   ON notifications (entity_type, entity_id)
    WHERE entity_id IS NOT NULL;

CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE reviews (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES users(id),
    merchant_id         UUID            NOT NULL REFERENCES merchants(id),
    order_id            UUID            NOT NULL REFERENCES orders(id),
    
    -- Rating
    rating              SMALLINT        NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title               VARCHAR(200),
    comment             TEXT,
    
    -- Food quality specific
    food_quality        SMALLINT        CHECK (food_quality BETWEEN 1 AND 5),
    value_for_money     SMALLINT        CHECK (value_for_money BETWEEN 1 AND 5),
    freshness           SMALLINT        CHECK (freshness BETWEEN 1 AND 5),
    
    -- Merchant response
    merchant_reply      TEXT,
    merchant_replied_at TIMESTAMPTZ,
    
    -- Moderation
    is_visible          BOOLEAN         NOT NULL DEFAULT true,
    moderated_at        TIMESTAMPTZ,
    
    -- One review per order
    CONSTRAINT uq_review_per_order 
        UNIQUE (user_id, order_id),
    
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_reviews_merchant   ON reviews (merchant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_user       ON reviews (user_id);
CREATE INDEX idx_reviews_order      ON reviews (order_id);
CREATE INDEX idx_reviews_rating     ON reviews (merchant_id, rating) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================================
-- AUDIT LOG (immutable append-only)
-- ============================================================================
-- Every state-changing operation is logged here.
-- Table is INSERT-only; UPDATE/DELETE operations are forbidden.
-- UU PDP / UU ITE compliance: complete trail of data access and modifications.
-- ============================================================================

CREATE TABLE audit_log (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_timestamp     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Who
    actor_id            UUID            REFERENCES users(id),
    actor_ip            INET,
    actor_user_agent    TEXT,
    
    -- What
    action              VARCHAR(100)    NOT NULL,  -- e.g., 'ORDER_CREATE', 'PRODUCT_UPDATE', 'GROUP_BUY_JOIN'
    entity_type         VARCHAR(50)     NOT NULL,  -- 'user', 'merchant', 'product', 'order', 'group_buy'
    entity_id           UUID            NOT NULL,
    
    -- Change tracking (before/after for UPDATE, payload for CREATE)
    old_values          JSONB,
    new_values          JSONB,
    
    -- Context
    request_id          UUID,           -- correlation ID from API gateway
    session_id          UUID,
    
    -- Compliance metadata
    data_classification VARCHAR(20)     DEFAULT 'INTERNAL',  -- PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
    purpose             VARCHAR(100),   -- why this data was accessed (UU PDP requirement)
    
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX idx_audit_actor         ON audit_log (actor_id, event_timestamp DESC);
CREATE INDEX idx_audit_entity        ON audit_log (entity_type, entity_id, event_timestamp DESC);
CREATE INDEX idx_audit_action        ON audit_log (action, event_timestamp DESC);
CREATE INDEX idx_audit_timestamp     ON audit_log (event_timestamp DESC);
CREATE INDEX idx_audit_request       ON audit_log (request_id) WHERE request_id IS NOT NULL;

-- NO UPDATE/DELETE triggers — enforce immutability
CREATE OR REPLACE FUNCTION fn_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log table is immutable — UPDATE and DELETE are forbidden';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_immutable();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_immutable();


-- ============================================================================
-- MERCHANT STAFF (link users to merchant operations)
-- ============================================================================

CREATE TABLE merchant_staff (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID            NOT NULL REFERENCES merchants(id),
    user_id             UUID            NOT NULL REFERENCES users(id),
    
    role                VARCHAR(50)     NOT NULL DEFAULT 'STAFF',  -- OWNER, MANAGER, STAFF
    can_manage_products BOOLEAN         NOT NULL DEFAULT false,
    can_scan_qr         BOOLEAN         NOT NULL DEFAULT true,
    can_view_analytics  BOOLEAN         NOT NULL DEFAULT false,
    
    invited_by          UUID            REFERENCES users(id),
    accepted_at         TIMESTAMPTZ,
    
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_merchant_staff 
        UNIQUE (merchant_id, user_id)
);

CREATE INDEX idx_merchant_staff_merchant ON merchant_staff (merchant_id) WHERE is_active = true;
CREATE INDEX idx_merchant_staff_user     ON merchant_staff (user_id);
