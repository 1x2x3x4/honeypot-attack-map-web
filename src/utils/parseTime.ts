export function parseAttackTime(value?: string | null): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed) return 0

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T')
  const timestamp = Date.parse(normalized)
  if (hasTimezone || Number.isFinite(timestamp)) {
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const timestampWithUtc = Date.parse(`${normalized}Z`)
  return Number.isFinite(timestampWithUtc) ? timestampWithUtc : 0
}
