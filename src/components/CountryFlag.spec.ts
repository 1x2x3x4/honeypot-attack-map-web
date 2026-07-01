import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CountryFlag from './CountryFlag.vue'

describe('CountryFlag', () => {
  it('renders ISO country codes as flag images', () => {
    const wrapper = mount(CountryFlag, {
      props: { code: 'sg', country: 'Singapore' },
    })
    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe('https://flagcdn.com/sg.svg')
    expect(image.attributes('alt')).toBe('Singapore国旗')
    expect(wrapper.attributes('title')).toBe('SG')
  })

  it('normalizes country names when the API code is missing', () => {
    const wrapper = mount(CountryFlag, {
      props: { code: '--', country: 'China' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('https://flagcdn.com/cn.svg')
  })

  it('renders alpha-3 and mixed-case API codes', () => {
    const wrapper = mount(CountryFlag, {
      props: { code: 'dEu', country: 'Germany' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('https://flagcdn.com/de.svg')
    expect(wrapper.attributes('title')).toBe('DE')
  })

  it('falls back to the raw code for unknown values', () => {
    const wrapper = mount(CountryFlag, {
      props: { code: '--' },
    })

    expect(wrapper.text()).toBe('--')
  })

  it('does not request a flag image for an invalid two-letter code', () => {
    const wrapper = mount(CountryFlag, {
      props: { code: 'ZZ', country: 'Unknown' },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('--')
  })
})
