import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('../client', () => ({
  apiClient: { get: getMock },
  requestApi: <T>(request: () => Promise<T>) => request(),
}))

import { getLatestAttacks } from './attackEventsApi'
import { getTopCountries, getTopIps } from './attackStatsApi'

const attack = {
  id: 'event-1',
  event_time: '2026-06-23T00:00:00Z',
  event_time_cn: '2026-06-23 08:00:00',
  src_ip: '203.0.113.1',
  src_country: 'South Africa',
  src_country_code: 'ZAF',
  src_city: 'Cape Town',
  src_latitude: -33.9,
  src_longitude: 18.4,
  target_public_ip: '203.0.113.10',
  target_hostname: 'honeypot',
  target_latitude: 40.7,
  target_longitude: -74,
  protocol: 'ssh',
  dest_port: 22,
  honeypot_type: 'cowrie',
  action: 'login',
}

describe('country normalization at API boundaries', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('normalizes REST attack rows used by the refreshed live feed', async () => {
    getMock.mockResolvedValueOnce({ data: [attack] })

    const result = await getLatestAttacks()

    expect(result[0]?.src_country_code).toBe('ZA')
  })

  it('normalizes top-IP and top-country responses from code or country fields', async () => {
    getMock
      .mockResolvedValueOnce({
        data: [{ src_ip: '203.0.113.2', count: 4, country_code: 'deu', country: 'Germany' }],
      })
      .mockResolvedValueOnce({
        data: [{ country_code: 'UNKNOWN', country: 'Russian Federation', count: 3 }],
      })

    const topIps = await getTopIps()
    const topCountries = await getTopCountries()

    expect(topIps[0]?.countryCode).toBe('DE')
    expect(topCountries[0]?.countryCode).toBe('RU')
  })
})
