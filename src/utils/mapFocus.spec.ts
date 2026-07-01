import { describe, expect, it } from 'vitest'
import { makeAttack } from '../test/attackEventFixtures'
import {
  ATTACK_SOURCE_FOCUS_ZOOM,
  getAttackSourceFocusTarget,
  isValidMapCoordinate,
} from './mapFocus'

describe('map focus helpers', () => {
  it('centers selected attacks on the source coordinate', () => {
    const focusTarget = getAttackSourceFocusTarget(
      makeAttack('event-1', {
        src_latitude: 35.6762,
        src_longitude: 139.6503,
      }),
      2,
    )

    expect(focusTarget).toEqual({
      center: [35.6762, 139.6503],
      zoom: ATTACK_SOURCE_FOCUS_ZOOM,
    })
  })

  it('preserves a closer current zoom when focusing a source', () => {
    const focusTarget = getAttackSourceFocusTarget(makeAttack('event-1'), 7)

    expect(focusTarget?.zoom).toBe(7)
  })

  it('ignores invalid coordinates', () => {
    expect(isValidMapCoordinate(91, 0)).toBe(false)
    expect(isValidMapCoordinate(0, -181)).toBe(false)
    expect(getAttackSourceFocusTarget(makeAttack('event-1', { src_latitude: Number.NaN }), 2)).toBeNull()
  })
})
