<script setup lang="ts">
// BodyTab.vue — meridian rows + temper tier ladder + soul aspect display.

import { computed } from 'vue'
import { useBodyStore } from '@/stores/body'
import { useForgeStore } from '@/stores/forge'
import { BODY_DATA, findBodyBuyable, temperTierForLevel } from '@/data/body'
import { SETPIECE_DATA } from '@/data/setpieces'
import { format } from '@/engine/format'
import SoulAspectPanel from './SoulAspectPanel.vue'
import HeartDemonsPanel from './HeartDemonsPanel.vue'
import DeepMeditationPanel from './DeepMeditationPanel.vue'

const body = useBodyStore()
const forge = useForgeStore()

const primaryRow = findBodyBuyable('primaryMeridian')
const extraRow = findBodyBuyable('extraordinaryMeridian')
const temperRow = findBodyBuyable('temper')

const primaryCost = computed(() => format(body.buyableCost('primaryMeridian', body.buyableAmount('primaryMeridian'))))
const extraCost = computed(() => format(body.buyableCost('extraordinaryMeridian', body.buyableAmount('extraordinaryMeridian'))))
const temperCost = computed(() => format(body.buyableCost('temper', body.buyableAmount('temper'))))

const foundationBandLabel = computed(() => {
  if (body.foundationGrade < 0) return 'Not yet established'
  const bands = BODY_DATA.grades.foundationGrade
  void bands
  // The foundation grade index maps to the band tiers in REALM_DATA(f).grade.bands.
  // For display we just show the index + tier label from the forge band if available.
  return `Grade ${body.foundationGrade}`
})

const coreGradeLabel = computed(() => {
  if (body.coreGrade < 0) return 'No core forged'
  const grades = SETPIECE_DATA.forge.grades
  const grade = grades[body.coreGrade]
  return grade ? grade.label : `Grade ${body.coreGrade}`
})

const currentTemperTier = computed(() => temperTierForLevel(body.temperLevel))
const temperProgress = computed(() => {
  const tier = currentTemperTier.value
  if (!tier) return ''
  const nextTier = BODY_DATA.temperTiers.find((t) => t.fromLevel > body.temperLevel)
  if (!nextTier) return `${tier.label} (max)`
  return `${tier.label} → ${nextTier.label} at level ${nextTier.fromLevel}`
})
</script>

<template>
  <div class="body-tab">
    <section class="panel">
      <h3>Meridians</h3>
      <div class="buyable-row">
        <div class="buyable-info">
          <span class="buyable-title">{{ primaryRow.title }}</span>
          <span class="buyable-owned">{{ body.primaryMeridians }} / {{ primaryRow.limit }}</span>
          <span class="buyable-effect">×{{ format(body.meridianMult) }} Qi</span>
        </div>
        <button
          :disabled="!body.canAffordBuyable('primaryMeridian')"
          @click="body.buyBuyable('primaryMeridian')"
        >
          {{ primaryCost }} Qi
        </button>
      </div>
      <div class="buyable-row">
        <div class="buyable-info">
          <span class="buyable-title">{{ extraRow.title }}</span>
          <span class="buyable-owned">{{ body.extraordinaryMeridians }} / {{ extraRow.limit }}</span>
          <span class="buyable-effect">×{{ format(body.meridianMult) }} Qi</span>
        </div>
        <button
          :disabled="!body.canAffordBuyable('extraordinaryMeridian')"
          @click="body.buyBuyable('extraordinaryMeridian')"
        >
          {{ extraCost }} Qi
        </button>
      </div>
    </section>

    <section class="panel">
      <h3>Temper Body</h3>
      <div class="buyable-row">
        <div class="buyable-info">
          <span class="buyable-title">{{ temperRow.title }}</span>
          <span class="buyable-owned">{{ body.temperLevel }} / {{ temperRow.limit }}</span>
          <span class="buyable-effect">×{{ format(body.temperMult) }} Qi</span>
        </div>
        <button
          :disabled="!body.canAffordBuyable('temper')"
          @click="body.buyBuyable('temper')"
        >
          {{ temperCost }} Qi
        </button>
      </div>
      <p class="tier-progress">{{ temperProgress }}</p>
    </section>

    <section class="panel">
      <h3>Stored Grades</h3>
      <p>Foundation: {{ foundationBandLabel }}</p>
      <p>Core: {{ coreGradeLabel }}</p>
      <p v-if="forge.coreCeilingGradeIndex >= 0">Core ceiling: {{ SETPIECE_DATA.forge.grades[forge.coreCeilingGradeIndex]?.label }}</p>
    </section>

    <SoulAspectPanel />

    <DeepMeditationPanel />

    <HeartDemonsPanel />

    <section class="panel">
      <h3>Scar</h3>
      <p v-if="body.scarDepth === 0">No scars marked.</p>
      <p v-else>
        Depth: {{ body.scarDepth }} | Healed: {{ body.scarHealedDepth }} | Active: {{ Math.max(body.scarDepth - body.scarHealedDepth, 0) }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.body-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}
.panel h3 {
  margin: 0 0 0.5rem 0;
  color: #c97b5a;
}
.buyable-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  gap: 1rem;
}
.buyable-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.buyable-title {
  font-weight: bold;
  color: #dfdfdf;
}
.buyable-owned {
  color: #888;
  font-size: 0.85rem;
}
.buyable-effect {
  color: #5fc9e0;
  font-size: 0.85rem;
}
.tier-progress {
  color: #888;
  font-size: 0.85rem;
  margin: 0.5rem 0 0 0;
}
button {
  font-family: inherit;
  font-size: 0.9rem;
  padding: 0.4rem 0.8rem;
  background: #2a2a2a;
  color: #dfdfdf;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
button:hover:not(:disabled) {
  background: #3a3a3a;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
