-- ============================================================================
-- BUNGKUS! Group Buy — Atomic State Transition
-- ============================================================================
-- Handles state transitions with validation:
--   WAITING_MEMBERS -> LOCKED (all members confirmed payment)
--   LOCKED -> COMPLETED (all items picked up)
--   Any -> EXPIRED (timeout or failure)
--
-- KEYS:
--   KEYS[1] = group_buy:{group_id}:meta      (Hash)
--   KEYS[2] = group_buy:{group_id}:members    (Set)
--   KEYS[3] = group_buy:{group_id}:slots      (String)
--   KEYS[4] = group_buy:{group_id}:payments   (Hash: user_id -> payment_status)
--
-- ARGV:
--   ARGV[1] = target_state (LOCKED, COMPLETED, EXPIRED, CANCELLED)
--   ARGV[2] = current_timestamp (unix seconds)
--   ARGV[3] = actor_id (who initiated the transition)
--   ARGV[4] = reason (optional)
--
-- RETURNS:
--   {success, old_state, new_state, error_message}
-- ============================================================================

-- Get current state
local current_state = redis.call('HGET', KEYS[1], 'state')
if not current_state then
    return {0, 'NOT_FOUND', ARGV[1], 'Group buy does not exist'}
end

local target_state = ARGV[1]
local current_ts = tonumber(ARGV[2])

-- Define valid transitions
local valid_transitions = {
    CREATED = {LOCKED = 1, EXPIRED = 1, CANCELLED = 1},
    WAITING_MEMBERS = {LOCKED = 1, EXPIRED = 1, CANCELLED = 1},
    LOCKED = {COMPLETED = 1, EXPIRED = 1, CANCELLED = 1},
}

-- Validate transition
if not valid_transitions[current_state] or not valid_transitions[current_state][target_state] then
    return {0, current_state, target_state, 
            'Invalid transition: ' .. current_state .. ' -> ' .. target_state}
end

-- Special validation for LOCKED state
if target_state == 'LOCKED' then
    -- Check all members have paid
    local members = redis.call('SMEMBERS', KEYS[2])
    local payments = redis.call('HGETALL', KEYS[4])
    local payment_table = {}
    for i = 1, #payments, 2 do
        payment_table[payments[i]] = payments[i + 1]
    end
    
    for _, member_id in ipairs(members) do
        if payment_table[member_id] ~= 'PAID' and payment_table[member_id] ~= 'HELD' then
            return {0, current_state, target_state, 
                    'Member ' .. member_id .. ' has not paid'}
        end
    end
end

-- Special validation for COMPLETED state
if target_state == 'COMPLETED' then
    -- Check all items have been picked up
    local pickups = redis.call('HGETALL', KEYS[1] .. ':pickups')
    -- For now, just allow transition (pickup verification is external)
end

-- Execute transition
redis.call('HSET', KEYS[1], 'state', target_state)
redis.call('HSET', KEYS[1], 'updated_at', current_ts)
redis.call('HSET', KEYS[1], 'last_actor', ARGV[3])

-- Store transition in history
local history_key = KEYS[1] .. ':history'
redis.call('LPUSH', history_key, cjson.encode({
    from = current_state,
    to = target_state,
    actor = ARGV[3],
    timestamp = current_ts,
    reason = ARGV[4] or ''
}))

-- Set TTL for expired state (auto-cleanup after 24h)
if target_state == 'EXPIRED' or target_state == 'COMPLETED' or target_state == 'CANCELLED' then
    redis.call('EXPIRE', KEYS[1], 86400)
    redis.call('EXPIRE', KEYS[2], 86400)
    redis.call('EXPIRE', KEYS[3], 86400)
    redis.call('EXPIRE', KEYS[4], 86400)
end

return {1, current_state, target_state, ''}
