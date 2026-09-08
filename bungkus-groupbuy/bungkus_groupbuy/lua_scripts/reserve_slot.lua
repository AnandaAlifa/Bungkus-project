-- ============================================================================
-- BUNGKUS! Group Buy — Atomic Slot Reservation
-- ============================================================================
-- This Lua script executes atomically in Redis single-threaded environment.
-- It handles:
--   1. Check if group buy exists and is in valid state
--   2. Check if user is already a member (prevent duplicates)
--   3. Check if quota is available
--   4. Reserve slot (INCR quota, ADD member)
--   5. Check if quota is now met
--   6. Return result with new state
--
-- KEYS:
--   KEYS[1] = group_buy:{group_id}:meta      (Hash: state, required_quota, max_quota, expires_at)
--   KEYS[2] = group_buy:{group_id}:members    (Set: user_ids)
--   KEYS[3] = group_buy:{group_id}:slots      (String: current_slot_count)
--
-- ARGV:
--   ARGV[1] = user_id
--   ARGV[2] = current_timestamp (unix seconds)
--   ARGV[3] = reserved_qty (default 1)
--
-- RETURNS:
--   {success, new_state, current_quota, required_quota, error_message}
-- ============================================================================

-- Get group buy metadata
local meta = redis.call('HGETALL', KEYS[1])
local meta_table = {}
for i = 1, #meta, 2 do
    meta_table[meta[i]] = meta[i + 1]
end

-- Validate group buy exists
if not meta_table['state'] then
    return {0, 'NOT_FOUND', 0, 0, 'Group buy does not exist'}
end

-- Validate state is open for joining
local valid_states = {CREATED = 1, WAITING_MEMBERS = 1}
if not valid_states[meta_table['state']] then
    return {0, meta_table['state'], 0, 0, 'Group buy is not accepting members'}
end

-- Check expiry
local expires_at = tonumber(meta_table['expires_at'] or '0')
local current_ts = tonumber(ARGV[2])
if current_ts >= expires_at then
    -- Auto-expire: update state
    redis.call('HSET', KEYS[1], 'state', 'EXPIRED')
    return {0, 'EXPIRED', 0, 0, 'Group buy has expired'}
end

-- Check if user is already a member
local is_member = redis.call('SISMEMBER', KEYS[2], ARGV[1])
if is_member == 1 then
    local current_quota = tonumber(redis.call('GET', KEYS[3]) or '0')
    local required_quota = tonumber(meta_table['required_quota'] or '0')
    return {0, meta_table['state'], current_quota, required_quota, 'User is already a member'}
end

-- Check max quota
local current_quota = tonumber(redis.call('GET', KEYS[3]) or '0')
local max_quota = tonumber(meta_table['max_quota'] or '999')
local reserved_qty = tonumber(ARGV[3] or '1')

if current_quota + reserved_qty > max_quota then
    return {0, meta_table['state'], current_quota, max_quota, 'Max quota reached'}
end

-- Atomic reservation: INCR quota + ADD member
local new_quota = redis.call('INCRBY', KEYS[3], reserved_qty)
redis.call('SADD', KEYS[2], ARGV[1])

-- Store member join timestamp
redis.call('HSET', KEYS[2] .. ':timestamps', ARGV[1], current_ts)

-- Check if quota is now met
local required_quota = tonumber(meta_table['required_quota'] or '0')
local new_state = meta_table['state']

if new_quota >= required_quota then
    -- Quota met! Transition to WAITING_MEMBERS (ready for payment)
    new_state = 'WAITING_MEMBERS'
    redis.call('HSET', KEYS[1], 'state', new_state)
    redis.call('HSET', KEYS[1], 'quota_met_at', current_ts)
end

return {1, new_state, new_quota, required_quota, ''}
