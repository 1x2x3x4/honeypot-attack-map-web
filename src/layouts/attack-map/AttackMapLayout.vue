<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AttackDetailDrawer from '../../components/AttackDetailDrawer.vue'
import AttackMap from '../../components/AttackMap.vue'
import BottomPanel from '../../components/BottomPanel.vue'
import HeaderBar from '../../components/HeaderBar.vue'
import ServiceTypesPanel from '../../components/ServiceTypesPanel.vue'
import { useAttackStore } from '../../stores/attackStore'

const store = useAttackStore()
const mapRef = ref<InstanceType<typeof AttackMap> | null>(null)
const serviceCollapsed = ref(false)
const bottomCollapsed = ref(false)
let resizeTimer: number | undefined

async function refreshMapSize(): Promise<void> {
  await nextTick()
  if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    mapRef.value?.invalidateSize()
    resizeTimer = undefined
  }, 220)
}

function toggleServices(): void {
  serviceCollapsed.value = !serviceCollapsed.value
  void refreshMapSize()
}

function handleBottomCollapsed(collapsed: boolean): void {
  bottomCollapsed.value = collapsed
  void refreshMapSize()
}

onMounted(async () => {
  await store.init()
})

onBeforeUnmount(() => {
  if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
  store.dispose()
})
</script>

<template>
  <main
    class="dashboard-shell"
    :class="{
      'dashboard-shell--bottom-collapsed': bottomCollapsed,
      'dashboard-shell--service-collapsed': serviceCollapsed,
    }"
  >
    <HeaderBar />
    <section class="map-section">
      <AttackMap ref="mapRef" />
      <AttackDetailDrawer />
      <ServiceTypesPanel :collapsed="serviceCollapsed" @toggle="toggleServices" />
    </section>
    <BottomPanel @collapsed-change="handleBottomCollapsed" />
  </main>
</template>
