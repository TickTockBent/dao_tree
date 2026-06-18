<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { usePipelinesStore } from '@/stores/pipelines'
import { format } from '@/engine/format'
import { exportSave } from '@/engine/save'
import type { RealmId } from '@/engine/types'
import { REALM_DATA } from '@/data/realms'

const game = useGameStore()
const body = useBodyStore()
const realm = useRealmStore()
const pipelines = usePipelinesStore()

const { points } = storeToRefs(game)
const qiPerSec = computed(() => pipelines.qiPerSecond)

// Realm rows for the prestige panels (only unlocked realms shown).
const visibleRealms = computed(() => REALM_DATA.filter((r) => realm.isUnlocked(r.id)))

function onPrestige(id: RealmId) {
  realm.prestige(id)
}
function onHardReset() {
  if (confirm('Hard reset? This wipes your save.')) game.hardReset()
}
function onExport() {
  const data = game.buildSave()
  const encoded = exportSave(data)
  navigator.clipboard?.writeText(encoded)
  alert('Save copied to clipboard.')
}
</script>

<template>
  <div class="app">
    <header class="overlay-head">
      <h2>
        <span class="points">{{ format(points) }}</span> Qi
        <span class="rate">(+{{ format(qiPerSec) }}/s)</span>
      </h2>
    </header>

    <main class="content">
      <section v-for="r in visibleRealms" :key="r.id" class="panel">
        <h3>{{ r.name }}</h3>
        <p>Best: {{ format(realm.realmBest(r.id)) }}</p>
        <p v-if="realm.canReset(r.id)">
          Gain: +{{ format(realm.resetGain(r.id)) }}
        </p>
        <button
          :disabled="!realm.canReset(r.id)"
          @click="onPrestige(r.id)"
        >
          {{ realm.canReset(r.id) ? `Break through (+${format(realm.resetGain(r.id))})` : `Need ${format(realm.nextAt(r.id))} Qi` }}
        </button>
      </section>

      <section class="panel">
        <h3>Body</h3>
        <p>Primary meridians: {{ body.primaryMeridians }} (×{{ format(body.meridianMult) }} Qi)</p>
        <button :disabled="!body.canAffordBuyable('primaryMeridian')" @click="body.buyBuyable('primaryMeridian')">
          Open meridian ({{ format(body.buyableCost('primaryMeridian', body.buyableAmount('primaryMeridian'))) }} Qi)
        </button>
        <p>Temper level: {{ body.temperLevel }} (×{{ format(body.temperMult) }} Qi)</p>
        <button :disabled="!body.canAffordBuyable('temper')" @click="body.buyBuyable('temper')">
          Temper ({{ format(body.buyableCost('temper', body.buyableAmount('temper'))) }} Qi)
        </button>
      </section>

      <section class="panel dev">
        <h3>Save</h3>
        <button @click="game.saveNow()">Save</button>
        <button @click="onExport">Export</button>
        <button @click="onHardReset">Hard reset</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app {
  font-family: 'Inconsolata', monospace;
  color: #dfdfdf;
  background: #0f0f0f;
  min-height: 100vh;
  padding: 1rem;
}
.overlay-head {
  text-align: center;
  padding: 0.5rem;
}
.overlay-head .points {
  color: #fff;
}
.overlay-head .rate {
  color: #5fc9e0;
  font-size: 0.9em;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
}
.panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}
.panel h3 {
  margin: 0 0 0.5rem 0;
  color: #5fc9e0;
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
  margin: 0.25rem 0.25rem 0.25rem 0;
}
button:hover:not(:disabled) {
  background: #3a3a3a;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dev {
  border-color: #555;
}
</style>
