import type { AttackEvent, AttackSummary } from '../types/attack'

export interface RollingSummaryEvent {
  id: string
  timestamp: number
  receivedAt: number
  count?: number
}

const ONE_MINUTE_MS = 60_000
const ONE_HOUR_MS = 3_600_000
export const ROLLING_SUMMARY_WINDOW_MS = 86_400_000

function parseTimestamp(value?: string): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return Date.parse(normalized)
}

export function getRollingEventTimestamp(
  event: AttackEvent,
  receivedAt = Date.now(),
): number {
  const candidates = [
    event.event_time,
    event.event_time_cn,
    (event as AttackEvent & { created_at?: string }).created_at,
  ]

  for (const candidate of candidates) {
    const timestamp = parseTimestamp(candidate)
    if (Number.isFinite(timestamp)) return timestamp
  }
  return receivedAt
}

export function calculateRollingSummary(
  events: Iterable<RollingSummaryEvent>,
  now = Date.now(),
): AttackSummary {
  let total = 0
  let lastMinute = 0
  let lastHour = 0
  let last24Hours = 0
  let newestTimestamp = 0

  for (const event of events) {
    const age = now - event.receivedAt
    if (age < 0 || age > ROLLING_SUMMARY_WINDOW_MS) continue
    const count = Math.max(1, Math.floor(event.count ?? 1))

    total += count
    newestTimestamp = Math.max(newestTimestamp, event.timestamp)
    last24Hours += count
    if (age <= ONE_HOUR_MS) lastHour += count
    if (age <= ONE_MINUTE_MS) lastMinute += count
  }

  return {
    total,
    lastMinute,
    lastHour,
    last24Hours,
    uniqueSourceIps: 0,
    uniqueCountries: 0,
    topProtocol: null,
    lastAttackTime:
      newestTimestamp > 0
        ? new Date(newestTimestamp).toISOString()
        : null,
    latestEventTime:
      newestTimestamp > 0
        ? new Date(newestTimestamp).toISOString()
        : null,
    latestDataAgeSeconds:
      newestTimestamp > 0
        ? Math.max(0, Math.floor((now - newestTimestamp) / 1000))
        : null,
    hasRecent24hData: last24Hours > 0,
  }
}
