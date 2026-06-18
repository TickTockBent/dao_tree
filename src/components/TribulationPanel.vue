<script setup lang="ts">
// TribulationPanel.vue — the First Tribulation (set-piece instance 2).

import { computed } from 'vue'
import { useTribulationStore } from '@/stores/tribulation'
import { useGameStore } from '@/stores/game'
import { SETPIECE_DATA } from '@/data/setpieces'
import { format } from '@/engine/format'

const trib = useTribulationStore()
const game = useGameStore()

const cfg = SETPIECE_DATA.firstTribulation

const poolFraction = computed(() => trib.tribulationPoolFraction)
const poolPercent = computed(() => format(poolFraction.value.times(100)))

const preparedness = computed(() => trib.tribulationPreparednessPool())

const gradeLabel = computed(() => {
  if (trib.tribGrade < 0) return 'Not yet faced'
  return cfg.grades[trib.tribGrade]?.label ?? 'Unknown'
})

const cooldownRemaining = computed(() => Math.ceil(trib.tribCooldownUntil))
</script>

<template>
  <section class="panel">
    <h3>The First Tribulation</h3>

    <div v-if="trib.tribulationIsActive">
      <p>Tribulation in progress...</p>
      <div class="pool-bar">
        <div class="pool-fill" :style="{ width: `${poolPercent}%` }" />
      </div>
      <p>Pool: {{ poolPercent }}% | Wave {{ trib.tribWaveIndex + 1 }}/{{ cfg.waves.length }}</p>
    </div>

    <div v-else-if="trib.tribulationPassed">
      <p>Grade: <b>{{ gradeLabel }}</b></p>
      <p v-if="trib.tribGrade >= 0 && cfg.grades[trib.tribGrade]?.scars" class="scar-warn">
        The soul bears a scar from this trial.
      </p>
    </div>

    <div v-else>
      <p>Preparedness pool: <b>{{ format(preparedness) }}</b></p>
      <p>Banked Qi (fuel): <b>{{ format(game.points) }}</b></p>
      <p v-if="cooldownRemaining > 0">Retry cooldown: {{ cooldownRemaining }}s</p>
      <button
        :disabled="!trib.tribulationIsReady"
        @click="trib.beginTribulation()"
      >
        {{ trib.tribulationIsReady ? 'Face the Tribulation' : (cooldownRemaining > 0 ? `Cooldown ${cooldownRemaining}s` : 'Not ready') }}
      </button>
      <p v-if="trib.tribulationIsReady" class="warn">
        Warning: All banked Qi will be consumed as fuel.
      </p>
    </div>

    <div class="waves">
      <h4>Waves</h4>
      <div v-for="(wave, i) in cfg.waves" :key="wave.key" class="wave-row">
        <span :class="{ crossed: trib.tribulationIsActive && i < trib.tribWaveIndex }">
          {{ wave.name }}
        </span>
        <span class="wave-damage">{{ wave.damage }} damage</span>
      </div>
    </div>
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
  color: #e08fb4;
}
.pool-bar {
  width: 100%;
  height: 20px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
}
.pool-fill {
  height: 100%;
  background: linear-gradient(90deg, #e08fb4, #b486e0);
  transition: width 0.1s linear;
}
.waves {
  margin-top: 1rem;
}
.waves h4 {
  color: #888;
  font-size: 0.85rem;
  margin: 0 0 0.25rem 0;
}
.wave-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 0.15rem 0;
}
.wave-row .crossed {
  text-decoration: line-through;
  opacity: 0.5;
}
.wave-damage {
  color: #d44;
}
.scar-warn {
  color: #d44;
  font-size: 0.85rem;
}
.warn {
  color: #d8b25a;
  font-size: 0.85rem;
}
button {
  font-family: inherit;
  font-size: 1rem;
  padding: 0.4rem 0.8rem;
  background: #2a2a2a;
  color: #dfdfdf;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  margin: 0.5rem 0;
}
button:hover:not(:disabled) {
  background: #3a3a3a;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
