<!-- src/components/HeartDemonsPanel.vue — corruption bar + active Demon Trial (slice 8).
     SKELETON: replaced wholesale by the slice-8 agent. Hosted in BodyTab (the
     cultivator's inner state); invisible until corruption is first touched. -->
<script setup lang="ts">
import { useHeartDemonsStore } from '@/stores/heartDemons'

const heartDemons = useHeartDemonsStore()
</script>

<template>
  <div v-if="heartDemons.isRevealed()" class="panel">
    <h3>Heart Demons</h3>
    <p>Corruption stirs. (slice 8 in progress)</p>
  </div>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
</style>
