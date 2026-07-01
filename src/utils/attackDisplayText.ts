import type { ConnectionStatus, DataMode, TimeRange } from '../types/attack'
import { displayCityName, displayCountryName } from './geoNameZh'

const valueLabels: Record<string, string> = {
  'known attacker': '已知攻击者',
  malicious: '恶意',
  suspicious: '可疑',
  bot: '机器人',
  crawler: '爬虫',
  scanner: '扫描器',
  unknown: '未知',
  failed: '失败',
  successful: '成功',
  connection: '连接',
  connection_attempt: '连接尝试',
  blocked: '已阻止',
  login: '登录',
  command: '命令',
  download: '下载',
  request: '请求',
  probe: '探测',
  scan: '扫描',
}

const honeypotLabels: Record<string, string> = {
  'Redis Honeypot': 'Redis 蜜罐',
  'SIP Honeypot': 'SIP 蜜罐',
  Unknown: '未知',
}

export function displayValue(value?: string | null): string {
  if (!value) return '未知'
  return valueLabels[value.toLowerCase()] ?? value
}

export function displayCountry(value?: string | null): string {
  return displayCountryName(value)
}

export function displayCity(value?: string | null): string {
  return displayCityName(value)
}

export function displayHoneypot(value?: string | null): string {
  if (!value) return '未知'
  return honeypotLabels[value] ?? value
}

export function displayConnectionStatus(status: ConnectionStatus): string {
  return {
    connected: '已连接',
    disconnected: '已断开',
    reconnecting: '重连中',
  }[status]
}

export function displayDataMode(mode: DataMode): string {
  return {
    API: '接口模式',
    WebSocket: 'WebSocket 模式',
  }[mode]
}

export function displayTimeRange(range: TimeRange): string {
  return {
    '1m': '1分钟',
    '1h': '1小时',
    '24h': '24小时',
    all: '全部',
  }[range]
}
