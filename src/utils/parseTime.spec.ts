import { describe, expect, it } from 'vitest'
import { parseAttackTime } from './parseTime'

describe('parseAttackTime', () => {
  it('treats backend naive datetime strings as local time', () => {
    expect(parseAttackTime('2026-06-15 00:00:00')).toBe(Date.parse('2026-06-15T00:00:00'))
  })

  it('preserves explicit timezone offsets', () => {
    expect(parseAttackTime('2026-06-15T08:00:00+08:00')).toBe(Date.parse('2026-06-15T08:00:00+08:00'))
  })
})
