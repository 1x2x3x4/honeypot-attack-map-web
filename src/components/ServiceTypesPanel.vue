<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttackStore } from '../stores/attackStore'
import type { ProtocolType } from '../types/attack'
import { protocolColors } from '../utils/protocolColors'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const store = useAttackStore()
const { highlightedProtocol, protocolCounts, selectedProtocol } = storeToRefs(store)
const search = ref('')
const activeOnly = ref(false)

const services = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return (Object.keys(protocolColors) as ProtocolType[])
    .map((protocol) => ({
      protocol,
      label: protocol,
      color: protocolColors[protocol],
      count: protocolCounts.value[protocol],
    }))
    .filter((item) => (!keyword || item.label.includes(keyword)))
    .filter((item) => !activeOnly.value || item.count > 0)
})

const activeCount = computed(
  () => Object.values(protocolCounts.value).filter((count) => count > 0).length,
)
</script>

<template>
  <aside class="service-panel" :class="{ 'service-panel--collapsed': collapsed }">
    <button
      class="service-collapse-button"
      type="button"
      :aria-label="collapsed ? '展开服务类型' : '折叠服务类型'"
      @click="emit('toggle')"
    >
      {{ collapsed ? '‹' : '›' }}
    </button>

    <template v-if="!collapsed">
      <div class="panel-heading service-heading">
        <div>
          <strong><span class="panel-heading__palette" aria-hidden="true" />服务类型</strong>
          <span class="service-heading__status">
            活跃：{{ activeCount }} · 已选择：{{ selectedProtocol ?? '无' }}
          </span>
        </div>
      </div>

      <div class="service-tools">
        <input v-model="search" type="search" placeholder="搜索服务类型" aria-label="搜索服务类型">
        <label><input v-model="activeOnly" type="checkbox"> 仅显示活跃项</label>
      </div>

      <ul class="service-list">
        <li v-for="service in services" :key="service.protocol">
          <button
            type="button"
            :class="{
              'service-list__item--active': selectedProtocol === service.protocol,
              'service-list__item--flashing': highlightedProtocol === service.protocol,
              'service-list__item--empty': service.count === 0,
            }"
            class="service-list__item"
            @click="store.selectProtocol(service.protocol)"
          >
            <span class="service-list__color" :style="{ backgroundColor: service.color }" />
            <span>{{ service.label }}</span>
            <strong>{{ service.count }}</strong>
          </button>
        </li>
        <li v-if="services.length === 0" class="service-empty">暂无匹配的服务类型</li>
      </ul>

      <button
        type="button"
        class="clear-filter-button"
        :disabled="!selectedProtocol"
        @click="store.clearProtocolFilter()"
      >
        清除协议筛选
      </button>
    </template>
  </aside>
</template>
