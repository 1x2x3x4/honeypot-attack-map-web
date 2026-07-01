import type { AttackEvent, AttackSummary, ProtocolType, TopCountryItem, TopIpItem } from '../../types/attack'
import { normalizeCountryCode } from '../../utils/countryCode'
import { parseAttackTime } from '../../utils/parseTime'
import { normalizeProtocol } from '../../utils/attackProtocol'
import { apiClient, requestApi } from '../client'

type ItemsPayload<T> =
  | T[]
  | {
      items?: T[]
      data?: T[]
      records?: T[]
      attacks?: T[]
    }

function unwrapItems<T>(payload: ItemsPayload<T>): T[] {
  if (Array.isArray(payload)) return payload
  return payload.items ?? payload.data ?? payload.records ?? payload.attacks ?? []
}

function toProtocol(value: unknown): ProtocolType {
  return normalizeProtocol(value)
}

export function calculateSummary(attacks: AttackEvent[]): AttackSummary {
  const now = Date.now()
  const protocolCounts = new Map<ProtocolType, number>()
  for (const attack of attacks) {
    protocolCounts.set(attack.protocol, (protocolCounts.get(attack.protocol) ?? 0) + 1)
  }
  const getEventTime = (attack: AttackEvent) => attack.event_time || attack.event_time_cn
  const latestAttack = attacks
    .slice()
    .sort((a, b) => parseAttackTime(getEventTime(b)) - parseAttackTime(getEventTime(a)))[0]
  const latestTimestamp = latestAttack ? parseAttackTime(getEventTime(latestAttack)) : 0

  return {
    total: attacks.length,
    lastMinute: attacks.filter((attack) => now - parseAttackTime(getEventTime(attack)) <= 60_000).length,
    lastHour: attacks.filter((attack) => now - parseAttackTime(getEventTime(attack)) <= 3_600_000).length,
    last24Hours: attacks.filter((attack) => now - parseAttackTime(getEventTime(attack)) <= 86_400_000).length,
    uniqueSourceIps: new Set(attacks.map((attack) => attack.src_ip)).size,
    uniqueCountries: new Set(attacks.map((attack) => attack.src_country_code)).size,
    topProtocol: [...protocolCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    lastAttackTime: latestAttack?.event_time ?? null,
    latestEventTime: latestAttack?.event_time ?? null,
    latestDataAgeSeconds:
      latestTimestamp > 0
        ? Math.max(0, Math.floor((now - latestTimestamp) / 1000))
        : null,
    hasRecent24hData: attacks.some((attack) => now - parseAttackTime(getEventTime(attack)) <= 86_400_000),
  }
}

export function calculateTopIps(attacks: AttackEvent[], limit = 10): TopIpItem[] {
  const groups = new Map<string, TopIpItem>()

  for (const attack of attacks) {
    const existing = groups.get(attack.src_ip)
    if (existing) {
      existing.hits += 1
      if (parseAttackTime(attack.event_time || attack.event_time_cn) > parseAttackTime(existing.lastSeen)) {
        existing.lastProtocol = attack.protocol
        existing.lastSeen = attack.event_time
      }
      continue
    }

    groups.set(attack.src_ip, {
      ip: attack.src_ip,
      hits: 1,
      country: attack.src_country,
      countryCode: normalizeCountryCode(attack.src_country_code, attack.src_country),
      reputation: attack.ip_reputation ?? 'unknown',
      lastProtocol: attack.protocol,
      lastSeen: attack.event_time,
    })
  }

  return [...groups.values()].sort((a, b) => b.hits - a.hits).slice(0, limit)
}

export function calculateTopCountries(attacks: AttackEvent[], limit = 10): TopCountryItem[] {
  const groups = new Map<
    string,
    { item: TopCountryItem; ips: Set<string>; protocols: Map<ProtocolType, number> }
  >()

  for (const attack of attacks) {
    const countryCode = normalizeCountryCode(attack.src_country_code, attack.src_country)
    const existing = groups.get(countryCode)
    if (existing) {
      existing.item.hits += 1
      existing.ips.add(attack.src_ip)
      existing.item.uniqueIps = existing.ips.size
      existing.protocols.set(attack.protocol, (existing.protocols.get(attack.protocol) ?? 0) + 1)
      existing.item.topProtocol =
        [...existing.protocols].sort((a, b) => b[1] - a[1])[0]?.[0] ?? attack.protocol
      if (parseAttackTime(attack.event_time || attack.event_time_cn) > parseAttackTime(existing.item.lastSeen)) {
        existing.item.lastSeen = attack.event_time
        existing.item.lastSeenIp = attack.src_ip
      }
      continue
    }

    groups.set(countryCode, {
      item: {
        country: attack.src_country,
        countryCode,
        hits: 1,
        uniqueIps: 1,
        topProtocol: attack.protocol,
        lastSeenIp: attack.src_ip,
        lastSeen: attack.event_time,
      },
      ips: new Set([attack.src_ip]),
      protocols: new Map([[attack.protocol, 1]]),
    })
  }

  return [...groups.values()]
    .map(({ item }) => item)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
}

function normalizeSummary(data: Record<string, unknown>): AttackSummary {
  const latestDataAge = data.latestDataAgeSeconds ?? data.latest_data_age_seconds
  return {
    total: Number(data.total ?? data.total_attacks ?? 0),
    lastMinute: Number(data.lastMinute ?? data.last_minute ?? data.last_1m ?? 0),
    lastHour: Number(data.lastHour ?? data.last_hour ?? data.last_1h ?? 0),
    last24Hours: Number(data.last24Hours ?? data.last_24_hours ?? data.last_24h ?? 0),
    uniqueSourceIps: Number(data.uniqueSourceIps ?? data.unique_source_ips ?? data.unique_ips ?? 0),
    uniqueCountries: Number(data.uniqueCountries ?? data.unique_countries ?? 0),
    topProtocol: data.topProtocol || data.top_protocol
      ? toProtocol(data.topProtocol ?? data.top_protocol)
      : null,
    lastAttackTime: String(data.lastAttackTime ?? data.last_attack_time ?? data.last_seen ?? '') || null,
    latestEventTime:
      String(data.latestEventTime ?? data.latest_event_time ?? data.lastAttackTime ?? data.last_attack_time ?? '') ||
      null,
    latestDataAgeSeconds: latestDataAge === undefined || latestDataAge === null ? null : Number(latestDataAge),
    hasRecent24hData: Boolean(data.hasRecent24hData ?? data.has_recent_24h_data ?? Number(data.last_24h ?? 0) > 0),
  }
}

function normalizeTopIps(payload: ItemsPayload<Record<string, unknown>>): TopIpItem[] {
  const data = unwrapItems(payload)
  return data.map((item) => ({
    ip: String(item.ip ?? item.src_ip ?? ''),
    hits: Number(item.hits ?? item.count ?? 0),
    country: String(item.country ?? item.src_country ?? ''),
    countryCode: normalizeCountryCode(
      String(item.countryCode ?? item.country_code ?? item.src_country_code ?? ''),
      String(item.country ?? item.src_country ?? ''),
    ),
    reputation: String(item.reputation ?? item.ip_reputation ?? 'unknown'),
    lastProtocol: toProtocol(item.lastProtocol ?? item.last_protocol ?? item.protocol ?? item.top_protocol),
    lastSeen: String(item.lastSeen ?? item.last_seen ?? ''),
  }))
}

function normalizeTopCountries(payload: ItemsPayload<Record<string, unknown>>): TopCountryItem[] {
  const data = unwrapItems(payload)
  return data.map((item) => ({
    country: String(item.country ?? item.src_country ?? ''),
    countryCode: normalizeCountryCode(
      String(item.countryCode ?? item.country_code ?? item.src_country_code ?? ''),
      String(item.country ?? item.src_country ?? ''),
    ),
    hits: Number(item.hits ?? item.count ?? 0),
    uniqueIps: Number(item.uniqueIps ?? item.unique_ips ?? 0),
    topProtocol: toProtocol(item.topProtocol ?? item.top_protocol ?? item.protocol),
    lastSeenIp: String(item.lastSeenIp ?? item.last_seen_ip ?? ''),
    lastSeen: String(item.lastSeen ?? item.last_seen ?? item.last_attack_time ?? ''),
  }))
}

export function getSummary(): Promise<AttackSummary> {
  return requestApi(
    async () => {
      const response = await apiClient.get<Record<string, unknown>>('/api/stats/summary')
      return normalizeSummary(response.data)
    },
    'Summary request',
    'stats:summary',
  )
}

export function getTopIps(range = '24h', limit = 10): Promise<TopIpItem[]> {
  return requestApi(
    async () => {
      const response = await apiClient.get<ItemsPayload<Record<string, unknown>>>('/api/stats/top-ips', {
        params: { range, limit },
      })
      return normalizeTopIps(response.data)
    },
    'Top IPs request',
    `stats:top-ips:range=${range}:limit=${limit}`,
  )
}

export function getTopCountries(range = '24h', limit = 10): Promise<TopCountryItem[]> {
  return requestApi(
    async () => {
      const response = await apiClient.get<ItemsPayload<Record<string, unknown>>>('/api/stats/top-countries', {
        params: { range, limit },
      })
      return normalizeTopCountries(response.data)
    },
    'Top countries request',
    `stats:top-countries:range=${range}:limit=${limit}`,
  )
}
