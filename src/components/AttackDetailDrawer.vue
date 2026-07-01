<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import {
  displayCity,
  displayCountry,
  displayHoneypot,
  displayValue,
} from '../utils/attackDisplayText'
import { formatDateTime } from '../utils/dateTimeFormat'

const store = useAttackStore()
const { selectedAttack } = storeToRefs(store)
const copied = ref('')
let copiedTimer: number | undefined

interface DetailRow {
  label: string
  value: string | number
}

interface DetailSection {
  title: string
  rows: DetailRow[]
}

function copyWithSelectionFallback(value: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

async function copyText(label: string, value: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(value)
  } catch {
    copyWithSelectionFallback(value)
  }
  copied.value = label
  if (copiedTimer !== undefined) window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => {
    if (copied.value === label) copied.value = ''
    copiedTimer = undefined
  }, 1400)
}

function valueOrDash(value: unknown): string {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

const detailSections = computed<DetailSection[]>(() => {
  const attack = selectedAttack.value
  if (!attack) return []

  return [
    {
      title: '基础信息',
      rows: [
        { label: '事件时间', value: formatDateTime(attack.event_time) },
        { label: '北京时间', value: valueOrDash(attack.event_time_cn) },
        { label: '蜜罐类型', value: displayHoneypot(attack.honeypot_type) },
        { label: '协议', value: attack.protocol },
        { label: '动作', value: displayValue(attack.action) },
        { label: '状态', value: displayValue(attack.status) },
        { label: 'IP 信誉', value: displayValue(attack.ip_reputation) },
      ],
    },
    {
      title: '攻击源',
      rows: [
        { label: '攻击源 IP', value: attack.src_ip },
        { label: '源端口', value: valueOrDash(attack.src_port) },
        { label: '国家 / 城市', value: `${displayCountry(attack.src_country)} / ${displayCity(attack.src_city)}` },
        { label: 'ASN', value: valueOrDash(attack.src_asn) },
        { label: 'AS 组织', value: valueOrDash(attack.src_as_org) },
        { label: '纬度', value: attack.src_latitude },
        { label: '经度', value: attack.src_longitude },
      ],
    },
    {
      title: '目标',
      rows: [
        { label: '目标公网 IP', value: attack.target_public_ip },
        { label: '目标内网 IP', value: valueOrDash(attack.target_internal_ip) },
        { label: '目标主机名', value: attack.target_hostname },
        { label: '目标 IP', value: valueOrDash(attack.destination_ip) },
        { label: '目标端口', value: attack.dest_port },
      ],
    },
    {
      title: '认证信息',
      rows: [
        { label: '用户名', value: valueOrDash(attack.username) },
        { label: '密码', value: valueOrDash(attack.password) },
      ],
    },
    {
      title: 'HTTP 信息',
      rows: [
        { label: '请求方法 / URI', value: `${valueOrDash(attack.http_method)} ${valueOrDash(attack.http_uri)}` },
        { label: '主机', value: valueOrDash(attack.http_host) },
        { label: 'User-Agent', value: valueOrDash(attack.user_agent) },
        { label: '命令', value: valueOrDash(attack.command) },
      ],
    },
    {
      title: '原始信息',
      rows: [
        { label: 'es_index', value: valueOrDash(attack.es_index) },
        { label: 'es_doc_id', value: valueOrDash(attack.es_doc_id) },
        { label: 'log_path', value: valueOrDash(attack.log_path) },
      ],
    },
  ]
})

onBeforeUnmount(() => {
  if (copiedTimer !== undefined) window.clearTimeout(copiedTimer)
})
</script>

<template>
  <Transition name="drawer">
    <aside v-if="selectedAttack" class="attack-detail-drawer" aria-label="攻击详情">
      <header>
        <div>
          <strong>{{ selectedAttack.protocol }} · {{ selectedAttack.src_ip }}</strong>
        </div>
        <button type="button" aria-label="关闭攻击详情" title="关闭" @click="store.clearSelectedAttack()">×</button>
      </header>

      <div class="drawer-actions">
        <button type="button" @click="copyText('JSON', JSON.stringify(selectedAttack, null, 2))">
          {{ copied === 'JSON' ? '已复制' : '复制 JSON' }}
        </button>
        <button type="button" @click="copyText('IP', selectedAttack.src_ip)">
          {{ copied === 'IP' ? '已复制' : '复制攻击源 IP' }}
        </button>
        <button
          type="button"
          @click="copyText('IOC', `${selectedAttack.src_ip} | ${displayCountry(selectedAttack.src_country)} | ${selectedAttack.protocol}/${selectedAttack.dest_port} | ${displayValue(selectedAttack.ip_reputation)}`)"
        >
          {{ copied === 'IOC' ? '已复制' : '复制 IOC 摘要' }}
        </button>
      </div>

      <div class="drawer-scroll">
        <table class="drawer-detail-table">
          <tbody>
            <template v-for="section in detailSections" :key="section.title">
              <tr class="drawer-detail-table__section-row">
                <th colspan="2" scope="colgroup">{{ section.title }}</th>
              </tr>
              <tr v-for="row in section.rows" :key="`${section.title}-${row.label}`">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </aside>
  </Transition>
</template>
