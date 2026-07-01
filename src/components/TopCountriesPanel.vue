<script setup lang="ts">
import { onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import { useThemeStore } from '../stores/themeStore'
import { getChartThemeColors } from '../utils/chartTheme'
import { displayCountry } from '../utils/attackDisplayText'
import { formatDateTime } from '../utils/dateTimeFormat'
import { getProtocolColor } from '../utils/protocolColors'
import { init, type ECharts } from '../utils/echartsModules'
import CountryFlag from './CountryFlag.vue'

const store = useAttackStore()
const themeStore = useThemeStore()
const { topCountries, emptyWindowMessage, panelLoading, selectedCountry } = storeToRefs(store)
const { themeMode } = storeToRefs(themeStore)
const chartElement = ref<HTMLElement | null>(null)
let chart: ECharts | undefined
let activateFrame: number | undefined

function renderChart(): void {
  const items = topCountries.value.slice(0, 10)
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
      data: items.map((item) => displayCountry(item.country)),
      axisLabel: {
        color: colors.text,
        interval: 0,
        hideOverlap: false,
        width: 110,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: '攻击次数',
      type: 'bar',
      data: items.map((item) => ({
        value: item.hits,
        itemStyle: {
          color: getProtocolColor(item.topProtocol),
          borderRadius: [0, 4, 4, 0],
        },
      })),
      barWidth: 12,
      barCategoryGap: '35%',
    }],
  }, true)
}

function handleChartClick(params: { name?: string }): void {
  const item = topCountries.value.find(
    (country) => displayCountry(country.country) === params.name,
  )
  if (item) store.selectCountry(item.country)
}

function resize(): void {
  chart?.resize()
}

watch(topCountries, renderChart, { deep: true })
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
    <div v-if="panelLoading" class="panel-state">正在加载国家统计...</div>
    <div v-else-if="topCountries.length === 0" class="panel-state">
      {{ emptyWindowMessage || '当前筛选条件下暂无国家数据' }}
    </div>
    <div v-else class="ranking-layout">
      <div ref="chartElement" class="ranking-chart" aria-label="攻击来源国家排行图表" />
      <div class="data-table-wrap ranking-table-wrap">
        <table class="data-table ranking-table">
          <thead>
            <tr><th>排名</th><th>国家</th><th>国家代码</th><th>次数</th><th>最高频协议</th><th>最近出现</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in topCountries"
              :key="item.countryCode"
              :class="{ 'data-table__row--selected': selectedCountry === item.country }"
              @click="store.selectCountry(item.country)"
            >
              <td class="rank-cell">{{ index + 1 }}</td>
              <td><CountryFlag :code="item.countryCode" :country="item.country" /> {{ displayCountry(item.country) }}</td>
              <td>{{ item.countryCode }}</td>
              <td class="hits-cell">{{ item.hits }}</td>
              <td>
                <span class="protocol-pill" :style="{ '--protocol-color': getProtocolColor(item.topProtocol) }">
                  {{ item.topProtocol }}
                </span>
              </td>
              <td>{{ formatDateTime(item.lastSeen) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
