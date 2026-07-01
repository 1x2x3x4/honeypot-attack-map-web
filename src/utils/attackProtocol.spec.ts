import { describe, expect, it } from 'vitest'
import { createAttackPathKey, normalizeProtocol } from './attackProtocol'

describe('protocol inference', () => {
  it('uses aliases, ports, honeypot type, and HTTP metadata', () => {
    expect(normalizeProtocol('ms-wbt-server')).toBe('rdp')
    expect(normalizeProtocol('', 6379)).toBe('redis')
    expect(normalizeProtocol('', 23, 'cowrie')).toBe('telnet')
    expect(normalizeProtocol('', 8443, '', 'GET')).toBe('https')
  })

  it('creates stable path keys from source, target, protocol, and port', () => {
    expect(
      createAttackPathKey({
        src_ip: '198.51.100.8',
        target_public_ip: '203.0.113.2',
        protocol: 'tcp',
        dest_port: 9999,
      }),
    ).toBe('198.51.100.8|203.0.113.2|tcp:9999')
  })
})
