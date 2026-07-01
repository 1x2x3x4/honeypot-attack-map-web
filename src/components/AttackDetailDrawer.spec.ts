import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AttackDetailDrawer from './AttackDetailDrawer.vue'
import { useAttackStore } from '../stores/attackStore'
import { makeAttack } from '../test/attackEventFixtures'

vi.mock('../api/attack-map/attackEventsApi', () => ({
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
  getTopCountries: vi.fn().mockResolvedValue([]),
  getTopIps: vi.fn().mockResolvedValue([]),
}))

describe('AttackDetailDrawer', () => {
  it('renders details from a map aggregate selection and clears store state on close', async () => {
    const pinia = createPinia()
    const store = useAttackStore(pinia)
    const aggregateAttack = makeAttack('aggregate-1', {
      aggregate_count: 5,
      latest_event_id: 'aggregate-1',
      aggregate_key: '198.51.100.1|203.0.113.2|ssh|22',
      action: 'aggregate',
    })
    store.mapAttacks = [aggregateAttack]
    store.openAttackDetail(aggregateAttack.id)

    const wrapper = mount(AttackDetailDrawer, {
      global: {
        plugins: [pinia],
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.get('.attack-detail-drawer').text()).toContain(aggregateAttack.src_ip)
    expect(wrapper.text()).toContain('5')

    await wrapper.get('button[aria-label="关闭攻击详情"]').trigger('click')

    expect(store.selectedAttackId).toBeNull()
    expect(store.detailAttackId).toBeNull()
    expect(wrapper.find('.attack-detail-drawer').exists()).toBe(false)
  })
})
