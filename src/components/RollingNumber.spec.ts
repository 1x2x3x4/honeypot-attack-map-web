import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RollingNumber from './RollingNumber.vue'

describe('RollingNumber', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('animates header number changes and settles', async () => {
    vi.useFakeTimers()
    const wrapper = mount(RollingNumber, { props: { value: 7 } })

    await wrapper.setProps({ value: 9 })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('.summary-number__value--old').text()).toBe('7')
    expect(wrapper.find('.summary-number__value--new').text()).toBe('9')

    await vi.advanceTimersByTimeAsync(460)
    expect(wrapper.find('.summary-number__value--old').exists()).toBe(false)
  })
})
