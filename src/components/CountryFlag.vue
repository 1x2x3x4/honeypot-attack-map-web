<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { normalizeCountryCode } from '../utils/countryCode'

const props = defineProps<{
  code: string
  country?: string
}>()

const imageFailed = ref(false)
const normalizedCode = computed(() => normalizeCountryCode(props.code, props.country))
const isIsoCountryCode = computed(() => /^[A-Z]{2}$/.test(normalizedCode.value))
const flagUrl = computed(() => `https://flagcdn.com/${normalizedCode.value.toLowerCase()}.svg`)
const flagLabel = computed(() => `${props.country?.trim() || normalizedCode.value}国旗`)

watch(normalizedCode, () => {
  imageFailed.value = false
})
</script>

<template>
  <span class="country-flag" :title="normalizedCode || 'UNKNOWN'">
    <img
      v-if="isIsoCountryCode && !imageFailed"
      class="country-flag__image"
      :src="flagUrl"
      :alt="flagLabel"
      width="25"
      height="17"
      loading="lazy"
      @error="imageFailed = true"
    >
    <span v-else class="country-flag__code">{{ normalizedCode || '--' }}</span>
  </span>
</template>
