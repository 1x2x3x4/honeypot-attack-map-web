import type { AttackEvent, AttackSummary } from '../types/attack'

export const emptySummary: AttackSummary = {
  total: 0,
  lastMinute: 0,
  lastHour: 0,
  last24Hours: 0,
  uniqueSourceIps: 0,
  uniqueCountries: 0,
  topProtocol: null,
  lastAttackTime: null,
  latestEventTime: null,
  latestDataAgeSeconds: null,
  hasRecent24hData: false,
}

export function makeAttack(
  id: string,
  overrides: Partial<AttackEvent> = {},
): AttackEvent {
  return {
    id,
    event_time: '2026-06-15T00:00:00Z',
    event_time_cn: '2026-06-15 08:00:00',
    src_ip: `198.51.100.${Number.parseInt(id.replace(/\D/g, ''), 10) % 250 || 1}`,
    src_country: 'Testland',
    src_country_code: 'TL',
    src_city: 'Fixture City',
    src_latitude: 1,
    src_longitude: 2,
    target_public_ip: '203.0.113.2',
    target_hostname: 'honeypot',
    target_latitude: 40,
    target_longitude: -74,
    protocol: 'ssh',
    dest_port: 22,
    honeypot_type: 'cowrie',
    action: 'login',
    ...overrides,
  }
}
