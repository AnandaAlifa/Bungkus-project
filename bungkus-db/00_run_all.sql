-- ============================================================================
-- BUNGKUS! — Master DDL Runner
-- ============================================================================
-- Execute this file to create the entire database schema.
-- Prerequisites:
--   - PostgreSQL 15+
--   - PostGIS extension installed
--   - Run as superuser or DB owner
--
-- Usage:
--   psql -U postgres -d bungkus -f 00_run_all.sql
-- ============================================================================

-- Step 1: Extensions and custom types
\echo '=== Step 1: Creating extensions and custom types ==='
\i 00_extensions.sql

-- Step 2: Users & Merchants
\echo '=== Step 2: Creating users & merchants tables ==='
\i 01_schema_users_merchants.sql

-- Step 3: Products
\echo '=== Step 3: Creating products tables ==='
\i 02_schema_products.sql

-- Step 4: Orders & Group Buys
\echo '=== Step 4: Creating orders & group buys tables ==='
\i 03_schema_orders_groupbuys.sql

-- Step 5: Payments, Notifications, Audit
\echo '=== Step 5: Creating payments, notifications, audit tables ==='
\i 04_schema_payments_notifications_audit.sql

-- Step 6: Business Logic Functions
\echo '=== Step 6: Creating business logic functions ==='
\i 05_functions.sql

-- Step 7: Views
\echo '=== Step 7: Creating views ==='
\i 06_views.sql

-- Step 8: Verify
\echo '=== Step 8: Verifying schema ==='
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

\echo '=== Schema creation complete ==='
