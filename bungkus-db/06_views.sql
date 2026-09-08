-- ============================================================================
-- BUNGKUS! VIEWS — Materialized & Regular Views for Queries
-- ============================================================================


-- ============================================================================
-- 1. NEARBY PRODUCTS (spatial query view)
-- ============================================================================
-- This is the primary query for the consumer "Discovery" feature.
-- Usage: SELECT * FROM v_nearby_products 
--        WHERE ST_DWithin(location, ST_MakePoint(:lng, :lat)::geography, :radius_meters)
--        ORDER BY discount_pct DESC, distance_m ASC;
-- ============================================================================

CREATE OR REPLACE VIEW v_nearby_products AS
SELECT 
    p.id                     AS product_id,
    p.merchant_id,
    p.name                   AS product_name,
    p.description,
    p.image_urls,
    p.p_base,
    p.p_min,
    p.p_current,
    p.discount_pct,
    p.q_rem,
    p.q_init,
    p.q_reserved,
    p.unit,
    p.weight_grams,
    p.expiry_timestamp,
    p.listed_at,
    p.status,
    p.group_buy_enabled,
    
    -- Merchant info
    m.name                   AS merchant_name,
    m.slug                   AS merchant_slug,
    m.business_type,
    m.avg_rating,
    m.total_reviews,
    m.operational_hours,
    m.status                 AS merchant_status,
    
    -- Spatial
    p.location               AS product_location,
    m.location               AS merchant_location,
    
    -- Category
    pc.name                  AS category_name,
    pc.name_id               AS category_name_id,
    pc.carbon_factor_kg,
    
    -- Time metrics
    EXTRACT(EPOCH FROM (p.expiry_timestamp - now())) / 3600 
                             AS hours_until_expiry,
    EXTRACT(EPOCH FROM (now() - p.listed_at)) / 3600 
                             AS hours_since_listed
    
FROM products p
JOIN merchants m ON m.id = p.merchant_id 
    AND m.deleted_at IS NULL 
    AND m.status = 'ACTIVE'  -- Only show products from active merchants
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE p.status IN ('ACTIVE', 'LOW_STOCK')
  AND p.expiry_timestamp > now()
  AND p.deleted_at IS NULL
  AND p.q_rem > 0;


-- ============================================================================
-- 2. ACTIVE GROUP BUYS NEARBY
-- ============================================================================

CREATE OR REPLACE VIEW v_active_group_buys AS
SELECT 
    gb.id                    AS group_buy_id,
    gb.product_id,
    gb.merchant_id,
    gb.leader_id,
    gb.required_quota,
    gb.current_quota,
    gb.max_quota,
    gb.original_price,
    gb.group_price,
    gb.discount_pct,
    gb.started_at,
    gb.expires_at,
    gb.status,
    gb.location,
    
    -- Progress
    ROUND((gb.current_quota::DECIMAL / gb.required_quota) * 100, 1) 
                             AS quota_pct,
    EXTRACT(EPOCH FROM (gb.expires_at - now())) / 60 
                             AS minutes_remaining,
    
    -- Product info
    p.name                   AS product_name,
    p.image_urls,
    p.q_rem,
    p.unit,
    p.weight_grams,
    
    -- Merchant info
    m.name                   AS merchant_name,
    m.slug                   AS merchant_slug,
    m.business_type,
    
    -- Participant names (for social proof)
    (
        SELECT jsonb_agg(jsonb_build_object(
            'name', u.display_name,
            'joined_at', gbp.joined_at
        ) ORDER BY gbp.joined_at)
        FROM group_buy_participants gbp
        JOIN users u ON u.id = gbp.user_id
        WHERE gbp.group_buy_id = gb.id 
          AND gbp.is_active = true
    )                        AS participants_preview

FROM group_buys gb
JOIN products p ON p.id = gb.product_id AND p.deleted_at IS NULL
JOIN merchants m ON m.id = gb.merchant_id 
    AND m.deleted_at IS NULL 
    AND m.status = 'ACTIVE'  -- Only show group buys from active merchants
WHERE gb.status IN ('OPEN', 'QUOTA_MET')
  AND gb.expires_at > now()
  AND gb.deleted_at IS NULL;


-- ============================================================================
-- 3. MERCHANT ANALYTICS (for Dashboard)
-- ============================================================================

CREATE OR REPLACE VIEW v_merchant_analytics AS
SELECT 
    m.id                    AS merchant_id,
    m.name                  AS merchant_name,
    m.tier,
    
    -- Order metrics (last 30 days)
    COUNT(DISTINCT o.id) FILTER (
        WHERE o.created_at > now() - INTERVAL '30 days'
          AND o.status = 'COMPLETED'
    )                       AS orders_30d,
    
    COALESCE(SUM(o.total_price) FILTER (
        WHERE o.created_at > now() - INTERVAL '30 days'
          AND o.status = 'COMPLETED'
    ), 0)                   AS revenue_30d,
    
    -- Waste metrics
    COALESCE(SUM(p.q_init - p.q_rem) FILTER (
        WHERE p.status IN ('EXPIRED', 'SOLD_OUT')
          AND p.updated_at > now() - INTERVAL '30 days'
    ), 0)                   AS items_sold_or_expired_30d,
    
    COALESCE(SUM(o.carbon_saved_kg) FILTER (
        WHERE o.created_at > now() - INTERVAL '30 days'
          AND o.status = 'COMPLETED'
    ), 0)                   AS carbon_saved_30d_kg,
    
    -- Active listings
    COUNT(DISTINCT p.id) FILTER (
        WHERE p.status IN ('ACTIVE', 'LOW_STOCK')
          AND p.deleted_at IS NULL
    )                       AS active_listings,
    
    -- Group buy metrics
    COUNT(DISTINCT gb.id) FILTER (
        WHERE gb.status = 'COMPLETED'
          AND gb.completed_at > now() - INTERVAL '30 days'
    )                       AS group_buys_completed_30d,
    
    -- Reviews
    m.avg_rating,
    m.total_reviews

FROM merchants m
LEFT JOIN products p ON p.merchant_id = m.id AND p.deleted_at IS NULL
LEFT JOIN orders o ON o.merchant_id = m.id AND o.deleted_at IS NULL
LEFT JOIN group_buys gb ON gb.merchant_id = m.id AND gb.deleted_at IS NULL
WHERE m.deleted_at IS NULL
GROUP BY m.id;


-- ============================================================================
-- 4. PRODUCT PRICING HISTORY (for dynamic price tracking)
-- ============================================================================

CREATE TABLE product_price_history (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id          UUID            NOT NULL REFERENCES products(id),
    
    p_base              DECIMAL(10,2)   NOT NULL,
    p_current           DECIMAL(10,2)   NOT NULL,
    discount_pct        DECIMAL(5,2)    NOT NULL,
    
    -- What triggered the price change
    trigger_reason      VARCHAR(50)     NOT NULL,  -- 'TIME_DECAY', 'GROUP_BUY', 'MANUAL', 'DEMAND_SURGE'
    
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product ON product_price_history (product_id, created_at DESC);
