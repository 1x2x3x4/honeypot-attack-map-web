import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  FEED_DRAIN_INTERVAL_MS,
  MAP_EXPIRY_SWEEP_INTERVAL_MS,
  MAX_LATEST_ATTACKS,
  MAX_PENDING_ATTACK_QUEUE,
  MAX_PENDING_FEED_QUEUE,
  useAttackStore,
} from './attackStore'
import { makeAttack } from '../test/attackEventFixtures'
import {
  getAttackWindow,
  getLatestAttacksWindow,
  getMapAttackAggregateWindow,
} from '../api/attack-map/attackEventsApi'
import { getSummary } from '../api/attack-map/attackStatsApi'

const streamHarness = vi.hoisted(() => ({
  callbacks: null as {
    onAttackBatch?: (events: ReturnType<typeof makeAttack>[]) => void
  } | null,
}))

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

vi.mock('../api/attack-map/attackWebSocketApi', () => ({
  createAttackStream: vi.fn((callbacks) => {
    streamHarness.callbacks = callbacks
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
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
  getSummary: vi.fn().mockResolvedValue({
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
  }),
  getTopCountries: vi.fn().mockResolvedValue([]),
  getTopIps: vi.fn().mockResolvedValue([]),
}))

describe('attackStore live feed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime('2026-06-15T00:00:00Z')
    vi.mocked(getLatestAttacksWindow).mockResolvedValue({
      items: [],
      windowStart: '2026-06-15T00:00:00Z',
      windowEnd: '2026-06-16T00:00:00Z',
    })
    vi.mocked(getAttackWindow).mockResolvedValue({
      items: [],
      windowStart: '2026-06-15 00:00:00',
      windowEnd: '2026-06-16 00:00:00',
    })
    vi.mocked(getMapAttackAggregateWindow).mockResolvedValue({
      items: [],
      windowStart: '2026-06-15 00:00:00',
      windowEnd: '2026-06-16 00:00:00',
    })
    vi.mocked(getSummary).mockResolvedValue({
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
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deduplicates events by stable event id', () => {
    const store = useAttackStore()
    const event = makeAttack('event-1')

    store.addAttack(event)
    store.addAttack(event)

    expect(store.attacks).toHaveLength(1)
  })

  it('emits a map focus request for every row selection', () => {
    const store = useAttackStore()

    store.selectAttack('event-1')
    store.selectAttack('event-1')

    expect(store.selectedAttackId).toBe('event-1')
    expect(store.selectedAttackFocusSequence).toBe(2)
  })

  it('opens detail state and clears both selection states when the drawer closes', () => {
    const store = useAttackStore()
    const event = makeAttack('event-1')

    store.addAttack(event)
    store.openAttackDetail(event.id)

    expect(store.selectedAttackId).toBe(event.id)
    expect(store.detailAttackId).toBe(event.id)
    expect(store.selectedAttack?.id).toBe(event.id)

    store.clearSelectedAttack()

    expect(store.selectedAttackId).toBeNull()
    expect(store.detailAttackId).toBeNull()
    expect(store.selectedAttack).toBeNull()
  })

  it('resolves drawer detail from map aggregate items even when the event is not in latest attacks', () => {
    const store = useAttackStore()
    const aggregateAttack = makeAttack('aggregate-1', {
      aggregate_key: '198.51.100.1|203.0.113.2|ssh|22',
      aggregate_count: 4,
      latest_event_id: 'aggregate-1',
    })

    store.mapAttacks = [aggregateAttack]
    store.openAttackDetail(aggregateAttack.id)

    expect(store.selectedAttack?.id).toBe(aggregateAttack.id)
    expect(store.selectedAttack?.aggregate_count).toBe(4)
  })

  it('counts only live messages and expires them after 24 hours', async () => {
    const store = useAttackStore()

    await store.init()
    expect(store.displaySummary.last24Hours).toBe(0)

    store.addAttack(
      makeAttack('live-1', {
        event_time: '2026-06-01T00:00:00Z',
        event_time_cn: '2026-06-01 08:00:00',
      }),
    )

    expect(store.displaySummary.lastMinute).toBe(0)
    expect(store.displaySummary.lastHour).toBe(0)
    expect(store.displaySummary.last24Hours).toBe(0)

    store.addAttack(makeAttack('live-2'))

    expect(store.displaySummary.lastMinute).toBe(1)
    expect(store.displaySummary.lastHour).toBe(1)
    expect(store.displaySummary.last24Hours).toBe(1)

    vi.setSystemTime(Date.now() + 86_400_001)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.displaySummary.last24Hours).toBe(0)
  })

  it('loads header counters from the database summary on init', async () => {
    vi.mocked(getSummary).mockResolvedValue({
      total: 123,
      lastMinute: 4,
      lastHour: 56,
      last24Hours: 789,
      uniqueSourceIps: 12,
      uniqueCountries: 3,
      topProtocol: 'ssh',
      lastAttackTime: '2026-06-15 00:00:00',
      latestEventTime: '2026-06-15 00:00:00',
      latestDataAgeSeconds: 2,
      hasRecent24hData: true,
    })
    const store = useAttackStore()

    await store.init()

    expect(getSummary).toHaveBeenCalled()
    expect(store.headerSummary.lastMinute).toBe(4)
    expect(store.headerSummary.lastHour).toBe(56)
    expect(store.headerSummary.last24Hours).toBe(789)
  })

  it('restores rolling counters after a page refresh', async () => {
    const firstStore = useAttackStore()
    await firstStore.init()
    firstStore.addAttack(makeAttack('live-1'))
    firstStore.addAttack(makeAttack('live-2'))
    window.dispatchEvent(new Event('pagehide'))
    firstStore.dispose()

    setActivePinia(createPinia())
    const refreshedStore = useAttackStore()
    await refreshedStore.init()

    expect(refreshedStore.displaySummary.lastMinute).toBe(2)
    expect(refreshedStore.displaySummary.lastHour).toBe(2)
    expect(refreshedStore.displaySummary.last24Hours).toBe(2)
  })

  it('drains one visible row every 350ms', async () => {
    const store = useAttackStore()
    store.addAttack(makeAttack('event-1'))

    expect(store.visibleFeedRows).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(FEED_DRAIN_INTERVAL_MS - 1)
    expect(store.visibleFeedRows).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(store.visibleFeedRows).toHaveLength(1)
  })

  it('keeps live map updates incremental', async () => {
    const store = useAttackStore()
    const datasetSequence = store.mapDatasetSequence

    store.addAttack(makeAttack('event-1'))
    await vi.advanceTimersByTimeAsync(FEED_DRAIN_INTERVAL_MS)

    expect(store.mapAttacks).toHaveLength(1)
    expect(store.mapDatasetSequence).toBe(datasetSequence)
    expect(store.visualizationSequence).toBe(1)
  })

  it('removes map markers after the rolling 24-hour window advances', async () => {
    const store = useAttackStore()
    await store.init()
    store.addAttack(makeAttack('event-1'))
    await vi.advanceTimersByTimeAsync(FEED_DRAIN_INTERVAL_MS)
    expect(store.mapAttacks).toHaveLength(1)

    vi.setSystemTime(Date.now() + 86_400_001)
    await vi.advanceTimersByTimeAsync(MAP_EXPIRY_SWEEP_INTERVAL_MS)

    expect(store.mapAttacks).toHaveLength(0)
    expect(store.attacks).toHaveLength(0)
    expect(store.latestAttacks).toHaveLength(0)
    expect(store.visibleFeedRows).toHaveLength(0)
  })

  it('resolves drawer detail from map-only selection even when the event is not in the visible feed', () => {
    const store = useAttackStore()
    const selected = makeAttack('selected-map-only')
    const newerVisibleAttack = makeAttack('visible-1', {
      event_time: '2026-06-15T00:10:00Z',
      event_time_cn: '2026-06-15 08:10:00',
    })

    store.mapAttacks = [selected]
    store.attacks = [newerVisibleAttack]
    store.latestAttacks = [selected, newerVisibleAttack]
    store.visibleFeedRows = [newerVisibleAttack]
    store.openAttackDetail(selected.id)

    expect(store.selectedAttackId).toBe(selected.id)
    expect(store.detailAttackId).toBe(selected.id)
    expect(store.selectedAttack?.id).toBe(selected.id)
  })

  it('caps the visible live feed at 300 rows', async () => {
    const store = useAttackStore()
    for (let index = 0; index < MAX_LATEST_ATTACKS + 20; index += 1) {
      store.addAttack(
        makeAttack(`event-${index}`, {
          src_ip: `198.51.${Math.floor(index / 250)}.${index % 250}`,
          event_time: new Date(Date.now() + index * 11_000).toISOString(),
        }),
      )
    }

    await vi.runAllTimersAsync()
    expect(store.visibleFeedRows).toHaveLength(MAX_LATEST_ATTACKS)
  })

  it('caps pending display queue at 2000 and tracks dropped rows', async () => {
    const store = useAttackStore()
    const events = Array.from(
      { length: MAX_PENDING_FEED_QUEUE + 50 },
      (_, index) =>
        makeAttack(`event-${index}`, {
          src_ip: `198.51.${Math.floor(index / 250)}.${index % 250}`,
          event_time: new Date(Date.now() + index * 11_000).toISOString(),
        }),
    )

    store.connectWebSocket()
    streamHarness.callbacks?.onAttackBatch?.(events)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(store.pendingFeedQueueSize).toBeLessThanOrEqual(MAX_PENDING_FEED_QUEUE)
    expect(store.feedDisplayDroppedCount).toBeGreaterThan(0)
  })

  it('caps pending attack queue and tracks dropped events', () => {
    const store = useAttackStore()
    const events = Array.from(
      { length: MAX_PENDING_ATTACK_QUEUE + 25 },
      (_, index) =>
        makeAttack(`event-${index}`, {
          src_ip: `198.51.${Math.floor(index / 250)}.${index % 250}`,
          event_time: new Date(Date.now() + index).toISOString(),
        }),
    )

    store.connectWebSocket()
    streamHarness.callbacks?.onAttackBatch?.(events)

    expect(store.pendingAttackQueueSize).toBe(MAX_PENDING_ATTACK_QUEUE)
    expect(store.pendingAttackDroppedCount).toBe(25)
  })

  it('coalesces the same path inside the ten-second feed window', async () => {
    const store = useAttackStore()
    store.addAttack(makeAttack('event-1'))
    store.addAttack(
      makeAttack('event-2', {
        event_time: '2026-06-15T00:00:09Z',
        event_time_cn: '2026-06-15 08:00:09',
        src_ip: '198.51.100.1',
      }),
    )

    await vi.runAllTimersAsync()
    expect(store.visibleFeedRows).toHaveLength(1)
    expect(store.visibleFeedRows[0].aggregate_count).toBe(2)
  })

  it('ignores live events older than the rolling 24-hour window', async () => {
    const store = useAttackStore()
    await store.init()

    store.addAttack(
      makeAttack('outside-window', {
        event_time: '2026-06-13T23:59:59Z',
        event_time_cn: '2026-06-13 23:59:59',
      }),
    )
    await vi.advanceTimersByTimeAsync(FEED_DRAIN_INTERVAL_MS)

    expect(store.attacks).toHaveLength(0)
    expect(store.visibleFeedRows).toHaveLength(0)
    expect(store.mapAttacks).toHaveLength(0)
  })

  it('buckets dashboard data by the rolling 24-hour window', async () => {
    vi.mocked(getAttackWindow).mockResolvedValue({
      items: [
        makeAttack('bucket-1', {
          event_time: '2026-06-14T00:30:00Z',
          event_time_cn: '2026-06-14 00:30:00',
        }),
        makeAttack('bucket-2', {
          event_time: '2026-06-14T23:30:00Z',
          event_time_cn: '2026-06-14 23:30:00',
        }),
      ],
      windowStart: '2026-06-15 00:00:00',
      windowEnd: '2026-06-16 00:00:00',
    })
    const store = useAttackStore()

    await store.init()

    const expectedFirstHour = `${String(new Date('2026-06-14T00:00:00Z').getHours()).padStart(2, '0')}:00`
    const expectedLastHour = `${String(new Date('2026-06-14T23:00:00Z').getHours()).padStart(2, '0')}:00`

    expect(store.attacksByTimeBucket).toHaveLength(24)
    expect(store.attacksByTimeBucket[0].time).toBe(expectedFirstHour)
    expect(store.attacksByTimeBucket[23].time).toBe(expectedLastHour)
    expect(store.attacksByTimeBucket[0].count).toBe(1)
    expect(store.attacksByTimeBucket[23].count).toBe(1)
  })
})
