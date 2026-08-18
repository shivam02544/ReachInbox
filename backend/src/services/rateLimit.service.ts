import { randomUUID } from 'node:crypto';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export type DenialReason = 'HOURLY_EXCEEDED' | 'MIN_DELAY_THROTTLED';

export interface ReservationResult {
  allowed: boolean;
  rescheduleDelayMs: number;
  reason?: DenialReason;
  reservationToken?: string;
  hourWindow?: string;
}

const RESERVE_SLOT_LUA = `
local lastSlotData = redis.call('GET', KEYS[1])
local lastSlot = 0
if lastSlotData then
    local colonIdx = string.find(lastSlotData, ":")
    if colonIdx then
        lastSlot = tonumber(string.sub(lastSlotData, colonIdx + 1)) or 0
    end
end

local hourlyCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local nowMs = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local maxHourlyLimit = tonumber(ARGV[3])
local nextHourWindowMs = tonumber(ARGV[4])
local token = ARGV[5]
local hourWindow = ARGV[6]

-- 1. Check Hourly Quota Constraint
if hourlyCount >= maxHourlyLimit then
    local waitMs = nextHourWindowMs - nowMs
    if waitMs < 1000 then waitMs = 1000 end
    return {0, waitMs, 1, ""}
end

-- 2. Check Minimum Inter-Send Delay Constraint
local elapsedMs = nowMs - lastSlot
if lastSlot > 0 and elapsedMs < minDelayMs then
    local waitMs = minDelayMs - elapsedMs
    return {0, waitMs, 2, ""}
end

-- 3. Both Constraints Passed: Atomically Reserve Slot with Authoritative Token Identifier
local slotValue = token .. ":" .. tostring(nowMs)
redis.call('SET', KEYS[1], slotValue, 'PX', math.max(minDelayMs * 2, 10000))
local newCount = redis.call('INCR', KEYS[2])
if newCount == 1 then
    redis.call('EXPIRE', KEYS[2], 7200)
end

-- Store token ownership marker with hourWindow metadata
local markerValue = token .. ":" .. tostring(nowMs) .. ":" .. hourWindow
redis.call('SET', KEYS[3], markerValue, 'EX', 60)

return {1, 0, 0, token}
`;

const RELEASE_SLOT_LUA = `
local token = ARGV[1]
local expectedHourWindow = ARGV[2]
local markerData = redis.call('GET', KEYS[3])

if not markerData then
    return 0
end

local firstColon = string.find(markerData, ":")
local lastColon = nil
if firstColon then
    lastColon = string.find(markerData, ":", firstColon + 1)
end

if not firstColon or not lastColon then
    return 0
end

local storedToken = string.sub(markerData, 1, firstColon - 1)
local storedHourWindow = string.sub(markerData, lastColon + 1)

if storedToken ~= token or storedHourWindow ~= expectedHourWindow then
    return 0
end

redis.call('DEL', KEYS[3])

local currentCount = tonumber(redis.call('GET', KEYS[2]) or '0')
if currentCount > 0 then
    redis.call('DECR', KEYS[2])
end

local lastSlotData = redis.call('GET', KEYS[1])
if lastSlotData then
    local colonIdx = string.find(lastSlotData, ":")
    if colonIdx then
        local currentToken = string.sub(lastSlotData, 1, colonIdx - 1)
        if currentToken == token then
            redis.call('DEL', KEYS[1])
        end
    end
end

return 1
`;

export function getUtcHourWindow(dateMs: number = Date.now()): string {
  const d = new Date(dateMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}`;
}

export function getNextUtcHourMs(dateMs: number = Date.now()): number {
  const d = new Date(dateMs);
  d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0);
  return d.getTime();
}

export class RateLimitService {
  /**
   * Atomically evaluates and reserves a send slot for a sender in Redis.
   */
  async reserveSendSlot(
    senderId: string,
    overrideMinDelayMs?: number,
    overrideMaxHourlyLimit?: number
  ): Promise<ReservationResult> {
    const nowMs = Date.now();
    const minDelayMs = overrideMinDelayMs ?? config.minEmailDelayMs;
    const maxHourlyLimit = overrideMaxHourlyLimit ?? config.maxEmailsPerHourPerSender;
    const hourWindow = getUtcHourWindow(nowMs);
    const nextHourWindowMs = getNextUtcHourMs(nowMs);
    const reservationToken = randomUUID();

    const lastSlotKey = `ratelimit:sender:${senderId}:last_slot`;
    const hourKey = `ratelimit:sender:${senderId}:hour:${hourWindow}`;
    const markerKey = `ratelimit:sender:${senderId}:reservation:${reservationToken}`;

    const res = (await redis.eval(
      RESERVE_SLOT_LUA,
      3,
      lastSlotKey,
      hourKey,
      markerKey,
      nowMs.toString(),
      minDelayMs.toString(),
      maxHourlyLimit.toString(),
      nextHourWindowMs.toString(),
      reservationToken,
      hourWindow
    )) as [number, number, number, string];

    const [allowedNum, waitMs, reasonCode, token] = res;

    if (allowedNum === 1) {
      logger.info('RateLimit', `[Slot Reserved] Sender ${senderId} slot reserved (Token: ${token}, Hour: ${hourWindow})`);
      return {
        allowed: true,
        rescheduleDelayMs: 0,
        reservationToken: token,
        hourWindow,
      };
    }

    const reason: DenialReason = reasonCode === 1 ? 'HOURLY_EXCEEDED' : 'MIN_DELAY_THROTTLED';
    logger.info('RateLimit', `[Slot Denied] Sender ${senderId} reservation denied (${reason}). Wait: ${waitMs}ms`);

    return {
      allowed: false,
      rescheduleDelayMs: waitMs,
      reason,
    };
  }

  /**
   * Atomically releases a reservation slot if PostgreSQL atomic DB claim fails.
   */
  async releaseReservationSlot(
    senderId: string,
    reservationToken: string,
    hourWindow: string
  ): Promise<boolean> {
    const lastSlotKey = `ratelimit:sender:${senderId}:last_slot`;
    const hourKey = `ratelimit:sender:${senderId}:hour:${hourWindow}`;
    const markerKey = `ratelimit:sender:${senderId}:reservation:${reservationToken}`;

    const res = (await redis.eval(
      RELEASE_SLOT_LUA,
      3,
      lastSlotKey,
      hourKey,
      markerKey,
      reservationToken,
      hourWindow
    )) as number;

    const released = res === 1;
    if (released) {
      logger.info('RateLimit', `[Slot Released] Reservation ${reservationToken} for Sender ${senderId} successfully rolled back.`);
    } else {
      logger.info('RateLimit', `[Slot Release Skipped] Token ${reservationToken} for Sender ${senderId} not released (already superseded or invalid).`);
    }
    return released;
  }
}

export const rateLimitService = new RateLimitService();
