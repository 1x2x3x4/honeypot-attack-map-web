import type { AttackEvent } from '../types/attack'

export const ATTACK_SOURCE_FOCUS_ZOOM = 5

export interface AttackSourceFocusTarget {
  center: [number, number]
  zoom: number
}

export function isValidMapCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

export function getAttackSourceFocusTarget(
  attack: AttackEvent,
  currentZoom: number,
): AttackSourceFocusTarget | null {
  if (!isValidMapCoordinate(attack.src_latitude, attack.src_longitude)) return null

  return {
    center: [attack.src_latitude, attack.src_longitude],
    zoom: Math.max(currentZoom, ATTACK_SOURCE_FOCUS_ZOOM),
  }
}
