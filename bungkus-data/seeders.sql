-- ============================================================
-- Bungkus! — Dummy Data Seeder (PostgreSQL 15+ / PostGIS)
-- ============================================================
-- Run: psql -U postgres -d bungkus -f seeders.sql
-- ============================================================

-- ============================================================
-- 1. MERCHANTS (5 realistic Jabodetabek merchants)
-- ============================================================
INSERT INTO merchants (
  id, name, slug, owner_id, business_type, status, tier,
  location, address, city, operational_hours,
  pos_connected, pos_provider, avg_rating, total_reviews,
  created_at
) VALUES
-- Holland Bakery South Jakarta
(
  'm-001-holland',
  'Holland Bakery cab. Senopati',
  'holland-senopati',
  'u-001',
  'bakery',
  'ACTIVE',
  'GOLD',
  ST_SetSRID(ST_MakePoint(106.7965, -6.2416), 4326),
  'Jl. Senopati No. 78, Kebayoran Baru',
  'Jakarta Selatan',
  '{"mon":"06:00-21:00","tue":"06:00-21:00","wed":"06:00-21:00","thu":"06:00-21:00","fri":"06:00-21:00","sat":"06:00-22:00","sun":"07:00-20:00"}'::jsonb,
  true,
  'MIDTRANS',
  4.7,
  312,
  NOW() - INTERVAL '8 months'
),
-- Farmers Market Grand Indonesia
(
  'm-002-farmers',
  'Farmers Market Grand Indonesia',
  'farmers-grandindonesia',
  'u-002',
  'supermarket',
  'ACTIVE',
  'PLATINUM',
  ST_SetSRID(ST_MakePoint(106.8209, -6.1944), 4326),
  'Grand Indonesia Shopping Town, Lt. LG',
  'Jakarta Pusat',
  '{"mon":"08:00-22:00","tue":"08:00-22:00","wed":"08:00-22:00","thu":"08:00-22:00","fri":"08:00-22:00","sat":"08:00-22:00","sun":"08:00-22:00"}'::jsonb,
  true,
  'XENDIT',
  4.5,
  891,
  NOW() - INTERVAL '14 months'
),
-- Tous Les Jours BSD
(
  'm-003-tlj',
  'Tous Les Jours BSD City',
  'tlj-bsd',
  'u-003',
  'bakery',
  'ACTIVE',
  'SILVER',
  ST_SetSRID(ST_MakePoint(106.6319, -6.3021), 4326),
  'BSD Green Office Park, Ruko Blok M',
  'Tangerang Selatan',
  '{"mon":"07:00-21:00","tue":"07:00-21:00","wed":"07:00-21:00","thu":"07:00-21:00","fri":"07:00-21:00","sat":"07:00-22:00","sun":"08:00-20:00"}'::jsonb,
  true,
  'MIDTRANS',
  4.6,
  178,
  NOW() - INTERVAL '5 months'
),
-- Donburi Ichiban Bandung
(
  'm-004-donburi',
  'Donburi Ichiban Bandung',
  'donburi-bandung',
  'u-004',
  'restaurant',
  'ACTIVE',
  'SILVER',
  ST_SetSRID(ST_MakePoint(107.6107, -6.8915), 4326),
  'Jl. Buah Batu No. 158, Lengkong Besar',
  'Bandung',
  '{"mon":"10:00-22:00","tue":"10:00-22:00","wed":"10:00-22:00","thu":"10:00-22:00","fri":"10:00-22:00","sat":"10:00-23:00","sun":"10:00-21:00"}'::jsonb,
  false,
  NULL,
  4.3,
  95,
  NOW() - INTERVAL '3 months'
),
-- Ratio Fruit & Juice Tangerang
(
  'm-005-ratio',
  'Ratio Fruit & Juice Summarecon',
  'ratio-tangerang',
  'u-005',
  'supermarket',
  'ACTIVE',
  'BRONZE',
  ST_SetSRID(ST_MakePoint(106.6390, -6.2147), 4326),
  'Summarecon Mall Serpong, Lt. UG',
  'Tangerang',
  '{"mon":"09:00-21:30","tue":"09:00-21:30","wed":"09:00-21:30","thu":"09:00-21:30","fri":"09:00-21:30","sat":"09:00-22:00","sun":"09:00-21:00"}'::jsonb,
  true,
  'MIDTRANS',
  4.4,
  64,
  NOW() - INTERVAL '2 months'
);

-- ============================================================
-- 2. PRODUCTS (10 products across merchants)
-- ============================================================
-- Note: expiry_timestamps are set relative to NOW()
INSERT INTO products (
  id, merchant_id, category_id, name, description, sku,
  p_base, p_min, p_current,
  q_init, q_rem, q_reserved,
  unit, status, expiry_timestamp, listed_at
) VALUES
-- Holland Bakery (3 products)
(
  'p-001', 'm-001-holland', 'cat-bakery',
  'Roti Tawar Gandum Premium',
  'Roti tawar gandum segar baru keluar oven',
  'HOL-BRD-001',
  22000, 5500, 15400,
  30, 8, 2,
  'pcs', 'ACTIVE',
  NOW() + INTERVAL '3 hours',
  NOW() - INTERVAL '5 hours'
),
(
  'p-002', 'm-001-holland', 'cat-bakery',
  'Croissant Coklat Praline',
  'Croissant butter isi coklat praline premium',
  'HOL-BRD-002',
  28000, 7000, 18200,
  20, 3, 0,
  'pcs', 'LOW_STOCK',
  NOW() + INTERVAL '1 hour 30 minutes',
  NOW() - INTERVAL '8 hours'
),
(
  'p-003', 'm-001-holland', 'cat-bakery',
  'Donat Kampung Pisang',
  'Donat kampung rasa pisang, topping gula halus',
  'HOL-BRD-003',
  8000, 2000, 5600,
  40, 0, 0,
  'pcs', 'SOLD_OUT',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '10 hours'
),
-- Farmers Market (4 products)
(
  'p-004', 'm-002-farmers', 'cat-produce',
  'Alpukat Mentega Import',
  'Alpukat mentega import 500g, siap makan',
  'FMR-PRD-001',
  45000, 11250, 27000,
  25, 6, 1,
  'pcs', 'ACTIVE',
  NOW() + INTERVAL '6 hours',
  NOW() - INTERVAL '3 hours'
),
(
  'p-005', 'm-002-farmers', 'cat-prepared',
  'Nasi Goreng Spesial Ayam',
  'Nasi goreng ayam suwir + telur mata sapi',
  'FMR-PRD-002',
  35000, 10500, 24500,
  15, 4, 2,
  'porsi', 'ACTIVE',
  NOW() + INTERVAL '4 hours',
  NOW() - INTERVAL '2 hours'
),
(
  'p-006', 'm-002-farmers', 'cat-beverages',
  'Jus Alpukat Kocok',
  'Jus alpukat segar dengan susu kental manis',
  'FMR-BVG-001',
  18000, 5400, 9900,
  20, 2, 0,
  'cup', 'LOW_STOCK',
  NOW() + INTERVAL '2 hours',
  NOW() - INTERVAL '6 hours'
),
(
  'p-007', 'm-002-farmers', 'cat-dairy',
  'Greek Yogurt Plain 500g',
  'Yogurt plain tanpa gula, protein tinggi',
  'FMR-DRY-001',
  52000, 15600, 36400,
  12, 5, 1,
  'pcs', 'ACTIVE',
  NOW() + INTERVAL '8 hours',
  NOW() - INTERVAL '4 hours'
),
-- Tous Les Jours (1 product)
(
  'p-008', 'm-003-tlj', 'cat-bakery',
  'Baguette Original',
  'Baguette roti tawar Prancis segar',
  'TLJ-BRD-001',
  25000, 6250, 17500,
  18, 7, 3,
  'pcs', 'ACTIVE',
  NOW() + INTERVAL '5 hours',
  NOW() - INTERVAL '1 hour'
),
-- Donburi Ichiban (1 product)
(
  'p-009', 'm-004-donburi', 'cat-prepared',
  'Chicken Katsu Don',
  'Nasi donburi chicken katsu dengan saus tonkatsu',
  'DON-BNT-001',
  42000, 12600, 29400,
  10, 3, 1,
  'porsi', 'ACTIVE',
  NOW() + INTERVAL '7 hours',
  NOW() - INTERVAL '2 hours'
),
-- Ratio Fruit & Juice (1 product)
(
  'p-010', 'm-005-ratio', 'cat-produce',
  'Mangga Gedong Gincu 1kg',
  'Mangga gedong gincu segar manis, varietas lokal',
  'RAT-PRD-001',
  38000, 9500, 22800,
  15, 4, 0,
  'kg', 'ACTIVE',
  NOW() + INTERVAL '10 hours',
  NOW() - INTERVAL '1 hour'
);

-- ============================================================
-- 3. GROUP BUYS (3 active "Bungkus Bareng" groups)
-- ============================================================
INSERT INTO group_buys (
  id, product_id, merchant_id, leader_id,
  required_quota, current_quota, max_quota,
  original_price, group_price, discount_percent,
  state, started_at, expires_at
) VALUES
-- Group 1: Roti Gandum, waiting members
(
  'gb-001', 'p-001', 'm-001-holland', 'u-010',
  5, 3, 10,
  22000, 15400, 30,
  'WAITING_MEMBERS',
  NOW() - INTERVAL '12 minutes',
  NOW() + INTERVAL '18 minutes'
),
-- Group 2: Nasi Goreng, almost full
(
  'gb-002', 'p-005', 'm-002-farmers', 'u-020',
  4, 4, 8,
  35000, 24500, 30,
  'LOCKED',
  NOW() - INTERVAL '8 minutes',
  NOW() + INTERVAL '7 minutes'
),
-- Group 3: Chicken Katsu, just started
(
  'gb-003', 'p-009', 'm-004-donburi', 'u-030',
  3, 1, 6,
  42000, 29400, 30,
  'WAITING_MEMBERS',
  NOW() - INTERVAL '3 minutes',
  NOW() + INTERVAL '42 minutes'
);

-- ============================================================
-- 4. ESG IMPACT LOGS (aggregated historical data)
-- ============================================================
-- Note: This would normally be a materialized view or
-- aggregated from individual orders. Here we insert
-- representative monthly snapshots.
CREATE TABLE IF NOT EXISTS esg_impact_logs (
  id SERIAL PRIMARY KEY,
  period DATE NOT NULL,
  total_food_saved_kg NUMERIC(10,2) NOT NULL,
  total_co2e_prevented_kg NUMERIC(10,2) NOT NULL,
  total_user_savings_idr BIGINT NOT NULL,
  total_orders INT NOT NULL,
  total_merchants INT NOT NULL,
  total_users INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO esg_impact_logs
  (period, total_food_saved_kg, total_co2e_prevented_kg, total_user_savings_idr, total_orders, total_merchants, total_users)
VALUES
  ('2026-01-01', 1245.80, 2491.60, 287500000, 4230, 45, 3200),
  ('2026-02-01', 1389.20, 2778.40, 312000000, 4650, 52, 3800),
  ('2026-03-01', 1567.40, 3134.80, 348000000, 5120, 61, 4500),
  ('2026-04-01', 1423.60, 2847.20, 321000000, 4780, 58, 4200),
  ('2026-05-01', 1678.90, 3357.80, 389000000, 5640, 67, 5100),
  ('2026-06-01', 1834.10, 3668.20, 423000000, 6210, 73, 5600),
  ('2026-07-01', 2012.50, 4025.00, 467000000, 6890, 81, 6200),
  ('2026-08-01', 2189.30, 4378.60, 512000000, 7340, 89, 6800),
  ('2026-09-01', 2345.70, 4691.40, 548000000, 7890, 95, 7300);

-- ============================================================
-- 5. USERS (sample consumer + merchant users)
-- ============================================================
INSERT INTO users (
  id, email, phone_number, display_name, role,
  auth_provider, avatar_url,
  created_at
) VALUES
  ('u-010', 'budi@example.com', '+628123456780', 'Budi Santoso', 'CONSUMER', 'GOOGLE', 'https://i.pravatar.cc/150?u=budi', NOW() - INTERVAL '3 months'),
  ('u-020', 'sari@example.com', '+628123456781', 'Sari Dewi', 'CONSUMER', 'GOOGLE', 'https://i.pravatar.cc/150?u=sari', NOW() - INTERVAL '2 months'),
  ('u-030', 'andi@example.com', '+628123456782', 'Andi Pratama', 'CONSUMER', 'EMAIL', 'https://i.pravatar.cc/150?u=andi', NOW() - INTERVAL '1 month'),
  ('u-001', 'admin@holland.co.id', '+628123456783', 'Holland Admin', 'MERCHANT_ADMIN', 'EMAIL', NULL, NOW() - INTERVAL '8 months'),
  ('u-002', 'admin@farmers.id', '+628123456784', 'Farmers Admin', 'MERCHANT_ADMIN', 'EMAIL', NULL, NOW() - INTERVAL '14 months'),
  ('u-003', 'admin@tlj-bsd.co.id', '+628123456785', 'TLJ BSD Admin', 'MERCHANT_ADMIN', 'EMAIL', NULL, NOW() - INTERVAL '5 months'),
  ('u-004', 'admin@donburi-bdg.co.id', '+628123456786', 'Donburi Admin', 'MERCHANT_ADMIN', 'EMAIL', NULL, NOW() - INTERVAL '3 months'),
  ('u-005', 'admin@ratio.id', '+628123456787', 'Ratio Admin', 'MERCHANT_ADMIN', 'EMAIL', NULL, NOW() - INTERVAL '2 months'),
  ('u-040', 'raisa@example.com', '+628123456788', 'Raisa Putri', 'CONSUMER', 'GOOGLE', 'https://i.pravatar.cc/150?u=raisa', NOW() - INTERVAL '5 months'),
  ('u-050', 'chef.daniel@example.com', '+628123456789', 'Chef Daniel', 'MERCHANT_STAFF', 'EMAIL', NULL, NOW() - INTERVAL '4 months');

-- ============================================================
-- 6. GROUP BUY PARTICIPANTS
-- ============================================================
INSERT INTO group_buy_participants (
  group_buy_id, user_id, reserved_qty, payment_status, joined_at
) VALUES
  -- Group 1: 3 of 5
  ('gb-001', 'u-010', 1, 'HELD',   NOW() - INTERVAL '10 minutes'),
  ('gb-001', 'u-020', 1, 'PAID',   NOW() - INTERVAL '8 minutes'),
  ('gb-001', 'u-030', 1, 'PENDING', NOW() - INTERVAL '5 minutes'),
  -- Group 2: 4 of 4 (LOCKED)
  ('gb-002', 'u-010', 1, 'PAID',   NOW() - INTERVAL '7 minutes'),
  ('gb-002', 'u-020', 1, 'PAID',   NOW() - INTERVAL '6 minutes'),
  ('gb-002', 'u-030', 1, 'HELD',   NOW() - INTERVAL '5 minutes'),
  ('gb-002', 'u-040', 1, 'PAID',   NOW() - INTERVAL '4 minutes'),
  -- Group 3: 1 of 3
  ('gb-003', 'u-040', 1, 'PENDING', NOW() - INTERVAL '2 minutes');

-- ============================================================
-- 7. SAMPLE ORDERS
-- ============================================================
INSERT INTO orders (
  id, order_number, user_id, merchant_id, group_buy_id,
  status, subtotal, discount_amount, total_price,
  qr_verification_hash, pickup_deadline, created_at
) VALUES
  ('ord-001', 'BG-20260908-00001', 'u-020', 'm-001-holland', 'gb-001',
   'READY_FOR_PICKUP', 22000, 6600, 15400,
   encode(sha256('ord-001-secret'::bytea), 'hex'),
   NOW() + INTERVAL '4 hours',
   NOW() - INTERVAL '8 minutes'),
  ('ord-002', 'BG-20260908-00002', 'u-010', 'm-002-farmers', 'gb-002',
   'PAID', 35000, 10500, 24500,
   encode(sha256('ord-002-secret'::bytea), 'hex'),
   NOW() + INTERVAL '3 hours',
   NOW() - INTERVAL '7 minutes'),
  ('ord-003', 'BG-20260908-00003', 'u-030', 'm-001-holland', NULL,
   'COMPLETED', 28000, 9800, 18200,
   encode(sha256('ord-003-secret'::bytea), 'hex'),
   NOW() + INTERVAL '2 hours',
   NOW() - INTERVAL '10 hours');

-- ============================================================
-- Done — 10 merchants, 10 products, 3 group buys, 10 users
-- ============================================================
