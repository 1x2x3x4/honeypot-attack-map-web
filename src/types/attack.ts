export type ProtocolType =
  | 'tcp'
  | 'udp'
  | 'ssh'
  | 'http'
  | 'https'
  | 'ftp'
  | 'redis'
  | 'mysql'
  | 'telnet'
  | 'smb'
  | 'vnc'
  | 'rdp'
  | 'socks5'
  | 'postgresql'
  | 'rabbitmq'
  | 'mikrotik'
  | 'elasticsearch'
  | 'sip'
  | 'unknown'

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
export type TimeRange = '1m' | '1h' | '24h' | 'all'
export type DataMode = 'API' | 'WebSocket'

export type FilterKey =
  | 'timeRange'
  | 'protocol'
  | 'country'
  | 'sourceIp'
  | 'honeypot'
  | 'action'
  | 'reputation'
  | 'search'

export interface ActiveFilter {
  key: FilterKey
  label: string
  value: string
}

export interface AttackEvent {
  id: string
  aggregate_key?: string
  aggregate_count?: number
  first_seen?: string
  last_seen?: string
  latest_event_id?: string
  event_time: string
  event_time_cn: string
  src_ip: string
  src_port?: number
  src_country: string
  src_country_code: string
  src_city: string
  src_latitude: number
  src_longitude: number
  src_asn?: string
  src_as_org?: string
  target_public_ip: string
  target_internal_ip?: string
  target_hostname: string
  target_latitude: number
  target_longitude: number
  target_country?: string
  target_city?: string
  destination_ip?: string
  protocol: ProtocolType
  dest_port: number
  honeypot_type: string
  action: string
  status?: string
  username?: string
  password?: string
  ip_reputation?: string
  http_method?: string
  http_uri?: string
  http_host?: string
  user_agent?: string
  command?: string
  es_index?: string
  es_doc_id?: string
  log_path?: string
}

export interface AttackPathAggregate {
  key: string
  src_ip: string
  src_country: string
  src_country_code: string
  src_city: string
  src_latitude: number
  src_longitude: number
  target_public_ip: string
  target_internal_ip?: string | null
  target_hostname: string
  target_latitude: number
  target_longitude: number
  protocol: ProtocolType
  dest_port: number
  count: number
  first_seen: string
  last_seen: string
  latest_event_id: string
}

export interface AttackSummary {
  total: number
  lastMinute: number
  lastHour: number
  last24Hours: number
  uniqueSourceIps: number
  uniqueCountries: number
  topProtocol: ProtocolType | null
  lastAttackTime: string | null
  latestEventTime: string | null
  latestDataAgeSeconds: number | null
  hasRecent24hData: boolean
}

export interface TopIpItem {
  ip: string
  hits: number
  country: string
  countryCode: string
  reputation: string
  lastProtocol: ProtocolType
  lastSeen: string
}

export interface TopCountryItem {
  country: string
  countryCode: string
  hits: number
  uniqueIps: number
  topProtocol: ProtocolType
  lastSeenIp: string
  lastSeen: string
}

export interface AttackTrendPoint {
  time: string
  count: number
  timestamp: number
}
