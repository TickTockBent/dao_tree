<script setup lang="ts">
// StancesPanel.vue — stance toggles (free, exclusive, opportunity cost).

import { computed } from 'vue'
import { useDaoStore } from '@/stores/dao'
import { STANCE_DATA } from '@/data/stances'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { format } from '@/engine/format'

const dao = useDaoStore()

function stanceUnlocked(unlock: import('@/engine/meets').Condition): boolean {
  return meets(unlock, buildGameState())
}

function effectLine(modifiers: { qiMult?: number; insightMult?: number }): string {
  const parts: string[] = []
  if (modifiers.qiMult !== undefined) {
    parts.push(`${format(modifiers.qiMult * 100)}% Qi/sec`)
  }
  if (modifiers.insightMult !== undefined) {
    parts.push(`${format(modifiers.insightMult * 100)}% Insight/sec`)
  }
  return parts.join(', ')
}

const visibleStances = computed(() => STANCE_DATA.stances.filter((s) => stanceUnlocked(s.unlock)))
</script>

<template>
  <section v-if="visibleStances.length > 0" class="panel">
    <h3>Stances</h3>
    <p class="stance-hint">Free toggles that trade one resource for another. Click to enter or release.</p>
    <div class="stance-grid">
      <button
        v-for="stance in visibleStances"
        :key="stance.key"
        :class="['stance-card', { active: dao.activeStance === stance.key }]"
        @click="dao.toggleStance(stance.key)"
      >
        <span class="stance-name">{{ stance.name }}</span>
        <span class="stance-effect">{{ effectLine(stance.modifiers) }}</span>
        <span class="stance-state">{{ dao.activeStance === stance.key ? 'ACTIVE — click to release' : 'Click to enter' }}</span>
      </button>
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
  color: #8a6fd8;
}
.stance-hint {
  color: #888;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.stance-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.stance-card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  min-width: 160px;
  text-align: left;
  font-family: inherit;
  color: #dfdfdf;
}
.stance-card:hover {
  background: #3a3a3a;
}
.stance-card.active {
  border-color: #8a6fd8;
  background: #2a2a3a;
}
.stance-name {
  font-weight: bold;
  color: #8a6fd8;
}
.stance-effect {
  font-size: 0.8rem;
  color: #5fc9e0;
}
.stance-state {
  font-size: 0.75rem;
  color: #888;
}
</style>
