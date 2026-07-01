import { describe, expect, it } from 'vitest'
import { calculateRollingSummary, getRollingEventTimestamp } from './rollingCounter'
import { makeAttack } from '../test/attackEventFixtures'

describe('rollingCounter', () => {
  it('counts rolling minute, hour, day, and total windows', () => {
    const now = Date.parse('2026-06-15T01:00:00Z')
    const result = calculateRollingSummary(
      [
        { id: '1', timestamp: now - 30_000, receivedAt: now - 30_000 },
        { id: '2', timestamp: now - 30 * 60_000, receivedAt: now - 30 * 60_000 },
        { id: '3', timestamp: now - 2 * 3_600_000, receivedAt: now - 2 * 3_600_000 },
      ],
      now,
    )

    expect(result.total).toBe(3)
    expect(result.lastMinute).toBe(1)
    expect(result.lastHour).toBe(2)
    expect(result.last24Hours).toBe(3)
  })

  it('uses receive time and drops messages after 24 hours', () => {
    const now = Date.parse('2026-06-15T01:00:00Z')
    const result = calculateRollingSummary(
      [
        {
          id: 'stale-event-received-now',
          timestamp: now - 7 * 86_400_000,
          receivedAt: now,
        },
        {
          id: 'expired-message',
          timestamp: now,
          receivedAt: now - 86_400_001,
        },
      ],
      now,
    )

    expect(result.lastMinute).toBe(1)
    expect(result.lastHour).toBe(1)
    expect(result.last24Hours).toBe(1)
    expect(result.total).toBe(1)
  })

  it('falls back to receive time for invalid event timestamps', () => {
    const receivedAt = 123_456
    expect(
      getRollingEventTimestamp(
        makeAttack('1', { event_time: 'invalid', event_time_cn: 'invalid' }),
        receivedAt,
      ),
    ).toBe(receivedAt)
  })
})
