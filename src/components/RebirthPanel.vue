<script setup lang="ts">
// RebirthPanel — the Samsara crossing (slice 10 step 4, D39 + D32).
//
// The biggest moment in the game, rendered with weight and sparely. Two parts:
//   - THE RECEIPT: the karma ledger read BEFORE the crossing (D32 at-choice-time)
//     — headlines rung, echoes noted, what repeats paid nothing, the total.
//   - THE MENU FRAME: two slots (Memory Fragments, Roots) shown as the NEXT
//     life's choices, LOCKED/coming (step 5 populates them), plus the karma
//     balance that will carry.
// Arming the crossing restates the receipt total + what dies + what carries in
// plain words; a second, deliberate action crosses. Layout + confirm grammar
// follow SeveringPanel's conventions.

import { ref, computed } from 'vue'
import { useRebirthStore } from '@/stores/rebirth'
import { findRealm } from '@/data/realms'
import { findSeverable } from '@/data/severing'
import { format } from '@/engine/format'

const rebirth = useRebirthStore()

// Two-step confirm: false = the receipt + menu; true = the restate + cross.
const armed = ref(false)

const receipt = computed(() => rebirth.previewReceipt())
const balance = computed(() => rebirth.carriedBalance)
const richness = computed(() => rebirth.previewRichnessTier())

const headlineLines = computed(() => receipt.value.lines.filter((line) => line.kind === 'headline'))
const echoLines = computed(() => receipt.value.lines.filter((line) => line.kind === 'echo'))
const echoCount = computed(() => echoLines.value.length)

/** A humane name for a first's event key (best-effort; step 7 refines the chronicle UI). */
function firstLabel(key: string): string {
  const bare = key.split('#')[0] ?? key
  if (bare.startsWith('reachRealm:')) {
    const id = bare.slice('reachRealm:'.length)
    return `Reached ${findRealm(id as never)?.name ?? id}`
  }
  if (bare.startsWith('severed:')) return `Severed ${findSeverable(bare.slice('severed:'.length) as never)?.name ?? bare}`
  if (bare.startsWith('endureTrial:')) return 'Endured a heart-demon trial'
  if (bare.startsWith('clearedSite:')) return 'Cleared a hidden realm'
  if (bare === 'passFirstTribulation') return 'Crossed the First Tribulation'
  if (bare === 'latticeManifestation') return 'Manifested a Dao truth'
  if (bare === 'chooseProfession') return 'Walked a profession'
  if (bare === 'joinSect') return 'Joined a sect'
  if (bare === 'legacyGradeDelta') return 'A finer Legacy than any life before'
  if (bare === 'foundationGradeDelta') return 'A finer Foundation than any life before'
  if (bare === 'coreGradeDelta') return 'A finer Core than any life before'
  if (bare === 'tribulationGradeDelta') return 'A finer crossing than any life before'
  return bare
}

function arm(): void {
  armed.value = true
}
function cancel(): void {
  armed.value = false
}
function confirmCross(): void {
  rebirth.cross()
  armed.value = false
}
</script>

<template>
  <section class="rebirth-panel">
    <h4>The Wheel of Samsara</h4>
    <p class="preamble">
      The body you built is spent. You may let it go — nothing forces the wheel.
      What the flesh made dies; what the soul knows carries; the heavens weigh
      your firsts and pay.
    </p>

    <!-- THE RECEIPT — the ledger read before the crossing (D32). -->
    <section class="receipt">
      <h5>The heavens' account of this life</h5>
      <ul class="classes">
        <li><span>Milestones rung</span><strong>{{ format(receipt.milestoneHeadline) }}</strong></li>
        <li><span>Milestone echoes</span><strong>{{ format(receipt.milestoneEcho) }}</strong></li>
        <li><span>Deeds &amp; encounters</span><strong>{{ format(receipt.deedEncounter) }}</strong></li>
        <li><span>Grades surpassed</span><strong>{{ format(receipt.gradeDelta) }}</strong></li>
      </ul>
      <p class="total">Karma earned this life: <strong>{{ format(receipt.total) }}</strong></p>

      <div v-if="headlineLines.length > 0" class="lines">
        <p class="lines-head">Firsts (headlines):</p>
        <ul>
          <li v-for="line in headlineLines" :key="line.key" :class="{ faded: line.priorCount > 0 }">
            {{ firstLabel(line.key) }}
            <span class="pay">+{{ format(line.payout) }}</span>
            <span v-if="line.priorCount > 0" class="repeat">
              · not your first time ({{ line.priorCount }} prior){{ line.payout < 0.01 ? ' — paid nothing' : ' — diminished' }}
            </span>
          </li>
        </ul>
        <p v-if="echoCount > 0" class="echoes">
          …and {{ echoCount }} qualified {{ echoCount === 1 ? 'echo' : 'echoes' }}
          (the same deed in a different circumstance): +{{ format(receipt.milestoneEcho + receipt.deedEncounter) }} in all.
        </p>
      </div>
      <p v-else class="lines-empty">A quiet life — no firsts to its name. The wheel turns for it all the same.</p>

      <p class="richness dim">This life will be remembered as a
        <strong>{{ richness === 'chapter' ? 'chapter' : richness === 'summary' ? 'summary' : 'single line' }}</strong>
        in the chronicle.</p>
    </section>

    <!-- THE MENU FRAME — the next life's choices (step 5 populates them). -->
    <section class="menu">
      <h5>What you carry into the next life</h5>
      <p class="carries">
        Karma balance carried: <strong>{{ format(balance) }}</strong>
        <span class="dim">(+{{ format(receipt.total) }} once you cross)</span>
      </p>
      <ul class="slots">
        <li class="slot locked">
          <span class="slot-name">Memory Fragments</span>
          <span class="slot-state">the next life's choices — coming soon</span>
        </li>
        <li class="slot locked">
          <span class="slot-name">Roots</span>
          <span class="slot-state">the next life's body — coming soon</span>
        </li>
      </ul>
    </section>

    <!-- THE ARMED CONFIRM — restate what dies, what carries (D32). -->
    <div v-if="armed" class="confirm">
      <p class="confirm-q">Cross the wheel?</p>
      <p class="confirm-restate">
        The heavens pay <strong>{{ format(receipt.total) }}</strong> karma for this life's firsts.
        <br />
        <span class="dies">What dies:</span> this body — every realm climbed, every grade forged,
        every severance made, the qi and insight you banked. All of it.
        <br />
        <span class="carries-word">What carries:</span> the soul — its karma
        (<strong>{{ format(balance + receipt.total) }}</strong> after this), its ascents and seclusion,
        its journal and chronicle, the record of every trial it has faced.
      </p>
      <button class="danger" @click="confirmCross()">Cross into the next life</button>
      <button @click="cancel()">Not yet</button>
    </div>
    <button v-else class="arm-btn" @click="arm()">Let this life go</button>
  </section>
</template>

<style scoped>
.rebirth-panel {
  margin-top: 0.75rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid #4a3a6a;
  border-radius: 6px;
  background: #1a1622;
}
.rebirth-panel h4 {
  margin: 0 0 0.4rem;
  color: #c9a6f0;
  letter-spacing: 0.04em;
}
.rebirth-panel h5 {
  margin: 0 0 0.35rem;
  color: #b08fd8;
  font-size: 0.85rem;
}
.preamble {
  font-size: 0.85rem;
  color: #a89ab0;
  margin: 0 0 0.75rem;
  line-height: 1.4;
}
.receipt,
.menu {
  padding: 0.5rem 0.6rem;
  margin-bottom: 0.75rem;
  border: 1px solid #332b45;
  border-radius: 5px;
  background: #221a30;
}
.classes {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0;
}
.classes li {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #d8cfe0;
  padding: 0.1rem 0;
}
.classes strong {
  color: #f0e6a0;
}
.total {
  font-size: 0.95rem;
  margin: 0.5rem 0 0.4rem;
  color: #e8dff0;
}
.total strong {
  color: #f0d060;
}
.lines {
  margin-top: 0.5rem;
  border-top: 1px solid #332b45;
  padding-top: 0.4rem;
}
.lines-head {
  font-size: 0.8rem;
  color: #9a8fb0;
  margin: 0 0 0.25rem;
}
.lines ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lines li {
  font-size: 0.82rem;
  color: #c8bcd8;
  padding: 0.12rem 0;
}
.lines li.faded {
  color: #7a708a;
}
.pay {
  color: #9fd0a0;
  margin-left: 0.35rem;
}
.repeat {
  color: #8a7f95;
  font-size: 0.78rem;
}
.echoes {
  font-size: 0.8rem;
  color: #9ab0d8;
  margin: 0.4rem 0 0;
}
.lines-empty {
  font-size: 0.82rem;
  color: #8a7f95;
  font-style: italic;
  margin: 0.4rem 0;
}
.richness {
  font-size: 0.8rem;
  margin: 0.5rem 0 0;
}
.dim {
  color: #8a7f95;
}
.carries {
  font-size: 0.85rem;
  color: #d8cfe0;
  margin: 0.25rem 0 0.5rem;
}
.slots {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.slot {
  flex: 1 1 45%;
  min-width: 140px;
  padding: 0.5rem;
  border: 1px dashed #4a3a6a;
  border-radius: 5px;
  background: #1c1626;
}
.slot.locked {
  opacity: 0.65;
}
.slot-name {
  display: block;
  color: #c9a6f0;
  font-size: 0.85rem;
}
.slot-state {
  display: block;
  color: #8a7f95;
  font-size: 0.75rem;
  margin-top: 0.2rem;
}
.confirm {
  padding: 0.5rem 0.6rem;
  border: 1px solid #6a4a4a;
  border-radius: 5px;
  background: #241820;
}
.confirm-q {
  color: #e0a08f;
  font-size: 0.95rem;
  margin: 0 0 0.35rem;
}
.confirm-restate {
  font-size: 0.82rem;
  color: #cfc4d8;
  line-height: 1.5;
  margin: 0 0 0.5rem;
}
.dies {
  color: #e0a08f;
}
.carries-word {
  color: #9fd0a0;
}
.arm-btn {
  border-color: #6a4a9a;
  color: #d8c0f0;
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
  margin: 0.3rem 0.4rem 0 0;
}
button:hover:not(:disabled) {
  background: #3a3a3a;
}
button.danger {
  border-color: #7a3a3a;
  color: #e0a08f;
}
</style>
