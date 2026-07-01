<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import { useThemeStore } from '../stores/themeStore'
import type { ProtocolType } from '../types/attack'
import { getChartThemeColors } from '../utils/chartTheme'
import { displayHoneypot, displayValue } from '../utils/attackDisplayText'
import { getProtocolColor } from '../utils/protocolColors'
import { init, type ECharts } from '../utils/echartsModules'

interface ChartDatum {
  name: string
  value: number
  rawName?: string
}

const store = useAttackStore()
const themeStore = useThemeStore()
const { attacksByTimeBucket, filteredAttacks, panelLoading } = storeToRefs(store)
const { themeMode } = storeToRefs(themeStore)

const trendElement = ref<HTMLElement | null>(null)
const protocolElement = ref<HTMLElement | null>(null)
const actionElement = ref<HTMLElement | null>(null)
const reputationElement = ref<HTMLElement | null>(null)
const honeypotElement = ref<HTMLElement | null>(null)

let trendChart: ECharts | undefined
let protocolChart: ECharts | undefined
let actionChart: ECharts | undefined
let reputationChart: ECharts | undefined
let honeypotChart: ECharts | undefined
let activateFrame: number | undefined

function aggregate(value: (index: number) => string): ChartDatum[] {
  const counts = new Map<string, number>()
  filteredAttacks.value.forEach((_, index) => {
    const key = value(index) || 'unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts]
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => b.value - a.value)
}

const protocolData = computed(() => aggregate((index) => filteredAttacks.value[index]!.protocol))
const actionData = computed(() => aggregate((index) => filteredAttacks.value[index]!.action))
const reputationData = computed(() =>
  aggregate((index) => filteredAttacks.value[index]!.ip_reputation ?? 'unknown'),
)
const honeypotData = computed(() =>
  aggregate((index) => filteredAttacks.value[index]!.honeypot_type),
)

function renderCharts(): void {
  const colors = getChartThemeColors()
  const tooltip = {
    trigger: 'axis',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    textStyle: { color: colors.text, fontFamily: 'monospace', fontSize: 11 },
  }

  trendChart?.setOption({
    animationDuration: 350,
    grid: { top: 20, right: 18, bottom: 36, left: 42 },
    tooltip,
    xAxis: {
      type: 'category',
      data: attacksByTimeBucket.value.map((item) => item.time),
      axisLabel: { color: colors.axis, interval: 2 },
      axisLine: { lineStyle: { color: colors.border } },
    },
    yAxis: {
      type: 'value',
      name: '次数',
      minInterval: 1,
      nameTextStyle: { color: colors.axis },
      axisLabel: { color: colors.axis },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    series: [{
      name: '攻击次数',
      type: 'line',
      smooth: true,
      symbolSize: 5,
      data: attacksByTimeBucket.value.map((item) => item.count),
      lineStyle: { color: colors.accent, width: 2 },
      itemStyle: { color: colors.accent },
      areaStyle: { color: colors.accentArea },
    }],
  }, true)

  const protocols = protocolData.value.slice().reverse()
  protocolChart?.setOption({
    animationDuration: 350,
    grid: { top: 15, right: 25, bottom: 25, left: 75 },
    tooltip,
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
      data: protocols.map((item) => item.name),
      axisLabel: { color: colors.muted },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: '攻击次数',
      type: 'bar',
      barMaxWidth: 16,
      data: protocols.map((item) => ({
        value: item.value,
        itemStyle: { color: getProtocolColor(item.name) },
      })),
    }],
  }, true)

  actionChart?.setOption({
    animationDuration: 350,
    tooltip: { ...tooltip, trigger: 'item' },
    series: [{
      name: '攻击动作',
      type: 'pie',
      radius: ['38%', '68%'],
      data: actionData.value.map((item) => ({
        name: displayValue(item.name),
        value: item.value,
        rawName: item.name,
      })),
      label: { color: colors.muted, fontSize: 10 },
      itemStyle: { borderColor: colors.panel, borderWidth: 2 },
    }],
  }, true)

  reputationChart?.setOption({
    animationDuration: 350,
    tooltip: { ...tooltip, trigger: 'item' },
    series: [{
      name: 'IP 信誉',
      type: 'pie',
      radius: ['28%', '68%'],
      roseType: 'radius',
      data: reputationData.value.map((item) => ({
        name: displayValue(item.name),
        value: item.value,
        rawName: item.name,
      })),
      label: {
        show: true,
        position: 'inside',
        formatter: '{b}',
        color: '#ffffff',
        fontSize: 9,
        textBorderColor: 'rgba(0, 0, 0, 0.45)',
        textBorderWidth: 2,
      },
      labelLine: { show: false },
      itemStyle: { borderColor: colors.panel, borderWidth: 2 },
    }],
  }, true)

  const honeypots = honeypotData.value.slice().reverse()
  honeypotChart?.setOption({
    animationDuration: 350,
    grid: { top: 15, right: 25, bottom: 25, left: 105 },
    tooltip,
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
      data: honeypots.map((item) => displayHoneypot(item.name)),
      axisLabel: { color: colors.muted },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: '攻击次数',
      type: 'bar',
      barMaxWidth: 16,
      data: honeypots.map((item) => item.value),
      itemStyle: { color: '#4f8cff', borderRadius: [0, 4, 4, 0] },
    }],
  }, true)
}

function resizeCharts(): void {
  trendChart?.resize()
  protocolChart?.resize()
  actionChart?.resize()
  reputationChart?.resize()
  honeypotChart?.resize()
}

function bindClicks(): void {
  protocolChart?.on('click', (params: { name?: string }) => {
    if (params.name) store.selectProtocol(params.name as ProtocolType)
  })
  actionChart?.on('click', (params) => {
    const data = params.data as ChartDatum | undefined
    if (data?.rawName) store.selectAction(data.rawName)
  })
  reputationChart?.on('click', (params) => {
    const data = params.data as ChartDatum | undefined
    if (data?.rawName) store.selectReputation(data.rawName)
  })
  honeypotChart?.on('click', (params: { name?: string }) => {
    const item = honeypotData.value.find(
      (honeypot) => displayHoneypot(honeypot.name) === params.name,
    )
    if (item) store.selectHoneypot(item.name)
  })
}

watch(
  [attacksByTimeBucket, protocolData, actionData, reputationData, honeypotData],
  renderCharts,
  { deep: true },
)
watch(themeMode, renderCharts)

onActivated(() => {
  if (activateFrame !== undefined) window.cancelAnimationFrame(activateFrame)
  activateFrame = window.requestAnimationFrame(() => {
    resizeCharts()
    activateFrame = undefined
  })
})

onMounted(() => {
  if (trendElement.value) trendChart = init(trendElement.value)
  if (protocolElement.value) protocolChart = init(protocolElement.value)
  if (actionElement.value) actionChart = init(actionElement.value)
  if (reputationElement.value) reputationChart = init(reputationElement.value)
  if (honeypotElement.value) honeypotChart = init(honeypotElement.value)
  bindClicks()
  renderCharts()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  if (activateFrame !== undefined) window.cancelAnimationFrame(activateFrame)
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  protocolChart?.dispose()
  actionChart?.dispose()
  reputationChart?.dispose()
  honeypotChart?.dispose()
})
</script>

<template>
  <section class="dashboard-panel">
    <div v-if="panelLoading" class="panel-state">正在加载仪表盘统计...</div>
    <template v-else>
      <div v-if="filteredAttacks.length === 0" class="panel-state">当前筛选条件下暂无仪表盘数据</div>
      <div v-else class="dashboard-chart-grid">
        <article class="dashboard-chart-card dashboard-chart-card--wide">
          <header><strong>攻击趋势</strong><span class="dashboard-chart-card__meta">最近 24 小时</span></header>
          <div ref="trendElement" class="dashboard-chart" aria-label="攻击趋势图表" />
        </article>
        <article class="dashboard-chart-card">
          <header><strong>协议分布</strong></header>
          <div ref="protocolElement" class="dashboard-chart" aria-label="协议分布图表" />
        </article>
        <article class="dashboard-chart-card">
          <header><strong>攻击动作分布</strong></header>
          <div ref="actionElement" class="dashboard-chart" aria-label="攻击动作分布图表" />
        </article>
        <article class="dashboard-chart-card">
          <header><strong>信誉分布</strong></header>
          <div ref="reputationElement" class="dashboard-chart" aria-label="信誉分布图表" />
        </article>
        <article class="dashboard-chart-card">
          <header><strong>蜜罐分布</strong></header>
          <div ref="honeypotElement" class="dashboard-chart" aria-label="蜜罐分布图表" />
        </article>
      </div>
    </template>
  </section>
</template>
