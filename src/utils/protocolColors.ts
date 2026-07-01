import type { ProtocolType } from '../types/attack'

export const protocolColors: Record<ProtocolType, string> = {
  tcp: '#64748b',
  udp: '#94a3b8',
  ssh: '#e85d9f',
  http: '#4f8cff',
  https: '#00d4ff',
  ftp: '#ff6b35',
  redis: '#7c3aed',
  mysql: '#22c55e',
  telnet: '#facc15',
  smb: '#38bdf8',
  vnc: '#a78bfa',
  rdp: '#ef4444',
  socks5: '#0ea5e9',
  postgresql: '#336791',
  rabbitmq: '#ff6600',
  mikrotik: '#64748b',
  elasticsearch: '#f97316',
  sip: '#14b8a6',
  unknown: '#9ca3af',
}

export const supportedProtocols: Exclude<ProtocolType, 'unknown'>[] = [
  'tcp',
  'udp',
  'ssh',
  'http',
  'https',
  'telnet',
  'redis',
  'mysql',
  'ftp',
  'smb',
  'vnc',
  'rdp',
  'socks5',
  'postgresql',
  'rabbitmq',
  'mikrotik',
  'elasticsearch',
  'sip',
]

export function getProtocolColor(protocol: string): string {
  return protocolColors[protocol.toLowerCase() as ProtocolType] ?? protocolColors.unknown
}
