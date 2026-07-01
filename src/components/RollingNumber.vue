<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  value: number
}>()

const displayedValue = ref(props.value)
const previousValue = ref<number | null>(null)
const animating = ref(false)
let animationTimer: number | undefined
let animationSequence = 0

watch(
  () => props.value,
  async (nextValue) => {
    if (nextValue === displayedValue.value) return

    const sequence = ++animationSequence
    if (animationTimer !== undefined) {
      window.clearTimeout(animationTimer)
      animationTimer = undefined
    }

    previousValue.value = displayedValue.value
    displayedValue.value = nextValue
    animating.value = false
    await nextTick()

    if (sequence !== animationSequence) return
    animating.value = true
    animationTimer = window.setTimeout(() => {
      animating.value = false
      previousValue.value = null
      animationTimer = undefined
    }, 460)
  },
)

onBeforeUnmount(() => {
  if (animationTimer !== undefined) {
    window.clearTimeout(animationTimer)
  }
})
</script>

<template>
  <span class="summary-number" :aria-label="String(displayedValue)">
    <span
      v-if="animating && previousValue !== null"
      class="summary-number__value summary-number__value--old"
      aria-hidden="true"
    >
      {{ previousValue }}
    </span>
    <span
      class="summary-number__value"
      :class="{ 'summary-number__value--new': animating }"
      aria-hidden="true"
    >
      {{ displayedValue }}
    </span>
  </span>
</template>
