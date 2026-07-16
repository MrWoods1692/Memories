<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
</template>
<script setup>
defineProps({ size: { type: Number, default: 20 } })
</script>
