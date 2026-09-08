-- ============================================================================
-- BUNGKUS! Group Buy — Atomic Slot Release
-- ============================================================================
-- Releases a slot when a member leaves or payment fails.
-- Handles:
--   1. Validate member exists
--   2. DECR quota, REM member
--   3. Check if state should revert to WAITING_MEMBERS
--
-- KEYS:
--   KEYS[1] = group_buy:{group_id}:meta      (Hash)
--   KEYS[2] = group_buy:{group_id}:members    (Set)
--   KEYS[3] = group_buy:{group_id}:slots      (String)
--
-- ARGV:
--   ARGV[1] = user_id
--   ARGV[2] = reserved_qty (default 1)
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

-- Validate state allows leaving
local valid_states = {CREATED = 1, WAITING_MEMBERS = 1, LOCKED = 1}
if not valid_states[meta_table['state']] then
    return {0, meta_table['state'], 0, 0, 'Cannot leave in current state'}
end

-- Check if user is a member
local is_member = redis.call('SISMEMBER', KEYS[2], ARGV[1])
if is_member == 0 then
    return {0, meta_table['state'], 0, 0, 'User is not a member'}
end

-- Atomic release: DECR quota + REM member
local reserved_qty = tonumber(ARGV[2] or '1')
local new_quota = redis.call('DECRBY', KEYS[3], reserved_qty)
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('HDEL', KEYS[2] .. ':timestamps', ARGV[1])

-- Ensure quota doesn't go below 0
if new_quota < 0 then
    redis.call('SET', KEYS[3], 0)
    new_quota = 0
end

-- Check if quota is no longer met (revert state)
local required_quota = tonumber(meta_table['required_quota'] or '0')
local new_state = meta_table['state']

if new_state == 'WAITING_MEMBERS' and new_quota < required_quota then
    -- Quota no longer met, revert to CREATED
    new_state = 'CREATED'
    redis.call('HSET', KEYS[1], 'state', new_state)
    redis.call('HDEL', KEYS[1], 'quota_met_at')
end

return {1, new_state, new_quota, required_quota, ''}
