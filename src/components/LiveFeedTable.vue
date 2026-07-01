<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import type { AttackEvent } from '../types/attack'
import {
  displayCountry,
  displayHoneypot,
  displayValue,
} from '../utils/attackDisplayText'
import { formatDateTime } from '../utils/dateTimeFormat'
import { parseAttackTime } from '../utils/parseTime'
import { getProtocolColor } from '../utils/protocolColors'
import CountryFlag from './CountryFlag.vue'

type SortKey = 'event_time' | 'src_ip' | 'src_country' | 'protocol' | 'dest_port' | 'honeypot_type'

const store = useAttackStore()
const {
  filteredLatestAttacks,
  emptyWindowMessage,
  panelError,
  panelLoading,
  selectedAttackId,
} = storeToRefs(store)

const sortKey = ref<SortKey>('event_time')
const sortDirection = ref<'asc' | 'desc'>('desc')

const sortedAttacks = computed(() => {
  const factor = sortDirection.value === 'asc' ? 1 : -1
  return filteredLatestAttacks.value.slice().sort((a, b) => {
    const left = a[sortKey.value]
    const right = b[sortKey.value]
    if (sortKey.value === 'event_time') {
      return (parseAttackTime(String(left)) - parseAttackTime(String(right))) * factor
    }
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right)) * factor
  })
})

function setSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = key === 'event_time' ? 'desc' : 'asc'
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDirection.value === 'asc' ? ' ↑' : ' ↓'
}

function reputationClass(reputation?: string): string {
  return reputation?.toLowerCase().replaceAll(' ', '-') ?? 'unknown'
}

function openDetail(attack: AttackEvent): void {
  store.openAttackDetail(attack.id)
}
</script>

<template>
  <section class="feed-panel">
    <div v-if="panelError" class="panel-state panel-state--error">数据加载失败，请检查 FastAPI 服务和 MySQL 数据库连接</div>
    <div v-else-if="panelLoading" class="panel-state">正在加载攻击事件...</div>
    <div v-else-if="emptyWindowMessage" class="panel-state">{{ emptyWindowMessage }}</div>

    <div v-else class="data-table-wrap">
      <table class="data-table live-feed-table">
        <colgroup>
          <col class="feed-column-time">
          <col class="feed-column-ip">
          <col class="feed-column-reputation">
          <col class="feed-column-flag">
          <col class="feed-column-country">
          <col class="feed-column-honeypot">
          <col class="feed-column-protocol">
          <col class="feed-column-port">
          <col class="feed-column-hostname">
        </colgroup>
        <thead>
          <tr>
            <th><button type="button" @click="setSort('event_time')">时间{{ sortIndicator('event_time') }}</button></th>
            <th><button type="button" @click="setSort('src_ip')">攻击源 IP{{ sortIndicator('src_ip') }}</button></th>
            <th>IP 信誉</th>
            <th>标识</th>
            <th><button type="button" @click="setSort('src_country')">国家{{ sortIndicator('src_country') }}</button></th>
            <th><button type="button" @click="setSort('honeypot_type')">蜜罐{{ sortIndicator('honeypot_type') }}</button></th>
            <th><button type="button" @click="setSort('protocol')">协议{{ sortIndicator('protocol') }}</button></th>
            <th><button type="button" @click="setSort('dest_port')">端口{{ sortIndicator('dest_port') }}</button></th>
            <th>蜜罐主机名</th>
          </tr>
        </thead>
        <TransitionGroup name="feed-row" tag="tbody">
          <tr
            v-for="attack in sortedAttacks"
            :key="attack.id"
            :class="{ 'data-table__row--selected': selectedAttackId === attack.id }"
            tabindex="0"
            role="button"
            title="单击查看攻击详情并聚焦地图"
            @mousedown.left.prevent
            @click.stop="openDetail(attack)"
            @keydown.enter.prevent="openDetail(attack)"
            @keydown.space.prevent="openDetail(attack)"
          >
            <td>{{ formatDateTime(attack.event_time) }}</td>
            <td class="cell-ip">
              {{ attack.src_ip }}
              <span
                v-if="Number(attack.aggregate_count ?? 1) > 1"
                class="feed-repeat-count"
                :title="`10 秒窗口内相同攻击路径累计 ${attack.aggregate_count} 次`"
              >
                ×{{ attack.aggregate_count }}
              </span>
            </td>
            <td>
              <span class="status-tag" :class="`reputation-tag--${reputationClass(attack.ip_reputation)}`">
                {{ displayValue(attack.ip_reputation) }}
              </span>
            </td>
            <td><CountryFlag :code="attack.src_country_code" :country="attack.src_country" /></td>
            <td>{{ displayCountry(attack.src_country) }}</td>
            <td class="cell-strong">{{ displayHoneypot(attack.honeypot_type) }}</td>
            <td>
              <span class="protocol-pill" :style="{ '--protocol-color': getProtocolColor(attack.protocol) }">
                {{ attack.protocol }}
              </span>
            </td>
            <td class="cell-port">{{ attack.dest_port }}</td>
            <td class="cell-hostname" :title="attack.target_hostname">{{ attack.target_hostname }}</td>
          </tr>
          <tr v-if="sortedAttacks.length === 0" key="empty" class="data-table__empty-row">
            <td colspan="9">当前筛选条件下暂无攻击事件</td>
          </tr>
        </TransitionGroup>
      </table>
    </div>
  </section>
</template>
