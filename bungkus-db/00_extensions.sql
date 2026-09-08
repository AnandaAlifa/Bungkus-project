-- ============================================================================
-- BUNGKUS! DATABASE ARCHITECTURE
-- Version: 1.0.0
-- PostgreSQL 15+ | PostGIS 3.4+ | Production-Grade DDL
-- ============================================================================
-- Run this file FIRST. All subsequent scripts depend on these extensions.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "postgis";           -- Spatial queries & geometry
CREATE EXTENSION IF NOT EXISTS "pgcrypto";          -- Gen_random_uuid(), encryption
CREATE EXTENSION IF NOT EXISTS "pg_trgm";           -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";        -- Exclusion constraints on GiST

-- ============================================================================
-- CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE merchant_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);

CREATE TYPE merchant_tier AS ENUM (
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM'
);

CREATE TYPE product_status AS ENUM (
    'ACTIVE',
    'LOW_STOCK',
    'SOLD_OUT',
    'EXPIRED',
    'DELISTED',
    'SUSPENDED'
);

CREATE TYPE order_status AS ENUM (
    'PENDING_PAYMENT',
    'PAID',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'COMPLETED',
    'CANCELLED',
    'REFUND_PENDING',
    'REFUNDED',
    'EXPIRED'
);

CREATE TYPE group_buy_status AS ENUM (
    'OPEN',
    'QUOTA_MET',
    'LOCKED',
    'PAYMENT_IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'EXPIRED',
    'CANCELLED'
);

CREATE TYPE payment_method AS ENUM (
    'QRIS',
    'VIRTUAL_ACCOUNT',
    'CREDIT_CARD',
    'E_WALLET',
    'CASH_ON_PICKUP'
);

CREATE TYPE payment_provider AS ENUM (
    'MIDTRANS',
    'XENDIT',
    'DOKU',
    'MANUAL'
);

CREATE TYPE notification_type AS ENUM (
    'ITEM_NEARBY',
    'GROUP_BUY_INVITE',
    'GROUP_BUY_URGENT',
    'GROUP_BUY_SUCCESS',
    'GROUP_BUY_FAILED',
    'ORDER_READY',
    'ORDER_COMPLETED',
    'PRICE_DROP',
    'MERCHANT_PROMO',
    'SYSTEM'
);

CREATE TYPE user_role AS ENUM (
    'CONSUMER',
    'MERCHANT_ADMIN',
    'MERCHANT_STAFF',
    'SUPER_ADMIN'
);
