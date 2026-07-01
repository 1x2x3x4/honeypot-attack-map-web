import type { AttackEvent, ConnectionStatus } from '../../types/attack'
import { normalizeCountryCode } from '../../utils/countryCode'
import { normalizeProtocol } from '../../utils/attackProtocol'
import { webSocketEnabled, webSocketUrl } from '../client'

export interface AttackStreamCallbacks {
  onAttack: (event: AttackEvent) => void
  onAttackBatch?: (events: AttackEvent[]) => void
  onStatusChange: (status: ConnectionStatus) => void
}

export interface AttackStreamController {
  connect: () => void
  disconnect: () => void
}

const maxReconnectAttempts = 3
let disabledNoticeLogged = false

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeAttackEvent(value: unknown): AttackEvent | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<AttackEvent>
  const srcLatitude = toFiniteNumber(candidate.src_latitude)
  const srcLongitude = toFiniteNumber(candidate.src_longitude)
  const targetLatitude = toFiniteNumber(candidate.target_latitude)
  const targetLongitude = toFiniteNumber(candidate.target_longitude)
  const destPort = toFiniteNumber(candidate.dest_port ?? 0)

  if (
    typeof candidate.src_ip !== 'string' ||
    typeof candidate.event_time !== 'string' ||
    srcLatitude === null ||
    srcLongitude === null ||
    targetLatitude === null ||
    targetLongitude === null ||
    destPort === null
  ) {
    return null
  }

  const protocol = normalizeProtocol(
    candidate.protocol,
    destPort,
    candidate.honeypot_type,
    candidate.http_method,
  )

  return {
    ...candidate,
    id: candidate.id || globalThis.crypto.randomUUID(),
    event_time_cn: candidate.event_time_cn || new Date(candidate.event_time).toLocaleString('zh-CN'),
    src_country: candidate.src_country || 'Unknown',
    src_country_code: normalizeCountryCode(candidate.src_country_code, candidate.src_country),
    src_city: candidate.src_city || 'Unknown',
    src_latitude: srcLatitude,
    src_longitude: srcLongitude,
    target_public_ip: candidate.target_public_ip || candidate.destination_ip || 'target',
    target_hostname: candidate.target_hostname || 'target',
    target_latitude: targetLatitude,
    target_longitude: targetLongitude,
    protocol,
    dest_port: destPort,
    honeypot_type: candidate.honeypot_type || 'Unknown',
    action: candidate.action || 'connection_attempt',
  } as AttackEvent
}

export function createAttackStream(callbacks: AttackStreamCallbacks): AttackStreamController {
  let socket: WebSocket | undefined
  let reconnectTimer: number | undefined
  let reconnectDelay = 3000
  let reconnectAttempts = 0
  let unavailableNoticeLogged = false
  let stopped = true

  function clearReconnectTimer(): void {
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer !== undefined) return
    if (reconnectAttempts >= maxReconnectAttempts) {
      stopped = true
      callbacks.onStatusChange('disconnected')
      if (!unavailableNoticeLogged) {
        unavailableNoticeLogged = true
        console.info('[Attack Map] 实时通道未连接，当前使用 REST API 数据。')
      }
      return
    }

    const delay = reconnectDelay
    reconnectAttempts += 1
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined
      openSocket()
    }, delay)
  }

  function handleMessage(message: MessageEvent<string>): void {
    try {
      const parsed = JSON.parse(message.data) as unknown
      if (parsed && typeof parsed === 'object') {
        const typed = parsed as { type?: string; items?: unknown; data?: unknown }
        if (typed.type === 'attack_batch' && Array.isArray(typed.items)) {
          const attacks = typed.items
            .map(normalizeAttackEvent)
            .filter((event): event is AttackEvent => Boolean(event))
          if (attacks.length) {
            if (callbacks.onAttackBatch) {
              callbacks.onAttackBatch(attacks)
            } else {
              attacks.forEach(callbacks.onAttack)
            }
          }
          return
        }

        if (typed.type === 'heartbeat' || typed.type === 'connected') return
        if (typed.type === 'attack') {
          const attack = normalizeAttackEvent(typed.data)
          if (attack) callbacks.onAttack(attack)
          return
        }
      }

      const payload =
        parsed && typeof parsed === 'object' && 'data' in parsed
          ? (parsed as { data: unknown }).data
          : parsed
      const attack = normalizeAttackEvent(payload)
      if (attack) callbacks.onAttack(attack)
    } catch {
      // Ignore malformed messages while keeping the stream alive.
    }
  }

  function openSocket(): void {
    if (
      stopped ||
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    callbacks.onStatusChange('reconnecting')

    try {
      socket = new WebSocket(webSocketUrl)
    } catch {
      callbacks.onStatusChange('reconnecting')
      scheduleReconnect()
      return
    }

    socket.onopen = () => {
      clearReconnectTimer()
      reconnectDelay = 3000
      reconnectAttempts = 0
      unavailableNoticeLogged = false
      callbacks.onStatusChange('connected')
    }
    socket.onmessage = handleMessage
    socket.onerror = () => socket?.close()
    socket.onclose = () => {
      socket = undefined
      if (stopped) {
        callbacks.onStatusChange('disconnected')
        return
      }

      callbacks.onStatusChange('reconnecting')
      scheduleReconnect()
    }
  }

  function connect(): void {
    if (!stopped) return
    if (!webSocketEnabled) {
      callbacks.onStatusChange('disconnected')
      if (!disabledNoticeLogged) {
        disabledNoticeLogged = true
        console.info('[Attack Map] 实时通道未启用，当前使用 REST API 数据。')
      }
      return
    }
    stopped = false

    openSocket()
  }

  function disconnect(): void {
    if (stopped) return
    stopped = true
    clearReconnectTimer()

    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      socket.close()
      socket = undefined
    }

    callbacks.onStatusChange('disconnected')
  }

  return { connect, disconnect }
}
