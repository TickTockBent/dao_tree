<script setup lang="ts">
// HintBar.vue — the top guidance line (first-match-wins hint cascade).

import { useHintsStore } from '@/stores/hints'

const hints = useHintsStore()
</script>

<template>
  <div class="hint-bar">
    <p>{{ hints.hintText }}</p>
  </div>
</template>

<style scoped>
.hint-bar {
  background: #1a1a2a;
  border: 1px solid #333355;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  margin: 0 auto 1rem auto;
  max-width: 600px;
  text-align: center;
}
.hint-bar p {
  margin: 0;
  color: #aaaadd;
  font-size: 0.9rem;
  font-style: italic;
}
</style>
