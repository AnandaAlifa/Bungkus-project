-- ============================================================================
-- BUNGKUS! BUSINESS LOGIC — Stored Procedures & Functions
-- ============================================================================


-- ============================================================================
-- 1. AUTO-DELISTING ENGINE (PostgreSQL-side)
-- ============================================================================
-- Runs via pg_cron or application scheduler.
-- Marks products as EXPIRED when expiry_timestamp has passed.
-- Emits notification events for affected users.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_delist_products()
RETURNS TABLE (
    delisted_product_id UUID,
    merchant_id UUID,
    product_name VARCHAR,
    was_in_group_buy BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH expired_products AS (
        UPDATE products p
        SET 
            status = 'EXPIRED',
            delisted_at = now(),
            q_rem = 0,
            q_reserved = 0,  -- Release all reservations for expired products
            updated_at = now()
        WHERE p.status IN ('ACTIVE', 'LOW_STOCK')
          AND p.expiry_timestamp < now()
          AND p.deleted_at IS NULL
        RETURNING p.id, p.merchant_id, p.name, p.group_buy_enabled
    )
    SELECT 
        ep.id,
        ep.merchant_id,
        ep.name,
        ep.group_buy_enabled
    FROM expired_products ep;
END;
$$ LANGUAGE plpgsql;


-- Also expire open group buys that passed their deadline
CREATE OR REPLACE FUNCTION fn_expire_group_buys()
RETURNS TABLE (
    expired_group_buy_id UUID,
    affected_participants INTEGER,
    product_id UUID
) AS $$
BEGIN
    RETURN QUERY
    WITH expired_gbs AS (
        UPDATE group_buys gb
        SET 
            status = 'EXPIRED',
            updated_at = now()
        WHERE gb.status IN ('OPEN', 'QUOTA_MET')
          AND gb.expires_at < now()
          AND gb.deleted_at IS NULL
        RETURNING gb.id, gb.product_id
    ),
    participant_counts AS (
        SELECT 
            egb.id AS gb_id,
            egb.product_id AS pid,
            (
                SELECT COUNT(*)::INTEGER 
                FROM group_buy_participants gbp 
                WHERE gbp.group_buy_id = egb.id AND gbp.is_active = true
            ) AS participant_count
        FROM expired_gbs egb
    ),
    released_inventory AS (
        -- Release reserved inventory for each expired group buy
        UPDATE products p
        SET 
            q_rem = q_rem + (
                SELECT COALESCE(SUM(gbp.reserved_qty), 0)
                FROM group_buy_participants gbp
                WHERE gbp.group_buy_id = pc.gb_id AND gbp.is_active = true
            ),
            q_reserved = q_reserved - (
                SELECT COALESCE(SUM(gbp.reserved_qty), 0)
                FROM group_buy_participants gbp
                WHERE gbp.group_buy_id = pc.gb_id AND gbp.is_active = true
            ),
            updated_at = now()
        FROM participant_counts pc
        WHERE p.id = pc.pid
        RETURNING p.id
    )
    SELECT 
        pc.gb_id,
        pc.participant_count,
        pc.pid
    FROM participant_counts pc;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 2. ORDER NUMBER GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INTEGER;
BEGIN
    -- Get next value from sequence (daily reset)
    -- Format: BG-YYYYMMDD-XXXXX
    SELECT nextval('order_number_seq') INTO seq_val;
    
    NEW.order_number := 'BG-' || to_char(now(), 'YYYYMMDD') || '-' || 
                        lpad(seq_val::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

CREATE TRIGGER trg_orders_generate_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION fn_generate_order_number();


-- ============================================================================
-- 3. RESERVE INVENTORY (atomic operation)
-- ============================================================================
-- Used during order creation to atomically decrement q_rem and increment q_reserved.
-- This is the SQL-side complement to Redis distributed locking.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_reserve_inventory(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    available INTEGER;
BEGIN
    -- Validate input
    IF p_quantity <= 0 THEN
        RETURN false;
    END IF;
    
    -- Lock the row to prevent race conditions
    SELECT q_rem INTO available
    FROM products
    WHERE id = p_product_id
      AND status IN ('ACTIVE', 'LOW_STOCK')
      AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    IF available < p_quantity THEN
        RETURN false;
    END IF;
    
    UPDATE products
    SET 
        q_rem = q_rem - p_quantity,
        q_reserved = q_reserved + p_quantity,
        status = CASE 
            WHEN (q_rem - p_quantity) <= 0 THEN 'SOLD_OUT'::product_status
            WHEN (q_rem - p_quantity) <= (q_init * 0.1) THEN 'LOW_STOCK'::product_status
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_product_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4. RELEASE RESERVED INVENTORY (for cancellations / timeouts)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_release_inventory(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validate input
    IF p_quantity <= 0 THEN
        RETURN;
    END IF;
    
    UPDATE products
    SET 
        q_rem = q_rem + p_quantity,
        q_reserved = q_reserved - p_quantity,
        status = CASE 
            WHEN status = 'SOLD_OUT' THEN 
                CASE WHEN (q_rem + p_quantity) <= (q_init * 0.1) 
                     THEN 'LOW_STOCK'::product_status
                     ELSE 'ACTIVE'::product_status
                END
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_product_id
      AND (q_reserved - p_quantity) >= 0;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 5. CONFIRM QR PICKUP
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_confirm_pickup(
    p_order_id UUID,
    p_verifier_id UUID,
    p_qr_hash BYTEA
)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT id, status, qr_verification_hash
    INTO v_order
    FROM orders
    WHERE id = p_order_id
      AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    IF v_order.status NOT IN ('PAID', 'READY_FOR_PICKUP') THEN
        RETURN false;
    END IF;
    
    IF v_order.qr_verification_hash != p_qr_hash THEN
        RETURN false;
    END IF;
    
    UPDATE orders
    SET 
        status = 'PICKED_UP',
        qr_verified_at = COALESCE(qr_verified_at, now()),
        qr_verified_by = COALESCE(qr_verified_by, p_verifier_id),
        picked_up_at = COALESCE(picked_up_at, now()),
        updated_at = now()
    WHERE id = p_order_id;
    
    -- Update merchant metrics
    UPDATE merchants m
    SET 
        total_orders = m.total_orders + 1,
        updated_at = now()
    FROM orders o
    WHERE o.id = p_order_id AND m.id = o.merchant_id;
    
    -- Update user metrics
    UPDATE users u
    SET 
        total_orders_completed = u.total_orders_completed + 1,
        total_savings_rp = u.total_savings_rp + (o.subtotal - o.total_price),
        total_carbon_saved_kg = u.total_carbon_saved_kg + o.carbon_saved_kg,
        updated_at = now()
    FROM orders o
    WHERE o.id = p_order_id AND u.id = o.user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 6. RECALCULATE MERCHANT RATING
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_merchant_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
BEGIN
    -- Get merchant_id from either INSERT or UPDATE
    v_merchant_id := COALESCE(NEW.merchant_id, OLD.merchant_id);
    
    UPDATE merchants m
    SET 
        avg_rating = (
            SELECT COALESCE(AVG(rating), 0)
            FROM reviews
            WHERE merchant_id = v_merchant_id
              AND is_visible = true
              AND deleted_at IS NULL
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM reviews
            WHERE merchant_id = v_merchant_id
              AND is_visible = true
              AND deleted_at IS NULL
        ),
        updated_at = now()
    WHERE m.id = v_merchant_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger fires on INSERT, UPDATE, and DELETE to handle visibility changes
CREATE TRIGGER trg_reviews_update_merchant_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_merchant_rating();


-- ============================================================================
-- 7. ANONYMIZE USER DATA (UU PDP: Right to Erasure)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_anonymize_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET 
        display_name = 'User-' || left(md5(p_user_id::TEXT), 8),
        email = 'deleted-' || left(md5(p_user_id::TEXT), 8) || '@bungkus.invalid',
        phone_number = NULL,
        avatar_url = NULL,
        pii_email_hash = NULL,
        pii_phone_hash = NULL,
        pii_name_hash = NULL,
        notification_prefs = '{"push_enabled": false, "email_enabled": false}'::jsonb,
        is_active = false,
        deleted_at = now(),
        updated_at = now()
    WHERE id = p_user_id;
    
    -- Log the anonymization for compliance
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_values, purpose, data_classification)
    VALUES (
        p_user_id,
        'USER_ANONYMIZE',
        'user',
        p_user_id,
        jsonb_build_object('anonymized_at', now()),
        'User requested data erasure under UU PDP',
        'CONFIDENTIAL'
    );
END;
$$ LANGUAGE plpgsql;
