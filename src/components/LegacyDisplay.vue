<script setup lang="ts">
// LegacyDisplay.vue — the eternal Act I Legacy Grade.

import { computed } from 'vue'
import { useLegacyStore } from '@/stores/legacy'
import { format } from '@/engine/format'

const legacy = useLegacyStore()

const bandLabel = computed(() => {
  if (legacy.actOneGrade < 0) return 'No legacy inscribed'
  return legacy.actOneLegacyBand?.label ?? 'Unknown'
})

const qiMult = computed(() => format(legacy.legacyQiMult))

const score = computed(() => legacy.actOneLegacyScore())
</script>

<template>
  <section class="panel">
    <h3>Act I Legacy</h3>
    <p>Grade: <b>{{ bandLabel }}</b></p>
    <p v-if="legacy.actOneGrade >= 0">
      Score: {{ format(score.times(100)) }}% | Qi bonus: ×{{ qiMult }}
    </p>
    <p v-else class="dormant">
      The legacy is inscribed upon passing the First Tribulation.
    </p>
  </section>
</template>

<style scoped>
.panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}
.panel h3 {
  margin: 0 0 0.5rem 0;
  color: #d9c25a;
}
.dormant {
  color: #888;
  font-size: 0.85rem;
}
</style>
