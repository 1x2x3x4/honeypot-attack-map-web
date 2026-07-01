<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardPanel from './DashboardPanel.vue'
import LiveFeedTable from './LiveFeedTable.vue'
import TopCountriesPanel from './TopCountriesPanel.vue'
import TopIpsPanel from './TopIpsPanel.vue'

type TabId = 'feed' | 'ips' | 'countries' | 'dashboard'

const emit = defineEmits<{ 'collapsed-change': [collapsed: boolean] }>()
const activeTab = ref<TabId>('feed')
const collapsed = ref(false)

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'feed', label: '实时日志', icon: '≡' },
  { id: 'ips', label: '攻击源排行', icon: '◎' },
  { id: 'countries', label: '国家排行', icon: '◉' },
  { id: 'dashboard', label: '仪表盘', icon: '▥' },
]

const activeComponent = computed(() => ({
  feed: LiveFeedTable,
  ips: TopIpsPanel,
  countries: TopCountriesPanel,
  dashboard: DashboardPanel,
})[activeTab.value])

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  emit('collapsed-change', collapsed.value)
}
</script>

<template>
  <section class="bottom-panel" :class="{ 'bottom-panel--collapsed': collapsed }">
    <nav class="tab-bar" aria-label="攻击数据视图">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ 'tab-button--active': activeTab === tab.id }"
        class="tab-button"
        @click="activeTab = tab.id; collapsed = false; emit('collapsed-change', false)"
      >
        <span class="tab-button__icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
      <button
        class="panel-collapse-button"
        type="button"
        :aria-label="collapsed ? '展开底部面板' : '折叠底部面板'"
        :title="collapsed ? '展开底部面板' : '折叠底部面板'"
        @click="toggleCollapsed"
      >
        <svg class="panel-collapse-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="collapsed" d="m6 15 6-6 6 6" />
          <path v-else d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </nav>

    <template v-if="!collapsed">
      <div class="bottom-panel__content">
        <KeepAlive>
          <component :is="activeComponent" />
        </KeepAlive>
      </div>
    </template>
  </section>
</template>
