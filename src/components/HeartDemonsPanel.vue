<!-- src/components/HeartDemonsPanel.vue — corruption bar + active Demon Trial (slice 8).
     Hosted in BodyTab (the cultivator's inner state); invisible until corruption
     is first touched. The active trial speaks in the demon's voice (§7.4). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { HEART_DEMON_DATA, findDemonTrial } from '@/data/heart-demons'
import { findRealm } from '@/data/realms'
import { format, formatTime } from '@/engine/format'

const heartDemons = useHeartDemonsStore()

/** The active trial's data row (null when no trial holds). */
const trialRow = computed(() =>
  heartDemons.activeTrial === null ? null : findDemonTrial(heartDemons.activeTrial),
)

/** Fraction of the way to the next threshold (clamped to [0,1]) for the meter fill. */
const corruptionFraction = computed(() => {
  const at = heartDemons.nextThresholdAt
  if (at <= 0) return 1
  return Math.min(1, heartDemons.corruption / at)
})

/** Percentage width string for the meter fill. */
const corruptionPercent = computed(() => `${corruptionFraction.value * 100}%`)

/** Passive bleed/sec at the current stack count (for the flavour note). */
const bleedPerSecond = computed(
  () =>
    HEART_DEMON_DATA.corruption.bleedPerSecond +
    HEART_DEMON_DATA.corruption.bleedPerDaoHeartStack * heartDemons.daoHeartStacks,
)

/** Per-stack Qi bonus as a percentage (e.g. 1.02 → "2%"). */
const perStackBonusPercent = computed(
  () => (HEART_DEMON_DATA.daoHeart.qiMultPerStack - 1) * 100,
)

/** Debuff shown while a trial holds (e.g. 0.7 → "-30% Qi/sec"). */
const trialDebuffPercent = computed(() =>
  trialRow.value === null ? 0 : (1 - trialRow.value.qiMultWhileActive) * 100,
)

/** endure: seconds remaining. */
const endureRemaining = computed(() => {
  const objective = trialRow.value?.objective
  if (objective?.type !== 'endure') return 0
  return Math.max(0, objective.seconds - heartDemons.trialElapsed)
})

/** gatherQi: [gathered, target] as Qi quantities. */
const gatherTarget = computed(() => {
  const objective = trialRow.value?.objective
  if (objective?.type !== 'gatherQi') return 0
  return objective.reqBaseFactor * findRealm('q').reqBase
})

/** prestigeCount: required breakthroughs. */
const prestigeTarget = computed(() => {
  const objective = trialRow.value?.objective
  return objective?.type === 'prestigeCount' ? objective.count : 0
})
</script>

<template>
  <div v-if="heartDemons.isRevealed()" class="panel demon-panel">
    <h3>Heart Demons</h3>

    <div class="corruption">
      <div class="corruption-head">
        <span>Corruption</span>
        <span class="corruption-value">
          {{ heartDemons.corruption.toFixed(1) }} / {{ heartDemons.nextThresholdAt }}
        </span>
      </div>
      <div class="meter">
        <div class="meter-fill" :style="{ width: corruptionPercent }"></div>
      </div>
      <p v-if="!heartDemons.trialIsActive" class="note">
        Orthodox practice bleeds {{ bleedPerSecond.toFixed(2) }}/sec.
      </p>
      <p v-else class="note">
        Accumulation paused — you are already facing the demon.
        <span v-if="heartDemons.banked > 0" class="banked">
          +{{ heartDemons.banked.toFixed(1) }} banked; it lands when this trial ends.
        </span>
      </p>
    </div>

    <p class="stacks">
      Dao Heart: {{ heartDemons.daoHeartStacks }}
      <span v-if="heartDemons.daoHeartStacks > 0" class="bonus">
        (+{{ perStackBonusPercent.toFixed(0) }}% Qi/sec each)
      </span>
    </p>

    <div v-if="trialRow" class="trial">
      <h4>{{ trialRow.name }}</h4>
      <p class="voice">{{ trialRow.description }}</p>
      <p class="debuff">Involuntary stance: -{{ trialDebuffPercent.toFixed(0) }}% Qi/sec</p>
      <p class="objective">
        <template v-if="trialRow.objective.type === 'endure'">
          Endure: {{ formatTime(endureRemaining) }} remaining
        </template>
        <template v-else-if="trialRow.objective.type === 'gatherQi'">
          Gather: {{ format(heartDemons.trialQiGathered) }} / {{ format(gatherTarget) }} Qi
        </template>
        <template v-else>
          Break through: {{ heartDemons.trialPrestiges }} / {{ prestigeTarget }}
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}
.demon-panel {
  border-color: #8a3a3a;
}
.panel h3 {
  margin: 0 0 0.5rem 0;
  color: #b05555;
}
.corruption-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}
.corruption-value {
  color: #b05555;
  font-variant-numeric: tabular-nums;
}
.meter {
  margin: 0.35rem 0;
  height: 0.6rem;
  background: #2a1414;
  border: 1px solid #4a2020;
  border-radius: 3px;
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #6a2a2a, #b05555);
  transition: width 0.2s linear;
}
.note {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: #8a7a7a;
}
.banked {
  color: #b05555;
}
.stacks {
  margin: 0.75rem 0 0 0;
}
.bonus {
  color: #7aa06a;
  font-size: 0.85rem;
}
.trial {
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid #4a2020;
}
.trial h4 {
  margin: 0 0 0.35rem 0;
  color: #b05555;
}
.voice {
  margin: 0.25rem 0;
  font-style: italic;
  color: #c9a0a0;
}
.debuff {
  margin: 0.35rem 0;
  color: #b05555;
  font-size: 0.9rem;
}
.objective {
  margin: 0.35rem 0 0 0;
  font-variant-numeric: tabular-nums;
}
</style>
