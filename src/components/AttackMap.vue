<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import L, {
  type CircleMarker,
  type LayerGroup,
  type Map as LeafletMap,
  type Point,
  type Renderer,
  type TileLayer,
} from 'leaflet'
import { useAttackStore } from '../stores/attackStore'
import { useThemeStore, type ThemeMode } from '../stores/themeStore'
import type { AttackEvent } from '../types/attack'
import {
  displayCity,
  displayCountry,
  displayHoneypot,
  displayValue,
} from '../utils/attackDisplayText'
import { formatTime } from '../utils/dateTimeFormat'
import { chineseMapLabels, type ChineseMapLabel } from '../utils/mapLabels'
import { parseAttackTime } from '../utils/parseTime'
import { createAttackPathKey } from '../utils/attackProtocol'
import { getProtocolColor } from '../utils/protocolColors'
import { getAttackSourceFocusTarget } from '../utils/mapFocus'
import {
  ATTACK_DRAW_MS,
  ATTACK_FADE_MS,
  createAttackPathThrottle,
  hasVisibleAttackPath,
} from '../utils/attackAnimation'

interface CurveGeometry {
  source: Point
  control: Point
  target: Point
  pathD: string
  pathLength: number
}

interface TransientAnimation {
  frameId: number
  group: SVGGElement
}

interface AttackLayerStats {
  count: number
  lastSeen: string
  latestAttack: AttackEvent
}

interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}

interface MapTileConfig {
  url: string
  attribution: string
  className: string
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const MAX_SOURCE_MARKERS = 1000
const MAX_ACTIVE_ANIMATIONS = 200
const MIN_CURVE_OFFSET_PX = 35
const MAX_CURVE_OFFSET_PX = 160
const DEFAULT_DARK_MAP_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
const DEFAULT_LIGHT_MAP_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
const DEFAULT_MAP_ATTRIBUTION =
  '地图数据 &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap 贡献者</a>，底图 &copy; <a href="https://carto.com/">CARTO</a>'
const SHARED_MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL?.trim() || ''
const SHARED_MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_MAP_ATTRIBUTION
const MAP_PROVIDER_KEY = import.meta.env.VITE_MAP_PROVIDER_KEY?.trim() || ''
const SHARED_MAP_LABEL_TILE_URL = import.meta.env.VITE_MAP_LABEL_TILE_URL?.trim() || ''
const MAP_LABEL_ATTRIBUTION = import.meta.env.VITE_MAP_LABEL_ATTRIBUTION?.trim() || ''
const MAP_LABEL_SUBDOMAINS = import.meta.env.VITE_MAP_LABEL_SUBDOMAINS?.trim() || 'abc'
const MAP_TILE_LAYERS: Record<ThemeMode, MapTileConfig> = {
  dark: {
    url:
      import.meta.env.VITE_MAP_DARK_TILE_URL?.trim() ||
      SHARED_MAP_TILE_URL ||
      DEFAULT_DARK_MAP_TILE_URL,
    attribution:
      import.meta.env.VITE_MAP_DARK_TILE_ATTRIBUTION?.trim() ||
      SHARED_MAP_TILE_ATTRIBUTION,
    className: 'map-base-tiles map-base-tiles--dark',
  },
  light: {
    url:
      import.meta.env.VITE_MAP_LIGHT_TILE_URL?.trim() ||
      DEFAULT_LIGHT_MAP_TILE_URL,
    attribution:
      import.meta.env.VITE_MAP_LIGHT_TILE_ATTRIBUTION?.trim() ||
      SHARED_MAP_TILE_ATTRIBUTION,
    className: 'map-base-tiles map-base-tiles--light',
  },
}
const MAP_LABEL_TILE_URLS: Record<ThemeMode, string> = {
  dark:
    import.meta.env.VITE_MAP_DARK_LABEL_TILE_URL?.trim() ||
    SHARED_MAP_LABEL_TILE_URL,
  light:
    import.meta.env.VITE_MAP_LIGHT_LABEL_TILE_URL?.trim() ||
    SHARED_MAP_LABEL_TILE_URL,
}

const store = useAttackStore()
const themeStore = useThemeStore()
const { themeMode } = storeToRefs(themeStore)
const mapShellElement = ref<HTMLElement | null>(null)
const mapElement = ref<HTMLElement | null>(null)
const isMapFullscreen = ref(false)

let map: LeafletMap | undefined
let baseTileLayer: TileLayer | undefined
let sourceRenderer: Renderer | undefined
let sourceMarkersLayer: LayerGroup | undefined
let targetMarkerLayer: LayerGroup | undefined
let geographicLabelsLayer: LayerGroup | undefined
let providerLabelsLayer: TileLayer | undefined
let transientAttackLayer: SVGGElement | undefined
let curveSvgRoot: SVGSVGElement | undefined
let fullscreenControl: L.Control | undefined
let fullscreenButton: HTMLButtonElement | undefined
let fullscreenResizeFrame: number | undefined
let fullscreenResizeTimer: number | undefined
let liveLabelRefreshTimer: number | undefined
let usingFullscreenFallback = false

const sourceMarkers = new Map<string, CircleMarker>()
const sourceAttackStats = new Map<string, AttackLayerStats>()
const activeAnimations = new Map<string, TransientAnimation>()
const attackPathThrottle = createAttackPathThrottle(MAX_SOURCE_MARKERS * 2)

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character]!,
  )
}

function createChineseLabelIcon(label: ChineseMapLabel): L.DivIcon {
  const offsetX = label.offsetX ?? 0
  const offsetY = label.offsetY ?? 0
  return L.divIcon({
    className: 'map-cn-label-wrapper',
    html: `<span class="map-cn-label map-cn-label--${label.kind}" style="--map-label-offset-x:${offsetX}px;--map-label-offset-y:${offsetY}px">${escapeHtml(label.text)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function createTargetIcon(): L.DivIcon {
  return L.divIcon({
    className: 'honeypot-target-icon',
    html: `
      <span class="honeypot-pin">
        <svg viewBox="0 0 32 44" aria-hidden="true">
          <path d="M16 1C8.3 1 2 7.2 2 15c0 10.5 14 27 14 27s14-16.5 14-27C30 7.2 23.7 1 16 1Z"/>
          <circle cx="16" cy="15" r="6"/>
        </svg>
      </span>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 42],
    tooltipAnchor: [0, -38],
  })
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function createAttackCityLabels(): ChineseMapLabel[] {
  const labels = new Map<string, ChineseMapLabel>()

  for (const attack of store.filteredMapAttacks) {
    const sourceCity = displayCity(attack.src_city)
    const sourceKey = `source:${displayCountry(attack.src_country)}:${sourceCity}`

    if (
      sourceCity !== '未知' &&
      !labels.has(sourceKey) &&
      isValidCoordinate(attack.src_latitude, attack.src_longitude)
    ) {
      labels.set(sourceKey, {
        text: sourceCity,
        latitude: attack.src_latitude,
        longitude: attack.src_longitude,
        kind: 'attack-city',
        minZoom: 3,
        maxZoom: 12,
        priority: 130,
        offsetX: 10,
        offsetY: -28,
      })
    }

    const targetCity = displayCity(attack.target_city)
    const targetKey = `target:${displayCountry(attack.target_country)}:${targetCity}`

    if (
      targetCity !== '未知' &&
      !labels.has(targetKey) &&
      isValidCoordinate(attack.target_latitude, attack.target_longitude)
    ) {
      labels.set(targetKey, {
        text: targetCity,
        latitude: attack.target_latitude,
        longitude: attack.target_longitude,
        kind: 'target-city',
        minZoom: 2,
        maxZoom: 12,
        priority: 140,
        offsetX: 12,
        offsetY: -72,
      })
    }
  }

  return [...labels.values()]
}

function getLabelBox(label: ChineseMapLabel, point: Point, zoom: number): LabelBox {
  const characterCount = [...label.text].length
  const fontSize =
    label.kind === 'continent'
      ? 17
      : label.kind === 'ocean'
        ? 13
        : label.kind === 'country'
          ? 10
        : label.kind === 'attack-city' || label.kind === 'target-city'
            ? 11
          : label.kind === 'china-city'
            ? zoom >= 7
              ? 11
              : 10
            : label.kind === 'region'
              ? 9
              : 8
  const width = Math.max(20, characterCount * fontSize * 1.08 + 10)
  const height = fontSize + (zoom <= 3 ? 9 : 6)
  const centerX = point.x + (label.offsetX ?? 0)
  const centerY = point.y + (label.offsetY ?? 0)

  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  }
}

function boxesOverlap(first: LabelBox, second: LabelBox, padding: number): boolean {
  return !(
    first.right + padding < second.left ||
    first.left - padding > second.right ||
    first.bottom + padding < second.top ||
    first.top - padding > second.bottom
  )
}

function shouldShowLabelAtZoom(label: ChineseMapLabel, zoom: number): boolean {
  if (zoom < label.minZoom || zoom > label.maxZoom) return false

  if (label.kind === 'attack-city' || label.kind === 'target-city') {
    return true
  }

  if (label.kind === 'china-city') {
    if (zoom <= 3) return label.priority >= 97
    if (zoom <= 5) return label.priority >= 84
    if (zoom <= 7) return label.priority >= 69
    return true
  }

  if (label.kind === 'city') {
    if (zoom <= 3) return label.priority >= 90
    if (zoom <= 5) return label.priority >= 82
    if (zoom <= 7) return label.priority >= 76
    return true
  }

  if (label.kind === 'district') {
    return zoom >= 8
  }

  return true
}

function getVisibleChineseLabels(zoom: number): ChineseMapLabel[] {
  const labels = [...createAttackCityLabels(), ...chineseMapLabels]
    .filter((label) => shouldShowLabelAtZoom(label, zoom))
    .sort((first, second) => second.priority - first.priority)
  const seenTexts = new Set<string>()

  return labels.filter((label) => {
    if (seenTexts.has(label.text)) return false
    seenTexts.add(label.text)
    return true
  })
}

function getAttackMarkerAvoidanceBoxes(size: Point): LabelBox[] {
  if (!map) return []

  const boxes: LabelBox[] = []
  const seenSources = new Set<string>()
  const seenTargets = new Set<string>()

  for (const attack of store.filteredMapAttacks) {
    const sourceKey = `${attack.src_latitude.toFixed(4)}:${attack.src_longitude.toFixed(4)}`
    if (!seenSources.has(sourceKey)) {
      seenSources.add(sourceKey)
      const point = map.latLngToContainerPoint([
        attack.src_latitude,
        attack.src_longitude,
      ])
      if (point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y) {
        boxes.push({
          left: point.x - 8,
          right: point.x + 8,
          top: point.y - 8,
          bottom: point.y + 8,
        })
      }
    }

    const targetKey = `${attack.target_latitude.toFixed(4)}:${attack.target_longitude.toFixed(4)}`
    if (!seenTargets.has(targetKey)) {
      seenTargets.add(targetKey)
      const point = map.latLngToContainerPoint([
        attack.target_latitude,
        attack.target_longitude,
      ])
      if (point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y) {
        boxes.push({
          left: point.x - 18,
          right: point.x + 18,
          top: point.y - 46,
          bottom: point.y + 6,
        })
      }
    }
  }

  return boxes
}

function renderChineseMapLabels(): void {
  if (!map || !geographicLabelsLayer) return

  geographicLabelsLayer.clearLayers()
  const zoom = map.getZoom()
  const worldOffsets = zoom <= 2 ? [-360, 0, 360] : [0]
  const bounds = map.getBounds().pad(0.12)
  const size = map.getSize()
  const occupiedBoxes = getAttackMarkerAvoidanceBoxes(size)
  const collisionPadding = zoom <= 3 ? 5 : zoom <= 6 ? 3 : 1
  const viewportPadding = 60

  for (const label of getVisibleChineseLabels(zoom)) {
    for (const longitudeOffset of worldOffsets) {
      const position = L.latLng(label.latitude, label.longitude + longitudeOffset)
      if (!bounds.contains(position)) continue

      const point = map.latLngToContainerPoint(position)
      if (
        point.x < -viewportPadding ||
        point.y < -viewportPadding ||
        point.x > size.x + viewportPadding ||
        point.y > size.y + viewportPadding
      ) {
        continue
      }

      const box = getLabelBox(label, point, zoom)
      if (occupiedBoxes.some((occupied) => boxesOverlap(box, occupied, collisionPadding))) {
        continue
      }

      occupiedBoxes.push(box)
      L.marker(position, {
        pane: 'geographicLabelsPane',
        icon: createChineseLabelIcon(label),
        interactive: false,
        keyboard: false,
      }).addTo(geographicLabelsLayer)
    }
  }
}

function resolveProviderUrl(url: string): string | null {
  if (!url) return null
  if (url.includes('{key}') && !MAP_PROVIDER_KEY) return null
  return url.replaceAll('{key}', encodeURIComponent(MAP_PROVIDER_KEY))
}

function getBaseTileConfig(mode: ThemeMode): MapTileConfig {
  const configured = MAP_TILE_LAYERS[mode]
  const resolvedUrl = resolveProviderUrl(configured.url)

  return {
    ...configured,
    url:
      resolvedUrl ??
      (mode === 'dark' ? DEFAULT_DARK_MAP_TILE_URL : DEFAULT_LIGHT_MAP_TILE_URL),
  }
}

function scheduleMapInvalidate(): void {
  if (fullscreenResizeFrame !== undefined) {
    window.cancelAnimationFrame(fullscreenResizeFrame)
  }
  if (fullscreenResizeTimer !== undefined) {
    window.clearTimeout(fullscreenResizeTimer)
  }

  fullscreenResizeFrame = window.requestAnimationFrame(() => {
    map?.invalidateSize({ animate: false })
    handleMapResize()
    fullscreenResizeFrame = undefined
  })
  fullscreenResizeTimer = window.setTimeout(() => {
    map?.invalidateSize({ animate: false })
    handleMapResize()
    fullscreenResizeTimer = undefined
  }, 220)
}

function applyThemeTileLayer(): void {
  if (!map) return

  const mode = themeMode.value
  const tileConfig = getBaseTileConfig(mode)

  baseTileLayer?.remove()
  providerLabelsLayer?.remove()

  baseTileLayer = L.tileLayer(tileConfig.url, {
    attribution: tileConfig.attribution,
    className: tileConfig.className,
    maxZoom: 20,
    minZoom: 2,
    pane: 'tilePane',
    subdomains: 'abcd',
  }).addTo(map)

  const configuredLabelTileUrl = resolveProviderUrl(MAP_LABEL_TILE_URLS[mode])
  if (configuredLabelTileUrl) {
    providerLabelsLayer = L.tileLayer(configuredLabelTileUrl, {
      attribution: MAP_LABEL_ATTRIBUTION || undefined,
      className: `map-provider-label-tiles map-provider-label-tiles--${mode}`,
      maxZoom: 20,
      minZoom: 2,
      opacity: 0.82,
      pane: 'geographicLabelTilesPane',
      subdomains: MAP_LABEL_SUBDOMAINS,
    }).addTo(map)
  } else {
    providerLabelsLayer = undefined
  }

  scheduleMapInvalidate()
}

function updateFullscreenButtonState(): void {
  if (!fullscreenButton) return

  const label = isMapFullscreen.value ? '退出全屏地图' : '全屏地图'
  fullscreenButton.title = label
  fullscreenButton.setAttribute('aria-label', label)
  fullscreenButton.setAttribute('aria-pressed', String(isMapFullscreen.value))
  fullscreenButton.innerHTML = isMapFullscreen.value
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3v6H3M15 3v6h6M21 15h-6v6M3 15h6v6"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path>
      </svg>
    `
}

function setFullscreenFallback(enabled: boolean): void {
  usingFullscreenFallback = enabled
  isMapFullscreen.value = enabled
  mapShellElement.value?.classList.toggle('map-fullscreen-fallback', enabled)
  updateFullscreenButtonState()
  scheduleMapInvalidate()
}

async function toggleMapFullscreen(): Promise<void> {
  const shell = mapShellElement.value
  if (!shell) return

  if (document.fullscreenEnabled && typeof shell.requestFullscreen === 'function') {
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen()
      } else {
        await shell.requestFullscreen()
      }
      return
    } catch {
      setFullscreenFallback(!usingFullscreenFallback)
      return
    }
  }

  setFullscreenFallback(!usingFullscreenFallback)
}

function handleFullscreenControlClick(event: Event): void {
  L.DomEvent.preventDefault(event)
  void toggleMapFullscreen()
}

function createFullscreenControl(): L.Control {
  const FullscreenControl = L.Control.extend({
    options: {
      position: 'topleft',
    },
    onAdd: () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control leaflet-control-fullscreen',
      )
      const button = L.DomUtil.create(
        'button',
        'leaflet-control-fullscreen-button',
        container,
      ) as HTMLButtonElement

      button.type = 'button'
      fullscreenButton = button
      updateFullscreenButtonState()
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)
      L.DomEvent.on(button, 'click', handleFullscreenControlClick)

      return container
    },
    onRemove: () => {
      if (fullscreenButton) {
        L.DomEvent.off(fullscreenButton, 'click', handleFullscreenControlClick)
      }
      fullscreenButton = undefined
    },
  })

  return new FullscreenControl()
}

function setZoomControlChineseLabels(): void {
  const zoomIn = mapElement.value?.querySelector('.leaflet-control-zoom-in')
  const zoomOut = mapElement.value?.querySelector('.leaflet-control-zoom-out')

  zoomIn?.setAttribute('title', '放大地图')
  zoomIn?.setAttribute('aria-label', '放大地图')
  zoomOut?.setAttribute('title', '缩小地图')
  zoomOut?.setAttribute('aria-label', '缩小地图')
}

function handleDocumentFullscreenChange(): void {
  const nativeFullscreen = document.fullscreenElement === mapShellElement.value
  if (!nativeFullscreen && usingFullscreenFallback) {
    mapShellElement.value?.classList.remove('map-fullscreen-fallback')
    usingFullscreenFallback = false
  }
  isMapFullscreen.value = nativeFullscreen || usingFullscreenFallback
  updateFullscreenButtonState()
  scheduleMapInvalidate()
}

function handleFullscreenEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && usingFullscreenFallback) {
    setFullscreenFallback(false)
  }
}

function addTooltipRow(
  wrapper: HTMLElement,
  label: string,
  value: string | number | undefined,
): void {
  const row = document.createElement('div')
  const key = document.createElement('span')
  const content = document.createElement('strong')
  row.className = 'attack-tooltip__row'
  key.textContent = label
  content.textContent = value === undefined || value === '' ? '-' : String(value)
  row.append(key, content)
  wrapper.append(row)
}

function createTooltip(attack: AttackEvent, stats?: AttackLayerStats): HTMLElement {
  const wrapper = document.createElement('div')
  const title = document.createElement('div')
  wrapper.className = 'attack-tooltip__content'
  title.className = 'attack-tooltip__title'
  title.textContent = `${attack.protocol} 攻击事件`
  wrapper.append(title)

  addTooltipRow(wrapper, '攻击源 IP', attack.src_ip)
  if (stats) {
    addTooltipRow(wrapper, '累计次数', stats.count)
    addTooltipRow(wrapper, '最后时间', formatTime(stats.lastSeen))
  }
  addTooltipRow(
    wrapper,
    '国家 / 城市',
    `${displayCountry(attack.src_country)} / ${displayCity(attack.src_city)}`,
  )
  addTooltipRow(
    wrapper,
    'ASN / AS 组织',
    [attack.src_asn, attack.src_as_org].filter(Boolean).join(' / '),
  )
  addTooltipRow(wrapper, '协议', attack.protocol)
  addTooltipRow(wrapper, '端口', attack.dest_port)
  addTooltipRow(wrapper, '蜜罐', displayHoneypot(attack.honeypot_type))
  addTooltipRow(wrapper, '动作', displayValue(attack.action))
  addTooltipRow(wrapper, '状态', displayValue(attack.status))
  addTooltipRow(wrapper, '用户名', attack.username)
  addTooltipRow(wrapper, '密码', attack.password)
  addTooltipRow(wrapper, 'IP 信誉', displayValue(attack.ip_reputation))
  addTooltipRow(wrapper, '事件时间', formatTime(attack.event_time))

  return wrapper
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  className: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, name)
  element.setAttribute('class', className)
  return element
}

function createCurveSvgRoot(): void {
  if (!map || curveSvgRoot) return

  const size = map.getSize()
  const svg = createSvgElement('svg', 'attack-curve-overlay')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', String(size.x))
  svg.setAttribute('height', String(size.y))

  transientAttackLayer = createSvgElement('g', 'transient-attack-layer')
  svg.append(transientAttackLayer)
  map.getPanes().overlayPane.append(svg)
  curveSvgRoot = svg
}

function getAttackTimestamp(attack: AttackEvent): number {
  const timestamp = parseAttackTime(attack.last_seen || attack.event_time || attack.event_time_cn)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getSourceMarkerKey(attack: AttackEvent): string {
  return attack.src_ip || `${attack.src_latitude.toFixed(4)}:${attack.src_longitude.toFixed(4)}`
}

function getAttackPathKey(attack: AttackEvent): string {
  return attack.aggregate_key || createAttackPathKey(attack)
}

function upsertAttackStats(
  collection: Map<string, AttackLayerStats>,
  key: string,
  attack: AttackEvent,
): AttackLayerStats {
  const existing = collection.get(key)
  const weight = Math.max(1, Number(attack.aggregate_count ?? 1))
  if (!existing) {
    const stats = {
      count: weight,
      lastSeen: attack.last_seen || attack.event_time,
      latestAttack: attack,
    }
    collection.set(key, stats)
    return stats
  }

  existing.count += weight
  if (getAttackTimestamp(attack) >= getAttackTimestamp(existing.latestAttack)) {
    existing.lastSeen = attack.last_seen || attack.event_time
    existing.latestAttack = attack
  }
  return existing
}

function recordAttackLayerStats(attack: AttackEvent): AttackLayerStats {
  return upsertAttackStats(sourceAttackStats, getSourceMarkerKey(attack), attack)
}

function getMarkerRadius(stats: AttackLayerStats, selected: boolean): number {
  if (selected) return 6
  return Math.min(7, 3.6 + Math.log10(stats.count + 1) * 1.2)
}

function getSelectedSourceMarkerKey(): string | null {
  if (!store.selectedAttackId) return null

  const selectedAttack = store.mapAttacks.find(
    (attack) => attack.id === store.selectedAttackId,
  ) ?? store.attacks.find((attack) => attack.id === store.selectedAttackId)
  if (!selectedAttack || !isVisibleForCurrentFilters(selectedAttack)) return null
  return getSourceMarkerKey(selectedAttack)
}

function isVisibleForCurrentFilters(attack: AttackEvent): boolean {
  return hasVisibleAttackPath(attack, store.filteredMapAttacks)
}

function upsertSourceMarker(attack: AttackEvent, assumeVisible = false): void {
  if (
    !sourceMarkersLayer ||
    !sourceRenderer ||
    (!assumeVisible && !isVisibleForCurrentFilters(attack))
  ) {
    return
  }

  const key = getSourceMarkerKey(attack)
  const stats = recordAttackLayerStats(attack)
  const color = getProtocolColor(attack.protocol)
  const source: L.LatLngExpression = [attack.src_latitude, attack.src_longitude]
  const existing = sourceMarkers.get(key)
  const isSelected = getSelectedSourceMarkerKey() === key
  const radius = getMarkerRadius(stats, isSelected)

  if (existing) {
    existing.setLatLng(source)
    existing.setRadius(radius)
    existing.setStyle({
      color,
      fillColor: color,
      fillOpacity: isSelected ? 1 : 0.82,
      opacity: 0.95,
      weight: isSelected ? 2.25 : 1,
    })
    if (isSelected) existing.bringToFront()
    existing.setPopupContent(createTooltip(stats.latestAttack, stats))
    existing.off('click')
    existing.on('click', () => store.openAttackDetail(stats.latestAttack.id))
    return
  }

  const marker = L.circleMarker(source, {
    pane: 'sourceMarkersPane',
    renderer: sourceRenderer,
    radius,
    color,
    fillColor: color,
    fillOpacity: isSelected ? 1 : 0.82,
    opacity: 0.95,
    weight: isSelected ? 2.25 : 1,
  })
    .bindPopup(createTooltip(stats.latestAttack, stats), {
      className: 'attack-popup',
      maxWidth: 340,
    })
    .on('click', () => store.openAttackDetail(stats.latestAttack.id))
    .addTo(sourceMarkersLayer)

  if (isSelected) marker.bringToFront()
  sourceMarkers.set(key, marker)
}

function refreshSelectedSourceMarker(): void {
  const selectedKey = getSelectedSourceMarkerKey()

  for (const [key, marker] of sourceMarkers) {
    const isSelected = key === selectedKey
    const stats = sourceAttackStats.get(key)
    marker.setRadius(stats ? getMarkerRadius(stats, isSelected) : isSelected ? 6 : 3.6)
    marker.setStyle({
      fillOpacity: isSelected ? 1 : 0.82,
      opacity: 0.95,
      weight: isSelected ? 2.25 : 1,
    })
    if (isSelected) marker.bringToFront()
  }
}

function rebuildSourceMarkers(): void {
  sourceMarkersLayer?.clearLayers()
  sourceMarkers.clear()
  sourceAttackStats.clear()

  store.filteredMapAttacks
    .slice()
    .sort((first, second) => {
      const firstCount = Number(first.aggregate_count ?? 1)
      const secondCount = Number(second.aggregate_count ?? 1)
      const countDiff = secondCount - firstCount
      if (countDiff !== 0) return countDiff
      return getAttackTimestamp(second) - getAttackTimestamp(first)
    })
    .slice(0, MAX_SOURCE_MARKERS)
    .reverse()
    .forEach((attack) => {
      upsertSourceMarker(attack, true)
    })
}

function getTargetMarkerKey(attack: AttackEvent): string {
  return [
    attack.target_public_ip || attack.target_internal_ip || attack.target_hostname || 'target',
    attack.target_latitude.toFixed(4),
    attack.target_longitude.toFixed(4),
  ].join('|')
}

function rebuildTargetMarkers(): void {
  if (!targetMarkerLayer) return

  targetMarkerLayer.clearLayers()
  const targets = new Map<string, AttackEvent>()
  for (const attack of store.filteredMapAttacks) {
    if (!isValidCoordinate(attack.target_latitude, attack.target_longitude)) continue
    const key = getTargetMarkerKey(attack)
    if (!targets.has(key)) targets.set(key, attack)
  }

  for (const attack of targets.values()) {
    const label = [
      attack.target_hostname || attack.target_public_ip || 'target',
      attack.target_city ? displayCity(attack.target_city) : '',
      attack.target_country ? displayCountry(attack.target_country) : '',
    ].filter(Boolean).join(' / ')

    L.marker([attack.target_latitude, attack.target_longitude], {
      icon: createTargetIcon(),
      pane: 'targetMarkerPane',
    })
      .bindTooltip(`蜜罐：${label}`, {
        direction: 'top',
        className: 'attack-tooltip',
      })
      .addTo(targetMarkerLayer)
  }
}

function calculateCurveGeometry(attack: AttackEvent): CurveGeometry | null {
  if (!map) return null

  const source = map.latLngToLayerPoint([attack.src_latitude, attack.src_longitude])
  const target = map.latLngToLayerPoint([attack.target_latitude, attack.target_longitude])
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)

  if (distance < 0.001) return null

  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2
  const normalX = -dy / distance
  const normalY = dx / distance
  const curveOffset = Math.min(
    MAX_CURVE_OFFSET_PX,
    Math.max(MIN_CURVE_OFFSET_PX, distance * 0.18),
  )
  const control = L.point(
    midX + normalX * curveOffset,
    midY + normalY * curveOffset,
  )

  return {
    source,
    control,
    target,
    pathD: `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`,
    pathLength: getQuadraticBezierLength(source, control, target),
  }
}

function getQuadraticBezierPoint(
  source: Point,
  control: Point,
  target: Point,
  progress: number,
): Point {
  const remaining = 1 - progress
  return L.point(
    remaining * remaining * source.x +
      2 * remaining * progress * control.x +
      progress * progress * target.x,
    remaining * remaining * source.y +
      2 * remaining * progress * control.y +
      progress * progress * target.y,
  )
}

function getQuadraticBezierLength(
  source: Point,
  control: Point,
  target: Point,
): number {
  const segments = 16
  let length = 0
  let previous = source
  for (let index = 1; index <= segments; index += 1) {
    const current = getQuadraticBezierPoint(
      source,
      control,
      target,
      index / segments,
    )
    length += current.distanceTo(previous)
    previous = current
  }
  return length
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3)
}

function removeTransientAnimation(key: string): void {
  const animation = activeAnimations.get(key)
  if (!animation) return

  window.cancelAnimationFrame(animation.frameId)
  animation.group.remove()
  activeAnimations.delete(key)
}

function clearTransientAnimations(): void {
  for (const id of [...activeAnimations.keys()]) {
    removeTransientAnimation(id)
  }
  transientAttackLayer?.replaceChildren()
}

function playAttackAnimation(attack: AttackEvent): void {
  if (!transientAttackLayer || !isVisibleForCurrentFilters(attack)) return

  const geometry = calculateCurveGeometry(attack)
  if (!geometry) return

  const animationKey = getAttackPathKey(attack)
  removeTransientAnimation(animationKey)
  while (activeAnimations.size >= MAX_ACTIVE_ANIMATIONS) {
    const [oldestKey] = activeAnimations.keys()
    if (!oldestKey) break
    removeTransientAnimation(oldestKey)
  }

  const color = getProtocolColor(attack.protocol)
  const group = createSvgElement('g', 'transient-attack')
  const path = createSvgElement('path', 'transient-curve-path')
  const particle = createSvgElement('circle', 'attack-flight-particle')
  const sourceRipple = createSvgElement('circle', 'attack-source-ripple')
  const targetPulse = createSvgElement('circle', 'attack-target-pulse')

  path.setAttribute('d', geometry.pathD)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', color)
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('stroke-opacity', '1')
  path.setAttribute('vector-effect', 'non-scaling-stroke')
  path.style.opacity = '0'

  particle.setAttribute('cx', String(geometry.source.x))
  particle.setAttribute('cy', String(geometry.source.y))
  particle.setAttribute('r', '4')
  particle.setAttribute('fill', color)
  particle.setAttribute('stroke', '#ffffff')
  particle.setAttribute('stroke-width', '1')
  particle.setAttribute('opacity', '1')
  particle.setAttribute('vector-effect', 'non-scaling-stroke')
  particle.style.opacity = '0'

  sourceRipple.setAttribute('cx', String(geometry.source.x))
  sourceRipple.setAttribute('cy', String(geometry.source.y))
  sourceRipple.setAttribute('r', '4')
  sourceRipple.setAttribute('fill', 'none')
  sourceRipple.setAttribute('stroke', color)
  sourceRipple.setAttribute('stroke-width', '2')
  sourceRipple.setAttribute('stroke-opacity', '0.85')
  sourceRipple.setAttribute('vector-effect', 'non-scaling-stroke')

  targetPulse.setAttribute('cx', String(geometry.target.x))
  targetPulse.setAttribute('cy', String(geometry.target.y))
  targetPulse.setAttribute('r', '5')
  targetPulse.setAttribute('fill', color)
  targetPulse.setAttribute('fill-opacity', '0')
  targetPulse.setAttribute('stroke', color)
  targetPulse.setAttribute('stroke-width', '1.5')
  targetPulse.setAttribute('stroke-opacity', '0')
  targetPulse.setAttribute('vector-effect', 'non-scaling-stroke')

  group.append(path, sourceRipple, targetPulse, particle)
  transientAttackLayer.append(group)

  const animation: TransientAnimation = {
    frameId: 0,
    group,
  }
  activeAnimations.set(animationKey, animation)

  animation.frameId = window.requestAnimationFrame((startedAt) => {
    if (!activeAnimations.has(animationKey)) return

    const pathLength = geometry.pathLength
    path.style.strokeDasharray = String(pathLength)
    path.style.strokeDashoffset = String(pathLength)
    path.style.opacity = '0.9'
    particle.style.opacity = '1'
    group.style.opacity = '1'

    const animate = (now: number): void => {
      if (!activeAnimations.has(animationKey)) return

      const elapsed = now - startedAt
      const drawProgress = Math.min(elapsed / ATTACK_DRAW_MS, 1)
      const eased = easeOutCubic(drawProgress)
      const particlePoint = getQuadraticBezierPoint(
        geometry.source,
        geometry.control,
        geometry.target,
        eased,
      )
      const sourceRippleProgress = Math.min(drawProgress / 0.38, 1)
      const targetPulseProgress = Math.max(
        0,
        Math.min((drawProgress - 0.62) / 0.38, 1),
      )
      const targetPulseWave = Math.sin(targetPulseProgress * Math.PI)

      path.style.strokeDashoffset = String(pathLength * (1 - eased))
      particle.setAttribute('cx', String(particlePoint.x))
      particle.setAttribute('cy', String(particlePoint.y))

      sourceRipple.setAttribute('r', String(4 + sourceRippleProgress * 24))
      sourceRipple.setAttribute(
        'stroke-opacity',
        String(0.85 * (1 - sourceRippleProgress)),
      )

      targetPulse.setAttribute('r', String(5 + targetPulseWave * 12))
      targetPulse.setAttribute('fill-opacity', String(targetPulseWave * 0.18))
      targetPulse.setAttribute('stroke-opacity', String(targetPulseWave * 0.75))

      if (elapsed > ATTACK_DRAW_MS) {
        const fadeProgress = Math.min(
          (elapsed - ATTACK_DRAW_MS) / ATTACK_FADE_MS,
          1,
        )
        group.style.opacity = String(1 - fadeProgress)

        if (fadeProgress >= 1) {
          removeTransientAnimation(animationKey)
          return
        }
      }

      animation.frameId = window.requestAnimationFrame(animate)
    }

    animation.frameId = window.requestAnimationFrame(animate)
  })
}

function shouldPlayAttackAnimation(attack: AttackEvent, now = Date.now()): boolean {
  return attackPathThrottle.shouldAllow(getAttackPathKey(attack), now)
}

function focusSelectedAttack(id: string): void {
  if (!map || !store.mapAutoFocus) return
  const attack =
    store.mapAttacks.find((item) => item.id === id) ??
    store.attacks.find((item) => item.id === id)
  if (!attack) return

  const focusTarget = getAttackSourceFocusTarget(attack, map.getZoom())
  if (!focusTarget) return

  map.flyTo(focusTarget.center, focusTarget.zoom, {
    animate: true,
    duration: 0.65,
  })
  sourceMarkers.get(getSourceMarkerKey(attack))?.openPopup()
}

function handleMapMotionStart(): void {
  clearTransientAnimations()
}

function handleMapMotionEnd(): void {
  renderChineseMapLabels()
}

function handleMapResize(): void {
  if (!map || !curveSvgRoot) return

  const size = map.getSize()
  curveSvgRoot.setAttribute('width', String(size.x))
  curveSvgRoot.setAttribute('height', String(size.y))
  clearTransientAnimations()
  renderChineseMapLabels()
}

function rebuildMapLayers(): void {
  rebuildSourceMarkers()
  rebuildTargetMarkers()
  renderChineseMapLabels()
}

function scheduleLiveLabelRefresh(): void {
  if (liveLabelRefreshTimer !== undefined) {
    window.clearTimeout(liveLabelRefreshTimer)
  }
  liveLabelRefreshTimer = window.setTimeout(() => {
    liveLabelRefreshTimer = undefined
    renderChineseMapLabels()
  }, ATTACK_DRAW_MS + ATTACK_FADE_MS + 100)
}

watch(
  () => store.visualizationSequence,
  () => {
    const attack = store.visualizationAttack
    if (!attack) return

    upsertSourceMarker(attack)
    rebuildTargetMarkers()
    if (shouldPlayAttackAnimation(attack)) {
      playAttackAnimation(attack)
    }
    scheduleLiveLabelRefresh()
  },
  { flush: 'sync' },
)

watch(() => store.mapDatasetSequence, rebuildMapLayers)

watch(
  () => [
    store.searchKeyword,
    store.selectedProtocol,
    store.selectedCountry,
    store.selectedSourceIp,
    store.selectedHoneypot,
    store.selectedAction,
    store.selectedReputation,
  ],
  () => {
    clearTransientAnimations()
    rebuildMapLayers()
  },
)

watch(
  () => [store.selectedAttackId, store.selectedAttackFocusSequence] as const,
  ([id]) => {
    refreshSelectedSourceMarker()
    if (id) {
      focusSelectedAttack(id)
    }
  },
)

watch(themeMode, () => {
  applyThemeTileLayer()
})

onMounted(() => {
  if (!mapElement.value || map) return

  map = L.map(mapElement.value, {
    center: [25, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 12,
    zoomControl: false,
    worldCopyJump: true,
    attributionControl: true,
  })

  map.attributionControl.setPrefix(false)
  map.createPane('geographicLabelTilesPane').style.zIndex = '325'
  map.getPane('geographicLabelTilesPane')!.style.pointerEvents = 'none'
  map.createPane('geographicLabelsPane').style.zIndex = '330'
  map.getPane('geographicLabelsPane')!.style.pointerEvents = 'none'
  map.createPane('sourceMarkersPane').style.zIndex = '410'
  map.createPane('targetMarkerPane').style.zIndex = '480'

  L.control.zoom({
    position: 'topleft',
    zoomInTitle: '放大地图',
    zoomOutTitle: '缩小地图',
  }).addTo(map)
  setZoomControlChineseLabels()
  fullscreenControl = createFullscreenControl().addTo(map)
  applyThemeTileLayer()

  sourceRenderer = L.canvas({
    pane: 'sourceMarkersPane',
    padding: 0.5,
  })
  sourceMarkersLayer = L.layerGroup().addTo(map)
  targetMarkerLayer = L.layerGroup().addTo(map)
  geographicLabelsLayer = L.layerGroup().addTo(map)
  createCurveSvgRoot()

  map.on('movestart zoomstart', handleMapMotionStart)
  map.on('moveend zoomend', handleMapMotionEnd)
  map.on('resize', handleMapResize)
  document.addEventListener('fullscreenchange', handleDocumentFullscreenChange)
  document.addEventListener('keydown', handleFullscreenEscape)
  renderChineseMapLabels()
  rebuildMapLayers()
})

onBeforeUnmount(() => {
  clearTransientAnimations()
  sourceMarkers.clear()
  sourceAttackStats.clear()
  attackPathThrottle.clear()
  sourceMarkersLayer?.clearLayers()
  targetMarkerLayer?.clearLayers()
  geographicLabelsLayer?.clearLayers()
  baseTileLayer?.remove()
  providerLabelsLayer?.remove()
  fullscreenControl?.remove()

  map?.off('movestart zoomstart', handleMapMotionStart)
  map?.off('moveend zoomend', handleMapMotionEnd)
  map?.off('resize', handleMapResize)
  document.removeEventListener('fullscreenchange', handleDocumentFullscreenChange)
  document.removeEventListener('keydown', handleFullscreenEscape)
  if (document.fullscreenElement === mapShellElement.value) {
    void document.exitFullscreen()
  }
  mapShellElement.value?.classList.remove('map-fullscreen-fallback')
  if (fullscreenResizeFrame !== undefined) {
    window.cancelAnimationFrame(fullscreenResizeFrame)
  }
  if (fullscreenResizeTimer !== undefined) {
    window.clearTimeout(fullscreenResizeTimer)
  }
  if (liveLabelRefreshTimer !== undefined) {
    window.clearTimeout(liveLabelRefreshTimer)
  }
  curveSvgRoot?.remove()
  map?.remove()

  map = undefined
  baseTileLayer = undefined
  sourceRenderer = undefined
  sourceMarkersLayer = undefined
  targetMarkerLayer = undefined
  geographicLabelsLayer = undefined
  providerLabelsLayer = undefined
  transientAttackLayer = undefined
  curveSvgRoot = undefined
  fullscreenControl = undefined
  fullscreenButton = undefined
  fullscreenResizeFrame = undefined
  fullscreenResizeTimer = undefined
  usingFullscreenFallback = false
})

function invalidateSize(): void {
  map?.invalidateSize({ animate: false })
  handleMapResize()
}

defineExpose({ invalidateSize })
</script>

<template>
  <div ref="mapShellElement" class="attack-map-shell">
    <div ref="mapElement" class="attack-map" aria-label="中文版全球攻击地图" />
    <div v-if="store.panelLoading" class="map-loading-overlay">正在加载地图事件...</div>
    <div v-else-if="store.panelError" class="map-loading-overlay map-loading-overlay--warning">
      数据加载失败，请检查 FastAPI 服务和 MySQL 数据库连接
    </div>
    <div v-else-if="store.emptyWindowMessage" class="map-loading-overlay map-loading-overlay--warning">
      {{ store.emptyWindowMessage }}
    </div>
  </div>
</template>
