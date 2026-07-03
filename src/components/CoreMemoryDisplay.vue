<script setup lang="ts">
// CoreMemoryDisplay.vue — "the core remembers" (D26): keep-rule legibility
// readout for Core Formation. Pure display — the store already folds
// reclimbGainMult into resetGain/nextAt, so nothing here changes gain.

import { computed } from 'vue'
import { useSoulStore } from '@/stores/soul'
import { decimalOne } from '@/engine/decimal'
import { ACCUMULATOR_DATA } from '@/data/accumulators'
import { format } from '@/engine/format'

const soul = useSoulStore()

/** D11: no memory to show before the first re-climb — veil the ahead, never leak the now. */
const hasMemory = computed(() => soul.ascents >= 1)

const ascentCount = computed(() => soul.ascents)

const reclimbGainMult = computed(() => soul.reclimbGainMult('c'))

/** The ×20 cap (1/floor) — read from data, never hardcoded (D21). */
const capMult = computed(() => decimalOne().div(ACCUMULATOR_DATA.ascentCounter.floor!))

const isMastered = computed(() => reclimbGainMult.value.gte(capMult.value))

const reclimbGainMultLabel = computed(() => format(reclimbGainMult.value))
const capMultLabel = computed(() => format(capMult.value))
</script>

<template>
  <section v-if="hasMemory" class="panel">
    <h3>The Core Remembers</h3>
    <p>The core has been re-tempered <b>{{ ascentCount }}</b> time{{ ascentCount === 1 ? '' : 's' }}.</p>
    <p>
      Re-climb mastery: <b>×{{ reclimbGainMultLabel }}</b> Core Formation breakthrough gain
      <span v-if="isMastered" class="mastered">(mastered)</span>
      <span v-else>(cap ×{{ capMultLabel }})</span>
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
  color: #8a6fd8;
  font-size: 0.9rem;
}
.panel p {
  color: #999;
  font-size: 0.85rem;
  margin: 0.25rem 0;
}
.mastered {
  color: #5fc9e0;
}
</style>
