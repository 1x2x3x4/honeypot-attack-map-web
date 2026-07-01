import { describe, expect, it } from 'vitest'
import { normalizeCountryCode } from './countryCode'

describe('normalizeCountryCode', () => {
  it.each([
    ['United States of America', 'US'],
    ['Russian Federation', 'RU'],
    ['Côte d’Ivoire', 'CI'],
    ['Korea, Republic of', 'KR'],
    ['Iran, Islamic Republic of', 'IR'],
    ['Viet Nam', 'VN'],
    ['Türkiye', 'TR'],
    ['Hong Kong SAR China', 'HK'],
    ['中国', 'CN'],
  ])('maps the country name %s to %s', (country, expected) => {
    expect(normalizeCountryCode(null, country)).toBe(expected)
  })

  it.each([
    ['usa', 'US'],
    ['DeU', 'DE'],
    ['gbr', 'GB'],
    ['CHN', 'CN'],
    ['twn', 'TW'],
    ['xkx', 'XK'],
  ])('maps the alpha-3 code %s to %s regardless of case', (code, expected) => {
    expect(normalizeCountryCode(code)).toBe(expected)
  })

  it('normalizes valid alpha-2 codes and can read a country name from the code field', () => {
    expect(normalizeCountryCode(' br ')).toBe('BR')
    expect(normalizeCountryCode('South Africa')).toBe('ZA')
  })

  it.each([undefined, null, '', '  ', '--', 'UNKNOWN', 'N/A', 'ZZ', 'EU', '123', 'not-a-country']) (
    'uses the controlled fallback for %s',
    (value) => {
      expect(normalizeCountryCode(value)).toBe('--')
    },
  )

  it('falls back to the country name when the supplied code is invalid', () => {
    expect(normalizeCountryCode('UNKNOWN', 'Japan')).toBe('JP')
  })
})
