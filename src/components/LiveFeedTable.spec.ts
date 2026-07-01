import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LiveFeedTable from './LiveFeedTable.vue'
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

describe('LiveFeedTable', () => {
  it('opens the attack detail drawer and marks the row selected on click', async () => {
    const pinia = createPinia()
    const store = useAttackStore(pinia)
    const now = new Date().toISOString()
    const attack = makeAttack('event-1', {
      event_time: now,
      event_time_cn: now,
    })
    store.attacks = [attack]
    store.latestAttacks = [attack]
    store.visibleFeedRows = [attack]
    store.mapAttacks = [attack]
    const openAttackDetail = vi.spyOn(store, 'openAttackDetail')

    const wrapper = mount(LiveFeedTable, {
      global: {
        plugins: [pinia],
      },
    })

    const row = wrapper.get('tr[tabindex="0"]')
    await row.trigger('click')

    expect(openAttackDetail).toHaveBeenCalledWith(attack.id)
    expect(store.selectedAttackId).toBe(attack.id)
    expect(store.detailAttackId).toBe(attack.id)
    expect(row.classes()).toContain('data-table__row--selected')
  })
})
