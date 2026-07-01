import type { AttackEvent } from '../types/attack'
import { createAttackPathKey } from './attackProtocol'

export const ATTACK_DRAW_MS = 2100
export const ATTACK_FADE_MS = 600
export const ATTACK_LINE_DURATION_MS = ATTACK_DRAW_MS + ATTACK_FADE_MS
export const ATTACK_PATH_REPEAT_WINDOW_MS = 10_000

export interface AttackPathThrottle {
  shouldAllow: (pathKey: string, now?: number) => boolean
  clear: () => void
}

export function hasVisibleAttackPath(
  attack: AttackEvent,
  visibleAttacks: Iterable<AttackEvent>,
): boolean {
  const pathKey = attack.aggregate_key || createAttackPathKey(attack)
  for (const visibleAttack of visibleAttacks) {
    const visiblePathKey =
      visibleAttack.aggregate_key || createAttackPathKey(visibleAttack)
    if (visiblePathKey === pathKey) return true
  }
  return false
}

export function createAttackPathThrottle(maxEntries = 2000): AttackPathThrottle {
  const recentPathAnimationAt = new Map<string, number>()

  return {
    shouldAllow(pathKey: string, now = Date.now()): boolean {
      const previousAnimationAt = recentPathAnimationAt.get(pathKey)
      if (
        previousAnimationAt !== undefined &&
        now - previousAnimationAt < ATTACK_PATH_REPEAT_WINDOW_MS
      ) {
        return false
      }

      recentPathAnimationAt.set(pathKey, now)
      if (recentPathAnimationAt.size > maxEntries) {
        const expiry = now - ATTACK_PATH_REPEAT_WINDOW_MS
        for (const [key, timestamp] of recentPathAnimationAt) {
          if (timestamp < expiry) recentPathAnimationAt.delete(key)
        }
      }
      return true
    },
    clear(): void {
      recentPathAnimationAt.clear()
    },
  }
}
