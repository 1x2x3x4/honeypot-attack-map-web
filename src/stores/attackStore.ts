import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  getAttackWindow,
  getLatestAttacksWindow,
  getMapAttackAggregateWindow,
} from '../api/attack-map/attackEventsApi'
import {
  calculateSummary,
  calculateTopCountries,
  calculateTopIps,
  getSummary,
  getTopCountries,
  getTopIps,
} from '../api/attack-map/attackStatsApi'
import { createAttackStream, type AttackStreamController } from '../api/attack-map/attackWebSocketApi'
import type {
  ActiveFilter,
  AttackEvent,
  AttackSummary,
  ConnectionStatus,
  DataMode,
  FilterKey,
  ProtocolType,
  TimeRange,
  TopCountryItem,
  TopIpItem,
} from '../types/attack'
import { parseAttackTime } from '../utils/parseTime'
import { createAttackPathKey } from '../utils/attackProtocol'
import {
  calculateRollingSummary,
  getRollingEventTimestamp,
  ROLLING_SUMMARY_WINDOW_MS,
  type RollingSummaryEvent,
} from '../utils/rollingCounter'

export const MAX_LATEST_ATTACKS = 300
const MAX_MAP_ATTACKS = 1000
const MAX_EVENTS_PER_FRAME = 50
export const LIVE_FEED_COALESCE_WINDOW_MS = 10_000
const INITIAL_VISIBLE_FEED_ROWS = 20
export const FEED_DRAIN_INTERVAL_MS = 350
const FEED_DRAIN_BATCH_SIZE = 1
export const MAX_PENDING_FEED_QUEUE = 2000
const SUMMARY_TICK_INTERVAL_MS = 1000
const SUMMARY_STORAGE_KEY = 'attack-map:rolling-summary:v1'
const SUMMARY_STORAGE_VERSION = 1
const SUMMARY_PERSIST_DELAY_MS = 250
const SUMMARY_BUCKET_MS = 1000
const HEADER_SUMMARY_REFRESH_INTERVAL_MS = 10_000
const HEADER_SUMMARY_REFRESH_DELAY_MS = 1_000
export const MAP_EXPIRY_SWEEP_INTERVAL_MS = 60_000
const BOTTOM_PANEL_RETENTION_MS = 86_400_000
const RANGE_REFRESH_THROTTLE_MS = 2000
const VISIBILITY_REFRESH_THROTTLE_MS = 10_000
const HIGH_THROUGHPUT_RATE_WINDOW_MS = 10_000
const HIGH_THROUGHPUT_RATE_ENTER = 1000
const HIGH_THROUGHPUT_RATE_EXIT = 200
const HIGH_THROUGHPUT_QUEUE_ENTER = 2000
const HIGH_THROUGHPUT_LAYER_ENTER = 1500
const HIGH_THROUGHPUT_EXIT_AFTER_MS = 30_000
export const MAX_PENDING_ATTACK_QUEUE = 5000
const DATA_LOAD_ERROR_MESSAGE = '数据加载失败，请检查 FastAPI 服务和 MySQL 数据库连接'

const EMPTY_SUMMARY: AttackSummary = {
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
}

function countBy(items: AttackEvent[], value: (attack: AttackEvent) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const attack of items) {
    const key = value(attack) || 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export const useAttackStore = defineStore('attackStore', () => {
  const connected = ref(false)
  const cached = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const attacks = ref<AttackEvent[]>([])
  const mapAttacks = ref<AttackEvent[]>([])
  const latestAttacks = ref<AttackEvent[]>([])
  const displaySummary = ref<AttackSummary>({ ...EMPTY_SUMMARY })
  const headerSummary = ref<AttackSummary>({ ...EMPTY_SUMMARY })
  const visibleFeedRows = ref<AttackEvent[]>([])
  const topIps = ref<TopIpItem[]>([])
  const topCountries = ref<TopCountryItem[]>([])

  const timeRange = computed<TimeRange>(() => '24h')
  const attackWindowStart = ref<string | null>(null)
  const attackWindowEnd = ref<string | null>(null)
  const searchKeyword = ref('')
  const selectedProtocol = ref<ProtocolType | null>(null)
  const selectedCountry = ref<string | null>(null)
  const selectedSourceIp = ref<string | null>(null)
  const selectedHoneypot = ref<string | null>(null)
  const selectedAction = ref<string | null>(null)
  const selectedReputation = ref<string | null>(null)
  const selectedAttackId = ref<string | null>(null)
  const selectedAttackFocusSequence = ref(0)
  const detailAttackId = ref<string | null>(null)
  const highlightedAttackId = ref<string | null>(null)
  const mapAutoFocus = ref(true)
  const panelLoading = ref(false)
  const panelError = ref<string | null>(null)
  const lastUpdatedAt = ref<string | null>(null)
  const maxLiveFeedRows = ref(100)
  const highThroughputMode = ref(false)
  const pendingAttackQueueSize = ref(0)
  const pendingFeedQueueSize = ref(0)
  const pendingAttackDroppedCount = ref(0)
  const feedDisplayDroppedCount = ref(0)
  const receivedEventsLast10s = ref(0)
  const visualizationAttack = ref<AttackEvent | null>(null)
  const visualizationSequence = ref(0)
  const mapDatasetSequence = ref(0)

  let stream: AttackStreamController | undefined
  let highlightTimer: number | undefined
  let queueFrame: number | undefined
  let feedDrainTimer: number | undefined
  let summaryTickTimer: number | undefined
  let summaryPersistTimer: number | undefined
  let headerSummaryTimer: number | undefined
  let headerSummaryRefreshTimer: number | undefined
  let mapExpiryTimer: number | undefined
  let highThroughputEnteredAt = 0
  let lastVisibilityRefreshAt = 0
  const rangeRefreshPromises = new Map<TimeRange, Promise<void>>()
  const lastRangeRefreshAt = new Map<TimeRange, number>()
  const attackIds = new Set<string>()
  const mapAttackIndex = new Map<string, AttackEvent>()
  const pendingAttackQueue: AttackEvent[] = []
  const pendingDisplayQueue: Array<{
    attack: AttackEvent
    placement: 'prepend' | 'append'
  }> = []
  const rollingSummaryEvents = new Map<string, RollingSummaryEvent>()
  const eventRateTimestamps: number[] = []

  const dataMode = computed<DataMode>(() => {
    return connected.value ? 'WebSocket' : 'API'
  })

  function matchesTimeRange(attack: AttackEvent, now = Date.now()): boolean {
    const timestamp = getAttackTimestamp(attack)
    if (timeRange.value === 'all') return true
    const ranges: Record<Exclude<TimeRange, 'all'>, number> = {
      '1m': 60_000,
      '1h': 3_600_000,
      '24h': 86_400_000,
    }
    return timestamp > 0 && now - timestamp <= ranges[timeRange.value]
  }

  function isInsideRollingWindow(attack: AttackEvent, now = Date.now()): boolean {
    const timestamp = getAttackTimestamp(attack)
    return timestamp > 0 && now - timestamp <= BOTTOM_PANEL_RETENTION_MS
  }

  function matchesSearch(attack: AttackEvent): boolean {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) return true
    return [
      attack.src_ip,
      attack.src_country,
      attack.src_city,
      attack.protocol,
      attack.honeypot_type,
      attack.action,
      attack.username,
      attack.password,
    ].some((value) => value?.toLowerCase().includes(keyword))
  }

  function applyFilters(source: AttackEvent[], excluded?: FilterKey): AttackEvent[] {
    return source.filter((attack) => {
      if (excluded !== 'timeRange' && !matchesTimeRange(attack)) return false
      if (excluded !== 'protocol' && selectedProtocol.value && attack.protocol !== selectedProtocol.value) return false
      if (excluded !== 'country' && selectedCountry.value && attack.src_country !== selectedCountry.value) return false
      if (excluded !== 'sourceIp' && selectedSourceIp.value && attack.src_ip !== selectedSourceIp.value) return false
      if (excluded !== 'honeypot' && selectedHoneypot.value && attack.honeypot_type !== selectedHoneypot.value) return false
      if (excluded !== 'action' && selectedAction.value && attack.action !== selectedAction.value) return false
      if (
        excluded !== 'reputation' &&
        selectedReputation.value &&
        (attack.ip_reputation ?? 'unknown') !== selectedReputation.value
      ) {
        return false
      }
      return excluded === 'search' || matchesSearch(attack)
    })
  }

  const filteredAttacks = computed(() => applyFilters(attacks.value))
  const filteredMapAttacks = computed(() => applyFilters(mapAttacks.value))
  const filteredLatestAttacks = computed(() =>
    applyFilters(visibleFeedRows.value).slice(
      0,
      Math.min(MAX_LATEST_ATTACKS, maxLiveFeedRows.value),
    ),
  )
  const rangeSummary = computed(() => calculateSummary(applyFilters(attacks.value, 'timeRange')))
  const filteredSummary = computed(() => calculateSummary(filteredAttacks.value))
  const filteredTopIps = computed(() => calculateTopIps(filteredAttacks.value, 10))
  const filteredTopCountries = computed(() => calculateTopCountries(filteredAttacks.value, 10))

  const protocolCounts = computed<Record<ProtocolType, number>>(() => {
    const counts: Record<ProtocolType, number> = {
      tcp: 0,
      udp: 0,
      ssh: 0,
      http: 0,
      https: 0,
      ftp: 0,
      redis: 0,
      mysql: 0,
      telnet: 0,
      smb: 0,
      vnc: 0,
      rdp: 0,
      socks5: 0,
      postgresql: 0,
      rabbitmq: 0,
      mikrotik: 0,
      elasticsearch: 0,
      sip: 0,
      unknown: 0,
    }
    for (const attack of applyFilters(attacks.value, 'protocol')) counts[attack.protocol] += 1
    return counts
  })

  const countryCounts = computed(() =>
    countBy(applyFilters(attacks.value, 'country'), (attack) => attack.src_country),
  )
  const honeypotCounts = computed(() =>
    countBy(applyFilters(attacks.value, 'honeypot'), (attack) => attack.honeypot_type),
  )
  const actionCounts = computed(() =>
    countBy(applyFilters(attacks.value, 'action'), (attack) => attack.action),
  )
  const reputationCounts = computed(() =>
    countBy(
      applyFilters(attacks.value, 'reputation'),
      (attack) => attack.ip_reputation ?? 'unknown',
    ),
  )

  const attacksByTimeBucket = computed(() => {
    const bucketEnd = Date.now()
    const windowStart = bucketEnd - BOTTOM_PANEL_RETENTION_MS
    const buckets = Array.from({ length: 24 }, (_, index) => {
      const timestamp = bucketEnd - (24 - index) * 3_600_000
      return {
        timestamp,
        time: `${String(new Date(timestamp).getHours()).padStart(2, '0')}:00`,
        count: 0,
      }
    })
    for (const attack of filteredAttacks.value) {
      const timestamp = getAttackTimestamp(attack)
      if (windowStart > 0 && timestamp < windowStart) continue
      const bucket = buckets.find(
        (item) => timestamp >= item.timestamp && timestamp < item.timestamp + 3_600_000,
      )
      if (bucket) bucket.count += 1
    }
    return buckets
  })

  function findAttackById(id: string | null): AttackEvent | null {
    if (!id) return null

    return (
      attacks.value.find((attack) => attack.id === id) ??
      visibleFeedRows.value.find((attack) => attack.id === id) ??
      latestAttacks.value.find((attack) => attack.id === id) ??
      mapAttacks.value.find((attack) => attack.id === id) ??
      null
    )
  }

  const selectedAttack = computed(() => findAttackById(detailAttackId.value))

  const activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = []
    if (selectedProtocol.value) filters.push({ key: 'protocol', label: '协议', value: selectedProtocol.value })
    if (selectedCountry.value) filters.push({ key: 'country', label: '国家', value: selectedCountry.value })
    if (selectedSourceIp.value) filters.push({ key: 'sourceIp', label: '攻击源 IP', value: selectedSourceIp.value })
    if (selectedHoneypot.value) filters.push({ key: 'honeypot', label: '蜜罐', value: selectedHoneypot.value })
    if (selectedAction.value) filters.push({ key: 'action', label: '动作', value: selectedAction.value })
    if (selectedReputation.value) filters.push({ key: 'reputation', label: '信誉', value: selectedReputation.value })
    if (searchKeyword.value.trim()) filters.push({ key: 'search', label: '搜索关键词', value: searchKeyword.value.trim() })
    return filters
  })

  const hasActiveFilters = computed(() => activeFilters.value.length > 0)
  const emptyWindowMessage = computed(() => {
    if (panelLoading.value || panelError.value || filteredMapAttacks.value.length > 0) return ''
    return '当前 24 小时攻击窗口内暂无攻击数据'
  })
  const highlightedProtocol = computed<ProtocolType | null>(() => {
    if (!highlightedAttackId.value) return null
    return (
      attacks.value.find((attack) => attack.id === highlightedAttackId.value)?.protocol ??
      mapAttacks.value.find((attack) => attack.id === highlightedAttackId.value)?.protocol ??
      null
    )
  })

  const mapLayerCount = computed(() => {
    const sourceIps = new Set<string>()
    for (const attack of mapAttacks.value) {
      sourceIps.add(attack.src_ip)
    }
    return sourceIps.size + (mapAttacks.value.length > 0 ? 1 : 0)
  })

  function recomputeStats(): void {
  }

  function getAttackTimestamp(attack: AttackEvent): number {
    const timestamp = parseAttackTime(attack.last_seen || attack.event_time || attack.event_time_cn)
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  function getAttackPathKey(attack: AttackEvent): string {
    return attack.aggregate_key || createAttackPathKey(attack)
  }

  function getAttackWeight(attack: AttackEvent): number {
    return Math.max(1, Number(attack.aggregate_count ?? 1))
  }

  function sortByWeightAndTime(first: AttackEvent, second: AttackEvent): number {
    const countDiff = getAttackWeight(second) - getAttackWeight(first)
    if (countDiff !== 0) return countDiff
    return getAttackTimestamp(second) - getAttackTimestamp(first)
  }

  function rebuildAttackIds(): void {
    attackIds.clear()
    for (const attack of attacks.value) attackIds.add(attack.id)
  }

  function rebuildMapAttackIndex(): void {
    mapAttackIndex.clear()
    for (const attack of mapAttacks.value) {
      mapAttackIndex.set(getAttackPathKey(attack), attack)
    }
  }

  function setRawAttacks(items: AttackEvent[]): void {
    attacks.value = items.slice()
    rebuildAttackIds()
  }

  function setLatestAttackItems(items: AttackEvent[]): void {
    latestAttacks.value = coalesceLiveFeedItems(items).slice(0, MAX_LATEST_ATTACKS)
  }

  function mergeFeedAttack(existing: AttackEvent, incoming: AttackEvent): void {
    const incomingIsNewer = getAttackTimestamp(incoming) >= getAttackTimestamp(existing)
    const aggregateCount = getAttackWeight(existing) + getAttackWeight(incoming)
    if (incomingIsNewer) {
      const stableId = existing.id
      Object.assign(existing, incoming, {
        id: stableId,
        aggregate_count: aggregateCount,
      })
      return
    }
    existing.aggregate_count = aggregateCount
  }

  function insertVisibleFeedAttack(
    attack: AttackEvent,
    placement: 'prepend' | 'append',
  ): void {
    const key = getLiveFeedKey(attack)
    const existing = visibleFeedRows.value.find(
      (item) => getLiveFeedKey(item) === key,
    )
    if (existing) {
      mergeFeedAttack(existing, attack)
      return
    }

    if (placement === 'prepend') {
      visibleFeedRows.value.unshift({ ...attack })
    } else {
      visibleFeedRows.value.push({ ...attack })
    }
    if (visibleFeedRows.value.length > MAX_LATEST_ATTACKS) {
      visibleFeedRows.value.splice(MAX_LATEST_ATTACKS)
    }
  }

  function stopFeedDrainTimer(): void {
    if (feedDrainTimer !== undefined) {
      window.clearTimeout(feedDrainTimer)
      feedDrainTimer = undefined
    }
  }

  function drainDisplayQueue(): void {
    feedDrainTimer = undefined
    const batch = pendingDisplayQueue.splice(0, FEED_DRAIN_BATCH_SIZE)
    for (const item of batch) {
      insertVisibleFeedAttack(item.attack, item.placement)
      if (item.placement === 'prepend') {
        upsertMapAttack(item.attack)
        commitMapAttackIndex()
        visualizationAttack.value = item.attack
        visualizationSequence.value += 1
      }
    }
    pendingFeedQueueSize.value = pendingDisplayQueue.length
    if (pendingDisplayQueue.length > 0) {
      feedDrainTimer = window.setTimeout(
        drainDisplayQueue,
        FEED_DRAIN_INTERVAL_MS,
      )
    }
  }

  function scheduleFeedDrain(): void {
    if (feedDrainTimer !== undefined || pendingDisplayQueue.length === 0) return
    feedDrainTimer = window.setTimeout(drainDisplayQueue, FEED_DRAIN_INTERVAL_MS)
  }

  function enqueueFeedItems(
    items: AttackEvent[],
    placement: 'prepend' | 'append',
  ): void {
    if (!items.length) return
    const entries = items.map((attack) => ({ attack, placement }))
    if (placement === 'prepend') {
      pendingDisplayQueue.unshift(...entries)
    } else {
      pendingDisplayQueue.push(...entries)
    }

    if (pendingDisplayQueue.length > MAX_PENDING_FEED_QUEUE) {
      const dropped = pendingDisplayQueue.splice(MAX_PENDING_FEED_QUEUE)
      feedDisplayDroppedCount.value += dropped.length
    }
    pendingFeedQueueSize.value = pendingDisplayQueue.length
    scheduleFeedDrain()
  }

  function stageInitialFeedItems(items: AttackEvent[]): void {
    stopFeedDrainTimer()
    pendingDisplayQueue.splice(0)
    feedDisplayDroppedCount.value = 0
    const coalesced = coalesceLiveFeedItems(items).slice(0, MAX_LATEST_ATTACKS)
    visibleFeedRows.value = coalesced
      .slice(0, INITIAL_VISIBLE_FEED_ROWS)
      .map((item) => ({ ...item }))
    enqueueFeedItems(coalesced.slice(INITIAL_VISIBLE_FEED_ROWS), 'append')
  }

  function getLiveFeedKey(attack: AttackEvent): string {
    const timestamp = getAttackTimestamp(attack)
    const timeBucket = timestamp > 0
      ? Math.floor(timestamp / LIVE_FEED_COALESCE_WINDOW_MS)
      : attack.event_time
    return [timeBucket, createAttackPathKey(attack)].join('|')
  }

  function coalesceLiveFeedItems(items: AttackEvent[]): AttackEvent[] {
    const groups = new Map<string, AttackEvent>()
    const sorted = items
      .slice()
      .sort((first, second) => getAttackTimestamp(second) - getAttackTimestamp(first))

    for (const attack of sorted) {
      const key = getLiveFeedKey(attack)
      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, { ...attack })
        continue
      }
      existing.aggregate_count = getAttackWeight(existing) + getAttackWeight(attack)
    }

    return [...groups.values()]
  }

  function setMapAttackItems(items: AttackEvent[]): void {
    mapAttacks.value = items
      .slice()
      .sort(sortByWeightAndTime)
      .slice(0, MAX_MAP_ATTACKS)
    rebuildMapAttackIndex()
    mapDatasetSequence.value += 1
  }

  function upsertMapAttack(event: AttackEvent): void {
    const key = getAttackPathKey(event)
    const existing = mapAttackIndex.get(key)
    if (!existing) {
      mapAttackIndex.set(key, {
        ...event,
        aggregate_key: key,
        aggregate_count: 1,
        first_seen: event.event_time,
        last_seen: event.event_time,
        latest_event_id: event.id,
      })
      return
    }

    const existingTime = getAttackTimestamp(existing)
    const eventTime = getAttackTimestamp(event)
    existing.aggregate_count = getAttackWeight(existing) + 1
    existing.last_seen = eventTime >= existingTime ? event.event_time : existing.last_seen
    if (eventTime >= existingTime) {
      Object.assign(existing, {
        ...event,
        aggregate_key: key,
        aggregate_count: existing.aggregate_count,
        first_seen: existing.first_seen || event.event_time,
        last_seen: event.event_time,
        latest_event_id: event.id,
      })
    }
  }

  function commitMapAttackIndex(): void {
    mapAttacks.value = [...mapAttackIndex.values()]
      .sort(sortByWeightAndTime)
      .slice(0, MAX_MAP_ATTACKS)
    rebuildMapAttackIndex()
  }

  function pruneExpiredMapAttacks(now = Date.now()): void {
    if (timeRange.value === 'all' || mapAttacks.value.length === 0) return

    const currentItems = mapAttacks.value
    const activeItems = currentItems.filter((attack) => matchesTimeRange(attack, now))
    if (activeItems.length === currentItems.length) return

    mapAttacks.value = activeItems
    rebuildMapAttackIndex()
    mapDatasetSequence.value += 1
  }

  function pruneExpiredBottomPanelData(now = Date.now()): void {
    const keepRecent = (attack: AttackEvent) => isInsideRollingWindow(attack, now)

    attacks.value = attacks.value.filter(keepRecent)
    latestAttacks.value = latestAttacks.value.filter(keepRecent)
    visibleFeedRows.value = visibleFeedRows.value.filter(keepRecent)
    rebuildAttackIds()

    for (let index = pendingDisplayQueue.length - 1; index >= 0; index -= 1) {
      if (!keepRecent(pendingDisplayQueue[index]!.attack)) {
        pendingDisplayQueue.splice(index, 1)
      }
    }
    pendingFeedQueueSize.value = pendingDisplayQueue.length

    for (let index = pendingAttackQueue.length - 1; index >= 0; index -= 1) {
      if (!keepRecent(pendingAttackQueue[index]!)) {
        pendingAttackQueue.splice(index, 1)
      }
    }
    pendingAttackQueueSize.value = pendingAttackQueue.length

    pruneExpiredMapAttacks(now)

    if (selectedAttackId.value && !findAttackById(selectedAttackId.value)) {
      selectedAttackId.value = null
    }
    if (detailAttackId.value && !findAttackById(detailAttackId.value)) {
      detailAttackId.value = null
    }
  }

  async function synchronizeRollingWindow(): Promise<void> {
    pruneExpiredBottomPanelData()
    await Promise.allSettled([
      loadHeaderSummary(),
      loadDashboardAttacks('24h'),
      loadMapAttacks('24h'),
      loadTopIps('24h'),
      loadTopCountries('24h'),
    ])
    lastUpdatedAt.value = new Date().toISOString()
  }

  async function refreshRollingWindowData(): Promise<void> {
    pruneExpiredBottomPanelData()
    await Promise.allSettled([
      loadHeaderSummary(),
      loadDashboardAttacks('24h'),
      loadMapAttacks('24h'),
      loadLatestAttacks(),
      loadTopIps('24h'),
      loadTopCountries('24h'),
    ])
    lastUpdatedAt.value = new Date().toISOString()
  }

  async function loadMapAttacks(_range: TimeRange = timeRange.value): Promise<void> {
    const result = await getMapAttackAggregateWindow('24h', MAX_MAP_ATTACKS)
    setAttackWindow(result.windowStart, result.windowEnd)
    setMapAttackItems(result.items)
  }

  async function loadDashboardAttacks(_range: TimeRange = timeRange.value): Promise<void> {
    const result = await getAttackWindow('24h')
    setAttackWindow(result.windowStart, result.windowEnd)
    setRawAttacks(result.items)
  }

  async function loadLatestAttacks(): Promise<void> {
    const result = await getLatestAttacksWindow(MAX_LATEST_ATTACKS, '24h')
    setAttackWindow(result.windowStart, result.windowEnd)
    setLatestAttackItems(result.items)
    stageInitialFeedItems(result.items)
  }

  async function loadHeaderSummary(): Promise<void> {
    try {
      headerSummary.value = await getSummary()
    } catch {
      // Keep the last database summary visible when a transient refresh fails.
    }
  }

  function getDataLoadErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : DATA_LOAD_ERROR_MESSAGE
  }

  function firstRejectedReason(results: PromiseSettledResult<unknown>[]): unknown {
    return results.find((result) => result.status === 'rejected')?.reason
  }

  function setAttackWindow(windowStart: string | null, windowEnd: string | null): void {
    if (windowStart) attackWindowStart.value = windowStart
    if (windowEnd) attackWindowEnd.value = windowEnd
  }

  function updateDisplaySummary(now = Date.now()): void {
    let removedExpiredEvent = false
    for (const [id, event] of rollingSummaryEvents) {
      if (now - event.receivedAt > ROLLING_SUMMARY_WINDOW_MS) {
        rollingSummaryEvents.delete(id)
        removedExpiredEvent = true
      }
    }
    displaySummary.value = calculateRollingSummary(
      rollingSummaryEvents.values(),
      now,
    )
    if (removedExpiredEvent) scheduleSummaryPersistence()
  }

  function persistSummaryEvents(): void {
    if (summaryPersistTimer !== undefined) {
      window.clearTimeout(summaryPersistTimer)
      summaryPersistTimer = undefined
    }

    const buckets = new Map<number, [number, number, number]>()
    for (const event of rollingSummaryEvents.values()) {
      const receivedAt = Math.floor(event.receivedAt / SUMMARY_BUCKET_MS) * SUMMARY_BUCKET_MS
      const existing = buckets.get(receivedAt)
      const count = Math.max(1, Math.floor(event.count ?? 1))
      if (existing) {
        existing[1] += count
        existing[2] = Math.max(existing[2], event.timestamp)
      } else {
        buckets.set(receivedAt, [receivedAt, count, event.timestamp])
      }
    }

    try {
      window.sessionStorage.setItem(
        SUMMARY_STORAGE_KEY,
        JSON.stringify({
          version: SUMMARY_STORAGE_VERSION,
          buckets: [...buckets.values()],
        }),
      )
    } catch {
      // Counters remain functional when browser storage is unavailable or full.
    }
  }

  function scheduleSummaryPersistence(): void {
    if (summaryPersistTimer !== undefined) return
    summaryPersistTimer = window.setTimeout(
      persistSummaryEvents,
      SUMMARY_PERSIST_DELAY_MS,
    )
  }

  function restoreSummaryEvents(now = Date.now()): void {
    rollingSummaryEvents.clear()
    try {
      const storedValue = window.sessionStorage.getItem(SUMMARY_STORAGE_KEY)
      if (!storedValue) return
      const parsed = JSON.parse(storedValue) as {
        version?: number
        buckets?: unknown[]
      }
      if (parsed.version !== SUMMARY_STORAGE_VERSION || !Array.isArray(parsed.buckets)) return

      for (const bucket of parsed.buckets) {
        if (!Array.isArray(bucket) || bucket.length !== 3) continue
        const [receivedAt, count, timestamp] = bucket.map(Number)
        if (
          !Number.isFinite(receivedAt) ||
          !Number.isFinite(count) ||
          !Number.isFinite(timestamp) ||
          count <= 0 ||
          now - receivedAt < 0 ||
          now - receivedAt > ROLLING_SUMMARY_WINDOW_MS
        ) {
          continue
        }
        rollingSummaryEvents.set(`persisted:${receivedAt}`, {
          id: `persisted:${receivedAt}`,
          receivedAt,
          timestamp,
          count,
        })
      }
    } catch {
      // Ignore malformed or unavailable session storage.
    }
  }

  function recordSummaryEvents(events: AttackEvent[]): void {
    const receivedAt = Date.now()
    for (const event of events) {
      if (rollingSummaryEvents.has(event.id)) continue
      rollingSummaryEvents.set(event.id, {
        id: event.id,
        timestamp: getRollingEventTimestamp(event, receivedAt),
        receivedAt,
      })
    }
    updateDisplaySummary(receivedAt)
    scheduleSummaryPersistence()
  }

  function stopRuntimeTimers(): void {
    if (summaryTickTimer !== undefined) {
      window.clearInterval(summaryTickTimer)
      summaryTickTimer = undefined
    }
    if (summaryPersistTimer !== undefined) {
      window.clearTimeout(summaryPersistTimer)
      summaryPersistTimer = undefined
    }
    if (headerSummaryTimer !== undefined) {
      window.clearInterval(headerSummaryTimer)
      headerSummaryTimer = undefined
    }
    if (headerSummaryRefreshTimer !== undefined) {
      window.clearTimeout(headerSummaryRefreshTimer)
      headerSummaryRefreshTimer = undefined
    }
    if (mapExpiryTimer !== undefined) {
      window.clearInterval(mapExpiryTimer)
      mapExpiryTimer = undefined
    }
    stopFeedDrainTimer()
  }

  function startRuntimeTimers(): void {
    stopRuntimeTimers()
    updateDisplaySummary()
    summaryTickTimer = window.setInterval(
      () => updateDisplaySummary(),
      SUMMARY_TICK_INTERVAL_MS,
    )
    headerSummaryTimer = window.setInterval(
      () => void loadHeaderSummary(),
      HEADER_SUMMARY_REFRESH_INTERVAL_MS,
    )
    mapExpiryTimer = window.setInterval(
      () => void synchronizeRollingWindow(),
      MAP_EXPIRY_SWEEP_INTERVAL_MS,
    )
    scheduleFeedDrain()
  }

  function handlePageVisible(): void {
    if (document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - lastVisibilityRefreshAt < VISIBILITY_REFRESH_THROTTLE_MS) return

    lastVisibilityRefreshAt = now
    connectWebSocket()
    void refreshRollingWindowData()
  }

  function bindPageSyncListeners(): void {
    window.removeEventListener('online', handlePageVisible)
    document.removeEventListener('visibilitychange', handlePageVisible)
    window.addEventListener('online', handlePageVisible)
    document.addEventListener('visibilitychange', handlePageVisible)
  }

  function unbindPageSyncListeners(): void {
    window.removeEventListener('online', handlePageVisible)
    document.removeEventListener('visibilitychange', handlePageVisible)
  }

  async function loadTopIps(_range: TimeRange = timeRange.value): Promise<void> {
    topIps.value = await getTopIps('24h', 10)
  }

  async function loadTopCountries(_range: TimeRange = timeRange.value): Promise<void> {
    topCountries.value = await getTopCountries('24h', 10)
  }

  function refreshHeaderSummarySoon(delay = HEADER_SUMMARY_REFRESH_DELAY_MS): void {
    if (headerSummaryRefreshTimer !== undefined) return
    headerSummaryRefreshTimer = window.setTimeout(() => {
      headerSummaryRefreshTimer = undefined
      void loadHeaderSummary()
    }, delay)
  }

  async function refreshRangeData(range: TimeRange = timeRange.value): Promise<void> {
    const runningRefresh = rangeRefreshPromises.get(range)
    if (runningRefresh) return runningRefresh

    const now = Date.now()
    const lastRefreshAt = lastRangeRefreshAt.get(range) ?? 0
    if (now - lastRefreshAt < RANGE_REFRESH_THROTTLE_MS) return

    panelLoading.value = true
    panelError.value = null
    const refreshPromise = (async () => {
      const results = await Promise.allSettled([
        loadDashboardAttacks(range),
        loadMapAttacks(range),
        loadLatestAttacks(),
        loadTopIps(range),
        loadTopCountries(range),
      ])
      const failedReason = firstRejectedReason(results)
      try {
        if (failedReason) {
          panelError.value = getDataLoadErrorMessage(failedReason)
          return
        }

        lastRangeRefreshAt.set(range, Date.now())
        lastUpdatedAt.value = new Date().toISOString()
      } finally {
        panelLoading.value = false
        rangeRefreshPromises.delete(range)
      }
    })()

    rangeRefreshPromises.set(range, refreshPromise)
    return refreshPromise
  }

  async function init(): Promise<void> {
    stopRuntimeTimers()
    panelLoading.value = true
    panelError.value = null
    disconnectWebSocket()
    cached.value = false
    restoreSummaryEvents()
    updateDisplaySummary()
    window.removeEventListener('pagehide', persistSummaryEvents)
    window.addEventListener('pagehide', persistSummaryEvents)
    bindPageSyncListeners()

    try {
      const results = await Promise.allSettled([
        loadHeaderSummary(),
        loadDashboardAttacks(timeRange.value),
        loadMapAttacks(timeRange.value),
        loadLatestAttacks(),
        loadTopIps(timeRange.value),
        loadTopCountries(timeRange.value),
      ])
      const failedReason = firstRejectedReason(results)
      if (failedReason) {
        panelError.value = getDataLoadErrorMessage(failedReason)
      } else {
        lastUpdatedAt.value = new Date().toISOString()
      }
      connectWebSocket()
    } catch (error) {
      panelError.value = getDataLoadErrorMessage(error)
      connectWebSocket()
    } finally {
      panelLoading.value = false
      startRuntimeTimers()
    }
  }

  function highlightAttack(id: string): void {
    if (highThroughputMode.value) return
    highlightedAttackId.value = id
    if (highlightTimer !== undefined) window.clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => {
      if (highlightedAttackId.value === id) highlightedAttackId.value = null
      highlightTimer = undefined
    }, 2000)
  }

  function updateHighThroughputState(): void {
    const now = Date.now()
    while (
      eventRateTimestamps.length &&
      now - eventRateTimestamps[0] > HIGH_THROUGHPUT_RATE_WINDOW_MS
    ) {
      eventRateTimestamps.shift()
    }
    receivedEventsLast10s.value = eventRateTimestamps.length

    const shouldEnter =
      receivedEventsLast10s.value > HIGH_THROUGHPUT_RATE_ENTER ||
      pendingAttackQueue.length > HIGH_THROUGHPUT_QUEUE_ENTER ||
      mapLayerCount.value > HIGH_THROUGHPUT_LAYER_ENTER

    if (shouldEnter) {
      highThroughputMode.value = true
      highThroughputEnteredAt = now
      return
    }

    if (
      highThroughputMode.value &&
      receivedEventsLast10s.value < HIGH_THROUGHPUT_RATE_EXIT &&
      pendingAttackQueue.length === 0 &&
      now - highThroughputEnteredAt > HIGH_THROUGHPUT_EXIT_AFTER_MS
    ) {
      highThroughputMode.value = false
    }
  }

  function recordIncomingRate(count: number): void {
    const now = Date.now()
    for (let index = 0; index < count; index += 1) {
      eventRateTimestamps.push(now)
    }
    updateHighThroughputState()
  }

  function mergeAttackBatch(events: AttackEvent[]): void {
    if (!events.length) return

    const uniqueEvents: AttackEvent[] = []
    for (const event of events) {
      if (attackIds.has(event.id)) continue
      if (!isInsideRollingWindow(event)) continue
      attackIds.add(event.id)
      uniqueEvents.push(event)
    }

    if (!uniqueEvents.length) return

    recordSummaryEvents(uniqueEvents)
    const newestFirst = uniqueEvents.slice().sort((first, second) => getAttackTimestamp(second) - getAttackTimestamp(first))
    attacks.value = [...newestFirst, ...attacks.value]
    rebuildAttackIds()

    setLatestAttackItems([...newestFirst, ...latestAttacks.value])
    enqueueFeedItems(newestFirst, 'prepend')
    refreshHeaderSummarySoon()

    lastUpdatedAt.value = newestFirst[0]?.event_time ?? lastUpdatedAt.value
    if (!highThroughputMode.value && newestFirst[0]) {
      highlightAttack(newestFirst[0].id)
    }
  }

  function processQueuedAttacks(): void {
    queueFrame = undefined
    const batch = pendingAttackQueue.splice(0, MAX_EVENTS_PER_FRAME)
    pendingAttackQueueSize.value = pendingAttackQueue.length
    mergeAttackBatch(batch)
    updateHighThroughputState()

    if (pendingAttackQueue.length > 0) {
      queueFrame = window.requestAnimationFrame(processQueuedAttacks)
    }
  }

  function enqueueAttackEvents(events: AttackEvent[]): void {
    if (!events.length) return
    pendingAttackQueue.push(...events)
    if (pendingAttackQueue.length > MAX_PENDING_ATTACK_QUEUE) {
      const dropped = pendingAttackQueue.length - MAX_PENDING_ATTACK_QUEUE
      pendingAttackQueue.splice(0, dropped)
      pendingAttackDroppedCount.value += dropped
    }
    pendingAttackQueueSize.value = pendingAttackQueue.length
    recordIncomingRate(events.length)
    if (queueFrame === undefined) {
      queueFrame = window.requestAnimationFrame(processQueuedAttacks)
    }
  }

  function addAttack(event: AttackEvent): void {
    mergeAttackBatch([event])
  }

  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword
  }

  function selectProtocol(protocol: ProtocolType): void {
    selectedProtocol.value = selectedProtocol.value === protocol ? null : protocol
  }

  function clearProtocolFilter(): void {
    selectedProtocol.value = null
  }

  function selectCountry(country: string | null): void {
    selectedCountry.value = selectedCountry.value === country ? null : country
  }

  function selectSourceIp(ip: string | null): void {
    selectedSourceIp.value = selectedSourceIp.value === ip ? null : ip
  }

  function selectHoneypot(honeypot: string | null): void {
    selectedHoneypot.value = selectedHoneypot.value === honeypot ? null : honeypot
  }

  function selectAction(action: string | null): void {
    selectedAction.value = selectedAction.value === action ? null : action
  }

  function selectReputation(reputation: string | null): void {
    selectedReputation.value = selectedReputation.value === reputation ? null : reputation
  }

  function selectAttack(id: string): void {
    selectedAttackId.value = id
    selectedAttackFocusSequence.value += 1
    if (detailAttackId.value) detailAttackId.value = id
  }

  function openAttackDetail(id: string): void {
    selectedAttackId.value = id
    selectedAttackFocusSequence.value += 1
    detailAttackId.value = id
  }

  function clearSelectedAttack(): void {
    detailAttackId.value = null
    selectedAttackId.value = null
  }

  function setMapAutoFocus(enabled: boolean): void {
    mapAutoFocus.value = enabled
  }

  function setMaxLiveFeedRows(value: number): void {
    maxLiveFeedRows.value = Math.max(10, Math.min(MAX_LATEST_ATTACKS, Math.round(value)))
  }

  function clearAllFilters(): void {
    searchKeyword.value = ''
    selectedProtocol.value = null
    selectedCountry.value = null
    selectedSourceIp.value = null
    selectedHoneypot.value = null
    selectedAction.value = null
    selectedReputation.value = null
  }

  function removeFilter(key: FilterKey): void {
    if (key === 'protocol') selectedProtocol.value = null
    if (key === 'country') selectedCountry.value = null
    if (key === 'sourceIp') selectedSourceIp.value = null
    if (key === 'honeypot') selectedHoneypot.value = null
    if (key === 'action') selectedAction.value = null
    if (key === 'reputation') selectedReputation.value = null
    if (key === 'search') searchKeyword.value = ''
  }

  function connectWebSocket(): void {
    if (!stream) {
      stream = createAttackStream({
        onAttack: (event) => enqueueAttackEvents([event]),
        onAttackBatch: enqueueAttackEvents,
        onStatusChange: (status) => {
          connectionStatus.value = status
          connected.value = status === 'connected'
        },
      })
    }
    stream.connect()
  }

  function disconnectWebSocket(): void {
    stream?.disconnect()
    stream = undefined
    connected.value = false
    connectionStatus.value = 'disconnected'
    if (highlightTimer !== undefined) {
      window.clearTimeout(highlightTimer)
      highlightTimer = undefined
    }
    if (queueFrame !== undefined) {
      window.cancelAnimationFrame(queueFrame)
      queueFrame = undefined
    }
    pendingAttackQueue.splice(0)
    pendingAttackQueueSize.value = 0
  }

  function dispose(): void {
    persistSummaryEvents()
    window.removeEventListener('pagehide', persistSummaryEvents)
    unbindPageSyncListeners()
    disconnectWebSocket()
    stopRuntimeTimers()
    pendingDisplayQueue.splice(0)
    pendingFeedQueueSize.value = 0
    rollingSummaryEvents.clear()
  }

  watch(filteredAttacks, recomputeStats, { immediate: true })

  return {
    connected,
    cached,
    connectionStatus,
    dataMode,
    attacks,
    mapAttacks,
    latestAttacks,
    displaySummary,
    headerSummary,
    visibleFeedRows,
    topIps,
    topCountries,
    timeRange,
    attackWindowStart,
    attackWindowEnd,
    searchKeyword,
    selectedProtocol,
    selectedCountry,
    selectedSourceIp,
    selectedHoneypot,
    selectedAction,
    selectedReputation,
    selectedAttackId,
    selectedAttackFocusSequence,
    detailAttackId,
    highlightedAttackId,
    mapAutoFocus,
    panelLoading,
    panelError,
    lastUpdatedAt,
    maxLiveFeedRows,
    filteredAttacks,
    filteredMapAttacks,
    filteredLatestAttacks,
    rangeSummary,
    filteredSummary,
    filteredTopIps,
    filteredTopCountries,
    protocolCounts,
    countryCounts,
    honeypotCounts,
    actionCounts,
    reputationCounts,
    attacksByTimeBucket,
    selectedAttack,
    activeFilters,
    hasActiveFilters,
    emptyWindowMessage,
    highlightedProtocol,
    highThroughputMode,
    pendingAttackQueueSize,
    pendingFeedQueueSize,
    pendingAttackDroppedCount,
    feedDisplayDroppedCount,
    receivedEventsLast10s,
    visualizationAttack,
    visualizationSequence,
    mapDatasetSequence,
    mapLayerCount,
    init,
    connectWebSocket,
    disconnectWebSocket,
    dispose,
    addAttack,
    setSearchKeyword,
    selectProtocol,
    clearProtocolFilter,
    selectCountry,
    selectSourceIp,
    selectHoneypot,
    selectAction,
    selectReputation,
    selectAttack,
    openAttackDetail,
    clearSelectedAttack,
    highlightAttack,
    setMapAutoFocus,
    setMaxLiveFeedRows,
    clearAllFilters,
    removeFilter,
    loadLatestAttacks,
    loadDashboardAttacks,
    loadHeaderSummary,
    loadTopIps,
    loadTopCountries,
    refreshRangeData,
    recomputeStats,
  }
})
