import { describe, expect, it } from 'vitest'
import {
  ATTACK_LINE_DURATION_MS,
  ATTACK_PATH_REPEAT_WINDOW_MS,
  createAttackPathThrottle,
  hasVisibleAttackPath,
} from './attackAnimation'
import { makeAttack } from '../test/attackEventFixtures'

describe('attack animation policy', () => {
  it('keeps line lifetime at about 2700ms', () => {
    expect(ATTACK_LINE_DURATION_MS).toBe(2700)
  })

  it('deduplicates the same path for ten seconds', () => {
    const throttle = createAttackPathThrottle()

    expect(throttle.shouldAllow('path', 1_000)).toBe(true)
    expect(throttle.shouldAllow('path', 1_000 + ATTACK_PATH_REPEAT_WINDOW_MS - 1)).toBe(false)
    expect(throttle.shouldAllow('path', 1_000 + ATTACK_PATH_REPEAT_WINDOW_MS)).toBe(true)
  })

  it('matches visible aggregate paths even when event ids differ', () => {
    const liveAttack = makeAttack('live-event')
    const aggregateAttack = makeAttack('aggregate-event', {
      aggregate_key: '198.51.100.1|203.0.113.2|ssh',
    })

    expect(hasVisibleAttackPath(liveAttack, [aggregateAttack])).toBe(true)
  })
})
