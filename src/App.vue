<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { usePipelinesStore } from '@/stores/pipelines'
import { format } from '@/engine/format'
import { exportSave } from '@/engine/save'

const game = useGameStore()
const body = useBodyStore()
const realm = useRealmStore()
const pipelines = usePipelinesStore()

const { points } = storeToRefs(game)
const qiPerSec = computed(() => pipelines.qiPerSecond)
const canPrestige = computed(() => realm.canResetQ())
const prestigeGain = computed(() => realm.resetGainQ())
const qBest = computed(() => realm.slice.q.best)

function onPrestige() {
  realm.prestigeQ()
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

onMounted(() => {
  // Loop already started in main.ts; nothing to do here.
})
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
      <section class="panel">
        <h3>Qi Condensation</h3>
        <p>Best: {{ format(qBest) }}</p>
        <button :disabled="!canPrestige" @click="onPrestige">
          {{ canPrestige ? `Break through (+${format(prestigeGain)})` : 'Need 20 Qi' }}
        </button>
      </section>

      <section class="panel">
        <h3>Body</h3>
        <p>Primary meridians: {{ body.primaryMeridians }}/12 (×{{ format(body.meridianMult) }} Qi)</p>
        <button @click="body.buyPrimaryMeridian()">Open meridian</button>
        <p>Temper level: {{ body.temperLevel }}/24 (×{{ format(body.temperMult) }} Qi)</p>
        <button @click="body.buyTemper()">Temper</button>
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
