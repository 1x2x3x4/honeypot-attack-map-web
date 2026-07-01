<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  detail: string
  accent?: string
}>()
</script>

<template>
  <article class="stat-card" :style="{ '--card-accent': accent ?? '#38d5ff' }">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
    <small>{{ detail }}</small>
  </article>
</template>
