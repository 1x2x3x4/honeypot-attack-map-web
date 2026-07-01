import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import HeaderBar from './HeaderBar.vue'
import { useAttackStore } from '../stores/attackStore'

vi.mock('../api/attack-map/attackEventsApi', () => ({
  getAttackWindow: vi.fn().mockResolvedValue({
    items: [],
    windowStart: null,
    windowEnd: null,
  }),
  getLatestAttacks: vi.fn().mockResolvedValue([]),
  getMapAttackAggregates: vi.fn().mockResolvedValue([]),
  getLatestAttacksWindow: vi.fn().mockResolvedValue({
    items: [],
    windowStart: null,
    windowEnd: null,
  }),
  getMapAttackAggregateWindow: vi.fn().mockResolvedValue({
    items: [],
    windowStart: null,
    windowEnd: null,
  }),
}))

vi.mock('../api/attack-map/attackStatsApi', () => ({
  calculateSummary: vi.fn(() => ({
    total: 0,
    lastMinute: 0,
    lastHour: 0,
    last24Hours: 0,
    uniqueSourceIps: 0,
    uniqueCountries: 0,
    topProtocol: null,
    lastAttackTime: null,
    latestEventTime: null,
    latestDataAgeSeconds: null,
    hasRecent24hData: false,
  })),
  calculateTopCountries: vi.fn(() => []),
  calculateTopIps: vi.fn(() => []),
  getSummary: vi.fn(),
  getTopCountries: vi.fn().mockResolvedValue([]),
  getTopIps: vi.fn().mockResolvedValue([]),
}))

describe('HeaderBar attack summary', () => {
  it('renders three read-only database rolling counters instead of range controls', async () => {
    const pinia = createPinia()
    const store = useAttackStore(pinia)
    store.headerSummary = {
      ...store.headerSummary,
      lastMinute: 3,
      lastHour: 7,
      last24Hours: 11,
    }
    const refreshRangeData = vi.spyOn(store, 'refreshRangeData')
    const wrapper = mount(HeaderBar, {
      global: {
        plugins: [pinia],
      },
    })

    const summary = wrapper.get('.attack-summary')
    const items = wrapper.findAll('.attack-summary__item')

    expect(summary.element.tagName).toBe('DL')
    expect(summary.attributes('aria-label')).toBe('数据库真实滚动攻击计数')
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.text())).toEqual([
      '1分钟3',
      '1小时7',
      '24小时11',
    ])
    expect(wrapper.findAll('button.attack-summary__item')).toHaveLength(0)
    expect(wrapper.find('.attack-summary__item--active').exists()).toBe(false)

    await items[0].trigger('click')
    expect(refreshRangeData).not.toHaveBeenCalled()
    expect(store.timeRange).toBe('24h')
  })

  it('renders data mode as read-only status without simulated-data controls', () => {
    const pinia = createPinia()
    const store = useAttackStore(pinia)
    store.connected = true
    const wrapper = mount(HeaderBar, {
      global: {
        plugins: [pinia],
      },
    })

    expect(wrapper.text()).toContain('WebSocket 模式')
    expect(wrapper.text()).not.toContain('发送模拟数据')
    expect(wrapper.find('button.mock-data-button').exists()).toBe(false)
    expect('sendMockAttack' in store).toBe(false)
  })
})
