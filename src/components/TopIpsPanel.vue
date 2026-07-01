<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import { useThemeStore } from '../stores/themeStore'
import { getChartThemeColors } from '../utils/chartTheme'
import { displayCountry, displayValue } from '../utils/attackDisplayText'
import { formatDateTime } from '../utils/dateTimeFormat'
import { init, type ECharts } from '../utils/echartsModules'
import CountryFlag from './CountryFlag.vue'

const store = useAttackStore()
const themeStore = useThemeStore()
const { topIps, emptyWindowMessage, panelLoading, selectedSourceIp } = storeToRefs(store)
const { themeMode } = storeToRefs(themeStore)
const chartElement = ref<HTMLElement | null>(null)
let chart: ECharts | undefined
let activateFrame: number | undefined

const rows = computed(() =>
  topIps.value
    .slice()
    .sort((a, b) => b.hits - a.hits),
)

function renderChart(): void {
  const items = rows.value.slice(0, 10)
  const colors = getChartThemeColors()
  chart?.setOption({
    animationDuration: 350,
    grid: { top: 12, right: 28, bottom: 24, left: 12, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.border,
      textStyle: { color: colors.text },
      formatter: '{b}<br/>攻击次数：{c}',
    },
    xAxis: {
      type: 'value',
      name: '次数',
      minInterval: 1,
      nameTextStyle: { color: colors.axis },
      axisLabel: { color: colors.axis },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: items.map((item) => item.ip),
      axisLabel: {
        color: colors.text,
        fontFamily: 'monospace',
        interval: 0,
        hideOverlap: false,
        width: 118,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: '攻击次数',
      type: 'bar',
      data: items.map((item) => item.hits),
      barWidth: 12,
      barCategoryGap: '35%',
      itemStyle: { color: colors.accent, borderRadius: [0, 6, 6, 0] },
    }],
  }, true)
}

function handleChartClick(params: { name?: string }): void {
  if (params.name) store.selectSourceIp(params.name)
}

function resize(): void {
  chart?.resize()
}

watch(rows, renderChart, { deep: true })
watch(themeMode, renderChart)
onActivated(() => {
  if (activateFrame !== undefined) window.cancelAnimationFrame(activateFrame)
  activateFrame = window.requestAnimationFrame(() => {
    resize()
    activateFrame = undefined
  })
})

onMounted(() => {
  if (chartElement.value) {
    chart = init(chartElement.value)
    chart.on('click', handleChartClick)
  }
  renderChart()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  if (activateFrame !== undefined) window.cancelAnimationFrame(activateFrame)
  window.removeEventListener('resize', resize)
  chart?.dispose()
})
</script>

<template>
  <section class="ranking-panel">
    <div v-if="panelLoading" class="panel-state">正在加载攻击源 IP 统计...</div>
    <div v-else-if="rows.length === 0" class="panel-state">
      {{ emptyWindowMessage || '当前筛选条件下暂无攻击源 IP 数据' }}
    </div>
    <div v-else class="ranking-layout">
      <div ref="chartElement" class="ranking-chart" aria-label="攻击源 IP 排行图表" />
      <div class="data-table-wrap ranking-table-wrap">
        <table class="data-table ranking-table">
          <thead>
            <tr><th>排名</th><th>攻击源 IP</th><th>国家</th><th>次数</th><th>最近出现</th><th>信誉</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in rows"
              :key="item.ip"
              :class="{ 'data-table__row--selected': selectedSourceIp === item.ip }"
              @click="store.selectSourceIp(item.ip)"
            >
              <td class="rank-cell">{{ index + 1 }}</td>
              <td class="cell-ip">{{ item.ip }}</td>
              <td><CountryFlag :code="item.countryCode" :country="item.country" /> {{ displayCountry(item.country) }}</td>
              <td class="hits-cell">{{ item.hits }}</td>
              <td>{{ formatDateTime(item.lastSeen) }}</td>
              <td>{{ displayValue(item.reputation) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
