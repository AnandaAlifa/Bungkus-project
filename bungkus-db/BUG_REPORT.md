# ============================================================================
# BUNGKUS! — Database Audit Report
# ============================================================================
# Total Issues Found: 23 (8 CRITICAL, 10 HIGH, 5 MEDIUM)
# Generated: 2026-09-07
# ============================================================================


## CRITICAL ISSUES (8) — Must Fix Before Production

### C1. UNIQUE Constraint Conflicts with Soft-Delete (users.email, users.phone)
**File:** 01_schema_users_merchants.sql, lines 61-62
**Problem:** Column-level `UNIQUE NOT NULL` creates a standard unique index that INCLUDES
deleted rows. When a user is soft-deleted and a new user signs up with the same email,
INSERT fails with unique violation.
**Impact:** New users cannot register after account deletion. UU PDP violation.
**Fix:** Replace column-level UNIQUE with partial unique index:
```sql
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_phone ON users (phone_number) WHERE deleted_at IS NULL AND phone_number IS NOT NULL;
```

### C2. Product Categories Seed Data Fails on Re-run
**File:** 02_schema_products.sql, lines 23-33
**Problem:** `INSERT INTO product_categories` without `ON CONFLICT DO NOTHING`.
Running the script a second time fails with duplicate key error on `name` or `slug`.
**Impact:** Schema migration breaks on re-run. CI/CD pipeline failures.
**Fix:** Add `ON CONFLICT (slug) DO NOTHING;`

### C3. discount_pct Should Be Generated Column (Products)
**File:** 02_schema_products.sql, line 57
**Problem:** `discount_pct` is manually stored but described as "computed". Can become
stale when `p_current` is updated by the pricing engine.
**Impact:** Inconsistent discount display. Consumers see wrong discount %.
**Fix:** Change to `GENERATED ALWAYS AS (CASE WHEN p_base > 0 THEN ROUND(((p_base - p_current) / p_base * 100)::numeric, 2) ELSE 0 END) STORED`

### C4. discount_pct Should Be Generated Column (Group Buys)
**File:** 03_schema_orders_groupbuys.sql, line 31
**Problem:** Same as C3 but for group_buys table.
**Impact:** Group buy discount percentage can be wrong.
**Fix:** Change to `GENERATED ALWAYS AS (CASE WHEN original_price > 0 THEN ROUND(((original_price - group_price) / original_price * 100)::numeric, 2) ELSE 0 END) STORED`

### C5. fn_reserve_inventory Missing Input Validation
**File:** 05_functions.sql, line 113
**Problem:** No CHECK that `p_quantity > 0`. Negative quantity would INCREASE q_rem
and DECREASE q_reserved, effectively creating free inventory from thin air.
**Impact:** Critical inventory integrity bug. Financial loss.
**Fix:** Add validation at start of function:
```sql
IF p_quantity <= 0 THEN
    RETURN false;
END IF;
```

### C6. fn_release_inventory Missing Input Validation + Status Restoration
**File:** 05_functions.sql, line 158
**Problem:** (1) No CHECK that `p_quantity > 0`. (2) When releasing from SOLD_OUT,
only sets to ACTIVE, doesn't check if it should be LOW_STOCK.
**Impact:** Negative quantity creates phantom inventory. Wrong status after release.
**Fix:** Add validation + proper status restoration.

### C7. fn_expire_group_buys Doesn't Release Inventory
**File:** 05_functions.sql, line 46
**Problem:** When a group buy expires, reserved inventory (q_reserved) for that group
buy is NOT released back to q_rem. Products remain "reserved" forever.
**Impact:** Permanent phantom inventory reduction. Products can't be sold.
**Fix:** Add inventory release logic inside the function.

### C8. Review Soft-Delete Doesn't Trigger Merchant Rating Recalculation
**File:** 05_functions.sql, line 273 + 04 line 136
**Problem:** `trg_reviews_update_merchant_rating` fires ONLY when `NEW.is_visible = true`.
When a review is hidden (`is_visible = false`), the trigger does NOT fire, so the
merchant's avg_rating becomes stale.
**Impact:** Merchant rating permanently inflated after review moderation.
**Fix:** Fire trigger on both INSERT/UPDATE, recalculate including visibility filter.


## HIGH ISSUES (10) — Should Fix Before Production

### H1. fn_auto_delist_products Doesn't Release Reserved Inventory
**File:** 05_functions.sql, line 14
**Problem:** When products expire, `q_reserved` is not released. Carts holding
reserved items for expired products can never complete checkout.
**Impact:** Dead carts, bad UX, phantom inventory.

### H2. fn_generate_order_number Sequence Never Resets Daily
**File:** 05_functions.sql, line 81
**Problem:** Comment says "daily reset" but `order_number_seq` is monotonically
increasing. Not a bug for uniqueness, but misleading documentation.
**Impact:** Confusion for operations team. Order numbers grow indefinitely.

### H3. orders.total_price Missing CHECK Constraint
**File:** 03_schema_orders_groupbuys.sql, line 132
**Problem:** No CHECK that `total_price = subtotal - discount_amount`.
**Impact:** Pricing inconsistency between fields.

### H4. payments.refunded_amount Missing CHECK Constraint
**File:** 04_schema_payments_notifications_audit.sql, line 37
**Problem:** No CHECK that `refunded_amount >= 0 AND refunded_amount <= amount`.
**Impact:** Refund amount could exceed payment amount.

### H5. order_items.line_total Precision Issue
**File:** 03_schema_orders_groupbuys.sql, line 218
**Problem:** CHECK constraint `line_total = quantity * unit_price` uses exact
decimal equality. DECIMAL(10,2) * INTEGER can have precision edge cases.
**Impact:** Rare CHECK constraint failures for specific price/quantity combos.

### H6. notifications Table Missing updated_at + Trigger
**File:** 04_schema_payments_notifications_audit.sql, line 63
**Problem:** `notifications` table has no `updated_at` column and no trigger.
When notification is marked as read, there's no timestamp of the update.
**Impact:** No audit trail for notification reads.

### H7. v_nearby_products Doesn't Filter by Merchant Status
**File:** 06_views.sql, line 15
**Problem:** View joins merchants but doesn't filter `m.status = 'ACTIVE'`.
Suspended/deactivated merchants' products still appear in discovery.
**Impact:** Consumers see products from suspended merchants.

### H8. v_merchant_analytics Doesn't Filter Soft-Deleted Records
**File:** 06_views.sql, line 132
**Problem:** LEFT JOINs don't filter by `deleted_at IS NULL` on products,
orders, or group_buys. Soft-deleted records counted in analytics.
**Impact:** Inflated analytics numbers.

### H9. fn_confirm_pickup Overwrites picked_up_at on Re-call
**File:** 05_functions.sql, line 183
**Problem:** If function is called twice (bug or race condition), `picked_up_at`
is overwritten with new timestamp.
**Impact:** Audit trail corruption.

### H10. group_buy_participants.payment_id Missing FK
**File:** 03_schema_orders_groupbuys.sql, line 93
**Problem:** `payment_id UUID` has no FOREIGN KEY constraint to orders table.
**Impact:** Orphaned references possible.


## MEDIUM ISSUES (5) — Fix for Code Quality

### M1. fn_anonymize_user Doesn't Handle Active Orders
**File:** 05_functions.sql, line 284
**Problem:** No check for pending/active orders before anonymizing user.
**Impact:** Broken order flow for pending orders.

### M2. products.q_init Missing CHECK > 0
**File:** 02_schema_products.sql, line 60
**Problem:** `q_init` allows 0, which means a product can be listed with no stock.
**Impact:** Empty listings appear in discovery.

### M3. product_price_history Is a Table, Not a View
**File:** 06_views.sql, line 188
**Problem:** File is named "views" but contains a TABLE definition.
**Impact:** Organizational confusion.

### M4. reviews Table Missing Index on order_id
**File:** 04_schema_payments_notifications_audit.sql, line 99
**Problem:** No index on `order_id` for the reviews table.
**Impact:** Slow lookups when checking if an order already has a review.

### M5. merchant_staff.role Should Use ENUM
**File:** 04_schema_payments_notifications_audit.sql, line 215
**Problem:** `role VARCHAR(50)` is free-text. Should be an ENUM for consistency.
**Impact:** Data quality issues from inconsistent role values.


## SEVERITY SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 8     | MUST FIX |
| HIGH     | 10    | SHOULD FIX |
| MEDIUM   | 5     | NICE TO FIX |
| **TOTAL** | **23** | |
