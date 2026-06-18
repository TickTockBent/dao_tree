<script setup lang="ts">
// ForgePanel.vue — the Core Formation forge (set-piece instance 1).

import { computed } from 'vue'
import { useForgeStore } from '@/stores/forge'
import { useRealmStore } from '@/stores/realm'
import { SETPIECE_DATA } from '@/data/setpieces'
import { format } from '@/engine/format'
import type { ForgePushKey } from '@/engine/types'

const forge = useForgeStore()
const realm = useRealmStore()

const forgeConfig = SETPIECE_DATA.forge

const fPoints = computed(() => realm.stateOf('f').points)

const coreGradeLabel = computed(() => {
  if (!forge.coreIsForged) return 'No core forged'
  const grade = forgeConfig.grades.find((g) => g.ceilingIndex === forge.coreGradeIndex)
  return grade ? `${grade.label} (×${grade.globalMult} Qi)` : ''
})

const ceilingLabel = computed(() => {
  const idx = forge.coreCeilingGradeIndex
  if (idx < 0) return '—'
  return forgeConfig.grades.find((g) => g.ceilingIndex === idx)?.label ?? '—'
})

function onPush(key: ForgePushKey): void {
  if (!confirm(`Forge with ${key}? This is permanent.`)) return
  forge.performForge(key)
}
</script>

<template>
  <section class="panel">
    <h3>Core Forge</h3>

    <div v-if="!forge.coreIsForged">
      <p v-if="!forge.forgeIsAvailable">
        Requires Core Formation unlocked and {{ forgeConfig.forgeReq }} Foundation.
      </p>
      <div v-else>
        <p>Foundation fuel: <b>{{ format(fPoints) }}</b></p>
        <p>Base core: {{ forgeConfig.grades[forge.coreBaseGradeIndex]?.label }} | Ceiling: {{ ceilingLabel }}</p>
        <div class="push-grid">
          <button
            v-for="option in forgeConfig.pushOptions"
            :key="option.key"
            :disabled="!forge.canAffordForgePush(option.key)"
            @click="onPush(option.key)"
          >
            <span class="push-name">{{ option.label }}</span>
            <span class="push-cost">{{ format(forge.forgeFuelCost(option.key)) }} Foundation</span>
            <span class="push-risk">
              +{{ option.offset }} tier{{ option.crackChance > 0 ? `, ${format(option.crackChance * 100)}% crack` : '' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <p>Core: <b>{{ coreGradeLabel }}</b></p>
      <p v-if="forge.lastForgeCracked" class="crack-warn">The core cracked during forging.</p>
      <p>Ceiling: {{ ceilingLabel }}</p>

      <div v-if="forge.refinementCanProgress">
        <p>Refinement: {{ format(forge.refinementBarFraction.times(100)) }}%</p>
        <button @click="forge.toggleWarming()">
          {{ forge.warming ? 'Stop refining' : 'Begin refining' }}
        </button>
      </div>
      <p v-else-if="forge.coreGradeIndex >= forge.coreCeilingGradeIndex" class="maxed">Core at ceiling.</p>
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
  color: #e0a33a;
}
.push-grid {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.push-grid button {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: #dfdfdf;
  min-width: 120px;
}
.push-grid button:hover:not(:disabled) {
  background: #3a3a3a;
  border-color: #e0a33a;
}
.push-grid button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.push-name {
  font-weight: bold;
  color: #e0a33a;
}
.push-cost {
  font-size: 0.8rem;
  color: #d8b25a;
}
.push-risk {
  font-size: 0.75rem;
  color: #888;
}
.crack-warn {
  color: #d44;
  font-size: 0.85rem;
}
.maxed {
  color: #5fc9e0;
}
</style>
