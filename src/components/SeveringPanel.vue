<script setup lang="ts">
// SeveringPanel — the Spirit Severing set-piece (slice 9 SKELETON).
//
// The severing implementer replaces the placeholder body with the ceremony:
// the three corpses in sequence, the severance menu with each candidate's
// measured live contribution (D11 — the game tells you exactly what you are
// giving up), the charge → commit → outcome flow, and the ramp/weakness
// readout. Layout follows ForgePanel/TribulationPanel conventions.

import { useSeveringStore } from '@/stores/severing'
import { SEVERING_DATA } from '@/data/severing'

const severing = useSeveringStore()
</script>

<template>
  <div class="severing-panel">
    <h4>The Three Corpses</h4>
    <ul class="corpses">
      <li v-for="(corpse, index) in SEVERING_DATA.corpses" :key="corpse.key">
        <strong>{{ corpse.name }}</strong>
        <span v-if="index < severing.severances.length"> — severed</span>
        <span v-else-if="corpse.key === severing.nextCorpse"> — {{ corpse.flavor }}</span>
        <span v-else> — beyond reach</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.severing-panel {
  margin-top: 0.75rem;
}
.corpses {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}
.corpses li {
  margin: 0.25rem 0;
}
</style>
