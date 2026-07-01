<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { apiBaseUrl, webSocketUrl } from '../api/client'
import { useAttackStore } from '../stores/attackStore'
import { useThemeStore } from '../stores/themeStore'
import { displayConnectionStatus, displayDataMode } from '../utils/attackDisplayText'
import { formatDateTime } from '../utils/dateTimeFormat'
import RollingNumber from './RollingNumber.vue'

const store = useAttackStore()
const themeStore = useThemeStore()
const {
  connectionStatus,
  dataMode,
  headerSummary,
  highThroughputMode,
  attackWindowStart,
  attackWindowEnd,
  lastUpdatedAt,
  mapAutoFocus,
  maxLiveFeedRows,
} = storeToRefs(store)
const { themeMode } = storeToRefs(themeStore)

const settingsOpen = ref(false)
const fullscreen = ref(Boolean(document.fullscreenElement))

const rollingCounters = [
  {
    key: '1m',
    label: '1分钟',
    title: '数据库真实最近 1 分钟攻击数',
    count: () => headerSummary.value.lastMinute,
  },
  {
    key: '1h',
    label: '1小时',
    title: '数据库真实最近 1 小时攻击数',
    count: () => headerSummary.value.lastHour,
  },
  {
    key: '24h',
    label: '24小时',
    title: '数据库真实最近 24 小时攻击数',
    count: () => headerSummary.value.last24Hours,
  },
]

const attackWindowTitle = computed(() => {
  if (!attackWindowStart.value || !attackWindowEnd.value) {
    return '滚动 24 小时攻击窗口：等待数据库同步'
  }
  return `滚动 24 小时攻击窗口：${formatDateTime(attackWindowStart.value)} 至 ${formatDateTime(attackWindowEnd.value)}`
})

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else {
    await document.documentElement.requestFullscreen()
  }
}

function handleFullscreenChange(): void {
  fullscreen.value = Boolean(document.fullscreenElement)
}

document.addEventListener('fullscreenchange', handleFullscreenChange)
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <header class="header-bar">
    <div class="brand">
      <svg class="brand__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          class="brand__icon-shield"
          d="M12 2.4 20 5.5v5.8c0 5-3.4 9.5-8 10.8-4.6-1.3-8-5.8-8-10.8V5.5L12 2.4Z"
        />
        <path class="brand__icon-line" d="M12 5.7v12.1" />
      </svg>
      <div>
        <strong>蜜罐攻击态势图</strong>
      </div>
    </div>

    <dl class="attack-summary" aria-label="数据库真实滚动攻击计数">
      <div
        v-for="counter in rollingCounters"
        :key="counter.key"
        class="attack-summary__item"
        :title="counter.title"
      >
        <dt>{{ counter.label }}</dt>
        <dd><RollingNumber :value="counter.count()" /></dd>
      </div>
    </dl>

    <div class="header-actions">
      <div class="header-status">
        <span class="status-pill" :class="`status-pill--${connectionStatus}`">
          <i class="status-dot" :class="`status-dot--${connectionStatus}`" />
          {{ displayConnectionStatus(connectionStatus) }}
        </span>
        <span class="status-pill status-pill--compact">
          {{ displayDataMode(dataMode) }}
        </span>
        <span
          v-if="highThroughputMode"
          class="status-pill status-pill--compact status-pill--throughput"
          title="高吞吐模式：已降低地图动画和批量处理实时事件"
        >
          <i class="status-dot status-dot--reconnecting" />
          高吞吐模式
        </span>
      </div>

      <button
        class="header-icon-button theme-toggle-button"
        type="button"
        :aria-label="themeMode === 'dark' ? '切换浅色模式' : '切换暗黑模式'"
        :title="themeMode === 'dark' ? '切换浅色模式' : '切换暗黑模式'"
        @click="themeStore.toggleTheme()"
      >
        <svg v-if="themeMode === 'dark'" class="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <svg v-else class="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      </button>
      <button
        class="header-icon-button"
        type="button"
        :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
        :title="fullscreen ? '退出全屏' : '进入全屏'"
        @click="toggleFullscreen"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      </button>
      <button
        class="header-icon-button header-settings-button"
        type="button"
        aria-label="打开设置"
        aria-controls="header-settings-popover"
        :aria-expanded="settingsOpen"
        title="设置"
        @click="settingsOpen = !settingsOpen"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h10M18 6h2M16 4v4M4 12h2M10 12h10M8 10v4M4 18h7M15 18h5M13 16v4" />
        </svg>
      </button>
    </div>

    <section
      v-if="settingsOpen"
      id="header-settings-popover"
      class="settings-popover"
    >
      <header>
        <strong>设置</strong>
        <button type="button" aria-label="关闭设置" @click="settingsOpen = false">×</button>
      </header>
      <label class="settings-toggle">
        <strong>启用地图自动聚焦</strong>
        <input type="checkbox" :checked="mapAutoFocus" @change="store.setMapAutoFocus(($event.target as HTMLInputElement).checked)">
      </label>
      <label class="settings-field">
        <span>实时日志最大行数</span>
        <input type="number" min="10" max="300" :value="maxLiveFeedRows" @change="store.setMaxLiveFeedRows(Number(($event.target as HTMLInputElement).value))">
      </label>
      <dl class="settings-runtime">
        <div><dt>数据模式</dt><dd>{{ displayDataMode(dataMode) }}</dd></div>
        <div><dt>API 地址</dt><dd>{{ apiBaseUrl }}</dd></div>
        <div><dt>WebSocket 地址</dt><dd>{{ webSocketUrl }}</dd></div>
        <div><dt>攻击窗口</dt><dd>{{ attackWindowTitle }}</dd></div>
        <div><dt>最后更新</dt><dd>{{ lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '等待数据' }}</dd></div>
      </dl>
      <div class="settings-actions">
        <button type="button" @click="settingsOpen = false">取消</button>
        <button type="button" class="settings-save" @click="settingsOpen = false">保存</button>
      </div>
    </section>
  </header>
</template>
