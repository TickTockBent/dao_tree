<!-- src/components/AlchemyTab.vue — the Alchemy profession (slice 7, §7.6).
     SKELETON: replaced wholesale by the slice-7 alchemy agent. -->
<script setup lang="ts">
import { useAlchemyStore } from '@/stores/alchemy'

const alchemy = useAlchemyStore()
</script>

<template>
  <div class="panel">
    <h2>Alchemy</h2>
    <p v-if="!alchemy.isRevealed()">The cauldron sits cold.</p>
    <p v-else>The profession slot is open. (slice 7 in progress)</p>
  </div>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
</style>
