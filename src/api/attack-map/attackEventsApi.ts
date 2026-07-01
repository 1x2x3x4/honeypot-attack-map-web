import type { AttackEvent, AttackPathAggregate } from '../../types/attack'
import { normalizeCountryCode } from '../../utils/countryCode'
import { createAttackPathKey, normalizeProtocol } from '../../utils/attackProtocol'
import { apiClient, requestApi } from '../client'

type AttackListPayload =
  | AttackEvent[]
  | {
      items?: AttackEvent[]
      data?: AttackEvent[]
      records?: AttackEvent[]
      attacks?: AttackEvent[]
      window_start?: string | null
      window_end?: string | null
    }

type AttackAggregatePayload =
  | AttackPathAggregate[]
  | {
      items?: AttackPathAggregate[]
      data?: AttackPathAggregate[]
      records?: AttackPathAggregate[]
      window_start?: string | null
      window_end?: string | null
    }

export interface AttackWindowPayload<T> {
  items: T[]
  windowStart: string | null
  windowEnd: string | null
}

function unwrapWindow(payload: AttackListPayload | AttackAggregatePayload): {
  windowStart: string | null
  windowEnd: string | null
} {
  if (Array.isArray(payload)) {
    return { windowStart: null, windowEnd: null }
  }
  return {
    windowStart: payload.window_start ?? null,
    windowEnd: payload.window_end ?? null,
  }
}

function unwrapAttackItems(payload: AttackListPayload): AttackEvent[] {
  const items = Array.isArray(payload)
    ? payload
    : payload.items ?? payload.data ?? payload.records ?? payload.attacks ?? []
  return items.map((item) => ({
    ...item,
    src_country_code: normalizeCountryCode(item.src_country_code, item.src_country),
    protocol: normalizeProtocol(
      item.protocol,
      item.dest_port,
      item.honeypot_type,
      item.http_method,
    ),
  }))
}

function unwrapAggregateItems(payload: AttackAggregatePayload): AttackPathAggregate[] {
  if (Array.isArray(payload)) return payload
  return payload.items ?? payload.data ?? payload.records ?? []
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function aggregateToAttackEvent(item: AttackPathAggregate): AttackEvent {
  const eventTime = item.last_seen || item.first_seen || new Date().toISOString()
  const protocol = normalizeProtocol(item.protocol, item.dest_port)
  return {
    id: item.latest_event_id || item.key,
    aggregate_key: createAttackPathKey({ ...item, protocol }),
    aggregate_count: Number(item.count || 0),
    first_seen: item.first_seen,
    last_seen: item.last_seen,
    latest_event_id: item.latest_event_id,
    event_time: eventTime,
    event_time_cn: eventTime,
    src_ip: item.src_ip,
    src_country: item.src_country || 'Unknown',
    src_country_code: normalizeCountryCode(item.src_country_code, item.src_country),
    src_city: item.src_city || 'Unknown',
    src_latitude: toFiniteNumber(item.src_latitude),
    src_longitude: toFiniteNumber(item.src_longitude),
    target_public_ip: item.target_public_ip || item.target_internal_ip || 'target',
    target_internal_ip: item.target_internal_ip ?? undefined,
    target_hostname: item.target_hostname || 'target',
    target_latitude: toFiniteNumber(item.target_latitude),
    target_longitude: toFiniteNumber(item.target_longitude),
    protocol,
    dest_port: toFiniteNumber(item.dest_port),
    honeypot_type: '聚合路径',
    action: 'aggregate',
  }
}

export function getLatestAttacks(limit = 100, range = '24h'): Promise<AttackEvent[]> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackListPayload>('/api/attacks/latest', {
        params: { range, limit },
      })
      return unwrapAttackItems(response.data)
    },
    'Latest attacks request',
    `attacks:latest:range=${range}:limit=${limit}`,
  )
}

export function getAttackWindow(range = '24h'): Promise<AttackWindowPayload<AttackEvent>> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackListPayload>('/api/attacks/window', {
        params: { range },
      })
      const window = unwrapWindow(response.data)
      return {
        items: unwrapAttackItems(response.data),
        ...window,
      }
    },
    'Attack window request',
    `attacks:window:range=${range}`,
  )
}

export function getLatestAttacksWindow(
  limit = 100,
  range = '24h',
): Promise<AttackWindowPayload<AttackEvent>> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackListPayload>('/api/attacks/latest', {
        params: { range, limit },
      })
      const window = unwrapWindow(response.data)
      return {
        items: unwrapAttackItems(response.data),
        ...window,
      }
    },
    'Latest attacks request',
    `attacks:latest:range=${range}:limit=${limit}`,
  )
}

export function getMapAttacks(range = '24h'): Promise<AttackEvent[]> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackListPayload>('/api/attacks/map', {
        params: { range },
      })
      return unwrapAttackItems(response.data)
    },
    'Map attacks request',
    `attacks:map:range=${range}`,
  )
}

export function getMapAttackAggregates(range = '24h', limit = 1000): Promise<AttackEvent[]> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackAggregatePayload>('/api/attacks/map/aggregate', {
        params: { range, limit },
      })
      return unwrapAggregateItems(response.data).map(aggregateToAttackEvent)
    },
    'Map aggregate request',
    `attacks:map:aggregate:range=${range}:limit=${limit}`,
  )
}

export function getMapAttackAggregateWindow(
  range = '24h',
  limit = 1000,
): Promise<AttackWindowPayload<AttackEvent>> {
  return requestApi(
    async () => {
      const response = await apiClient.get<AttackAggregatePayload>('/api/attacks/map/aggregate', {
        params: { range, limit },
      })
      const window = unwrapWindow(response.data)
      return {
        items: unwrapAggregateItems(response.data).map(aggregateToAttackEvent),
        ...window,
      }
    },
    'Map aggregate request',
    `attacks:map:aggregate:range=${range}:limit=${limit}`,
  )
}
