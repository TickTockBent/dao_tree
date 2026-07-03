<script setup lang="ts">
// SeveringPanel — the Spirit Severing set-piece (slice 9, D11/D23/D25).
//
// Three corpses in sequence. The active corpse opens a fully legible severance
// menu (D11 — the exact multipliers lost are shown BEFORE the cut) with a
// two-step in-panel confirm. Each completed cut shows its ramp: the weakness
// window below breakeven, the surplus above it. Layout follows
// ForgePanel/TribulationPanel conventions.

import { ref, computed } from 'vue'
import { useSeveringStore } from '@/stores/severing'
import { SEVERING_DATA, findSeverable } from '@/data/severing'
import { SETPIECE_DATA } from '@/data/setpieces'
import { format } from '@/engine/format'
import type { SeverableKey } from '@/engine/types'

const severing = useSeveringStore()
const severCfg = SETPIECE_DATA.severance

// The severable armed for the second confirm step (null = menu, no pending cut).
const armedSeverable = ref<SeverableKey | null>(null)

const severedCount = computed(() => severing.severances.length)

// Per-corpse readout rows for the completed cuts (indexed access would be
// possibly-undefined; a filtered list keeps the template strictly typed).
const readouts = computed(() =>
  severing.severances.map((record) => ({
    corpse: record.corpse,
    name: findSeverable(record.severable).name,
    readout: severing.readoutFor(record),
  })),
)

function armSever(key: SeverableKey): void {
  armedSeverable.value = key
}
function cancelSever(): void {
  armedSeverable.value = null
}
function confirmSever(key: SeverableKey): void {
  severing.sever(key)
  armedSeverable.value = null
}
</script>

<template>
  <div class="severing-panel">
    <h4>The Three Corpses</h4>
    <ol class="corpses">
      <li v-for="(corpse, index) in SEVERING_DATA.corpses" :key="corpse.key">
        <div class="corpse-head">
          <strong>{{ corpse.name }}</strong>
          <span v-if="index < severedCount" class="tag severed">severed</span>
          <span v-else-if="corpse.key === severing.nextCorpse" class="tag active">the cut before you</span>
          <span v-else class="tag locked">beyond reach</span>
        </div>

        <!-- A completed severance: its ramp readout (weakness window vs surplus). -->
        <template v-if="index < severedCount">
          <div
            v-for="entry in readouts.filter((e) => e.corpse === corpse.key)"
            :key="entry.corpse"
            class="readout"
          >
            <p class="cut-what">Cut: <strong>{{ entry.name }}</strong></p>
            <p :class="['state', entry.readout.breakevenCrossed ? 'surplus' : 'weakness']">
              {{ entry.readout.breakevenCrossed ? 'Surplus — the severance repays the cut' : 'Weakness window — the cut still costs you' }}
            </p>
            <p>
              Transcendent multiplier: Qi ×{{ format(entry.readout.qiMult) }},
              Insight ×{{ format(entry.readout.insightMult) }}
            </p>
            <p class="steps">
              Ritual step {{ entry.readout.displayStep }} / {{ entry.readout.capStep }} —
              breakeven at step {{ entry.readout.breakevenStep }}
              <span v-if="!entry.readout.breakevenCrossed">
                ({{ entry.readout.breakevenStep - entry.readout.displayStep }} to go)
              </span>
            </p>
          </div>
        </template>

        <!-- The active corpse: the fully-legible severance menu (D11). -->
        <template v-else-if="corpse.key === severing.nextCorpse">
          <p class="flavor">{{ corpse.flavor }}</p>
          <p v-if="!severing.previousLivedWith" class="warn">
            The previous severance must be lived with (breakeven crossed) before this corpse opens.
          </p>
          <p v-else-if="severing.liveSeverables.length === 0" class="warn">
            Nothing you hold can yet be cut — acquire a severable first.
          </p>
          <ul v-else class="menu">
            <li v-for="key in severing.liveSeverables" :key="key" class="candidate">
              <div v-for="contribution in [severing.contributionOf(key)]" :key="key">
                <p class="cand-name"><strong>{{ findSeverable(key).name }}</strong></p>
                <p class="flavor">{{ findSeverable(key).flavor }}</p>
                <p class="lost">
                  You give up: Qi ×{{ format(contribution.qi) }}<span
                    v-if="!contribution.insight.eq(1)"
                  >, Insight ×{{ format(contribution.insight) }}</span>
                </p>
                <p class="gain">
                  In return: a transcendent multiplier over its domain, starting at
                  ×{{ severCfg.startFraction }} of what was cut and rising to
                  ×{{ severCfg.capRatio }} by ritual step {{ severCfg.rampSteps }}.
                </p>

                <div v-if="armedSeverable === key" class="confirm">
                  <span class="confirm-q">Sever this? The weakness window opens immediately.</span>
                  <button class="danger" @click="confirmSever(key)">Sever</button>
                  <button @click="cancelSever()">Keep</button>
                </div>
                <button
                  v-else
                  :disabled="!severing.canSever"
                  @click="armSever(key)"
                >
                  Choose to sever
                </button>
              </div>
            </li>
          </ul>
        </template>

        <template v-else>
          <p class="flavor locked-flavor">A corpse you cannot yet reach.</p>
        </template>
      </li>
    </ol>
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
  counter-reset: corpse;
}
.corpses > li {
  margin: 0.75rem 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid #3a3145;
  border-radius: 6px;
  background: #1c1822;
}
.corpse-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.tag {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.tag.severed {
  background: #2a3a2a;
  color: #8fd8a0;
}
.tag.active {
  background: #3a2f45;
  color: #c9a6f0;
}
.tag.locked {
  background: #2a2a2a;
  color: #777;
}
.flavor {
  font-size: 0.85rem;
  color: #a89ab0;
  margin: 0.35rem 0;
}
.locked-flavor {
  opacity: 0.6;
}
.menu {
  list-style: none;
  padding: 0;
  margin: 0.4rem 0 0;
}
.candidate {
  margin: 0.4rem 0;
  padding: 0.5rem;
  border: 1px solid #332b3d;
  border-radius: 5px;
}
.cand-name {
  margin: 0 0 0.15rem;
}
.lost {
  color: #e0a08f;
  font-size: 0.85rem;
  margin: 0.25rem 0;
}
.gain {
  color: #9fd0c0;
  font-size: 0.82rem;
  margin: 0.25rem 0;
}
.confirm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.confirm-q {
  font-size: 0.82rem;
  color: #d8b25a;
}
.readout {
  margin-top: 0.4rem;
  font-size: 0.85rem;
}
.cut-what {
  margin: 0.2rem 0;
}
.state {
  font-weight: 600;
  margin: 0.25rem 0;
}
.state.weakness {
  color: #e0a08f;
}
.state.surplus {
  color: #8fd8a0;
}
.steps {
  color: #888;
  font-size: 0.8rem;
  margin: 0.2rem 0;
}
.warn {
  color: #d8b25a;
  font-size: 0.85rem;
}
button {
  font-family: inherit;
  font-size: 0.9rem;
  padding: 0.35rem 0.7rem;
  background: #2a2a2a;
  color: #dfdfdf;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  margin: 0.3rem 0.3rem 0 0;
}
button:hover:not(:disabled) {
  background: #3a3a3a;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
button.danger {
  border-color: #7a3a3a;
  color: #e0a08f;
}
</style>
