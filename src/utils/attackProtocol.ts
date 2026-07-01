import type { ProtocolType } from '../types/attack'

const protocolAliases: Record<string, ProtocolType> = {
  elastic: 'elasticsearch',
  elasticsearch: 'elasticsearch',
  ftp: 'ftp',
  http: 'http',
  'http/1.0': 'http',
  'http/1.1': 'http',
  http2: 'https',
  https: 'https',
  mysql: 'mysql',
  mikrotik: 'mikrotik',
  'mikrotik-api': 'mikrotik',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  rabbitmq: 'rabbitmq',
  rdp: 'rdp',
  'ms-wbt-server': 'rdp',
  redis: 'redis',
  sip: 'sip',
  smb: 'smb',
  socks: 'socks5',
  socks5: 'socks5',
  'microsoft-ds': 'smb',
  ssh: 'ssh',
  telnet: 'telnet',
  vnc: 'vnc',
}

const portProtocols: Record<number, ProtocolType> = {
  21: 'ftp',
  22: 'ssh',
  23: 'telnet',
  80: 'http',
  443: 'https',
  445: 'smb',
  1080: 'socks5',
  2083: 'https',
  5432: 'postgresql',
  5433: 'postgresql',
  5672: 'rabbitmq',
  5060: 'sip',
  5061: 'sip',
  5900: 'vnc',
  6379: 'redis',
  8000: 'http',
  8080: 'http',
  8081: 'http',
  8443: 'https',
  8728: 'mikrotik',
  8729: 'mikrotik',
  9200: 'elasticsearch',
  9300: 'elasticsearch',
  2323: 'telnet',
  3306: 'mysql',
  3389: 'rdp',
  15672: 'rabbitmq',
}

export function normalizeProtocol(
  value: unknown,
  destPort?: number | null,
  honeypotType?: string | null,
  httpMethod?: string | null,
): ProtocolType {
  const raw = String(value ?? '').trim().toLowerCase()
  const direct = protocolAliases[raw]
  if (direct) return direct

  const port = Number(destPort)
  if (Number.isFinite(port) && portProtocols[port]) {
    return portProtocols[port]
  }

  const honeypot = String(honeypotType ?? '').toLowerCase()
  if (honeypot.includes('cowrie')) {
    return port === 23 || port === 2323 ? 'telnet' : 'ssh'
  }
  if (honeypot.includes('rdp')) return 'rdp'
  if (httpMethod) return port === 443 || port === 8443 ? 'https' : 'http'
  if (raw === 'tcp' || raw === 'udp') return raw

  return 'unknown'
}

export function createAttackPathKey(input: {
  src_ip: string
  target_public_ip?: string | null
  target_internal_ip?: string | null
  target_hostname?: string | null
  protocol?: unknown
  dest_port?: number | null
  honeypot_type?: string | null
  http_method?: string | null
}): string {
  const target =
    input.target_public_ip ||
    input.target_internal_ip ||
    input.target_hostname ||
    'target'
  const protocol = normalizeProtocol(
    input.protocol,
    input.dest_port,
    input.honeypot_type,
    input.http_method,
  )
  return [
    input.src_ip,
    target,
    protocol === 'unknown' || protocol === 'tcp' || protocol === 'udp'
      ? `${protocol}:${input.dest_port || 'unknown'}`
      : protocol,
  ].join('|')
}
