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
import { ROOT_ELEMENTS } from '@/data/rebirth'
import type { Element, LatticeNodeKey } from '@/engine/types'
import { format } from '@/engine/format'

const rebirth = useRebirthStore()

// Two-step confirm: false = the receipt + menu; true = the restate + cross.
const armed = ref(false)

const receipt = computed(() => rebirth.previewReceipt())
const balance = computed(() => rebirth.carriedBalance)
const richness = computed(() => rebirth.previewRichnessTier())
// D39: the soul's most dramatic carry — attachments transcended across three lives.
const transcended = computed(() => rebirth.transcendedCarry)

// ---- The two-item menu (D38): fragments (Seeds) + roots -------------------
const seeds = computed(() => rebirth.carryableSeeds())
const selectedSeeds = computed(() => rebirth.selectedSeedKeys)
const draftElements = computed(() => rebirth.rootDraftElements)
// D43 #2: purity is a soul ratchet — current grade owned, one grade-up on offer.
const currentPurity = computed(() => rebirth.currentPurity)
const nextPurity = computed(() => rebirth.nextPurity)
const nextPurityCost = computed(() => rebirth.nextPurityCost)
const purityUpgradeSelected = computed(() => rebirth.purityUpgradeSelected)
const spendTotal = computed(() => rebirth.spendTotal)
const seedSpend = computed(() => rebirth.seedSpend)
const rootSpend = computed(() => rebirth.rootSpend)
const nextSeedPrice = computed(() => rebirth.nextSeedPrice)
const affordable = computed(() => rebirth.spendAffordable)
const balanceAfterSpend = computed(() => rebirth.balanceAfterSpend)

const elements: readonly Element[] = ROOT_ELEMENTS

function seedSelected(key: LatticeNodeKey): boolean {
  return selectedSeeds.value.includes(key)
}
function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
function elementHeld(element: Element): boolean {
  return draftElements.value.includes(element)
}

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

    <!-- THE MENU — the next life's choices (D38: memory fragments + roots). -->
    <section class="menu">
      <h5>What you carry into the next life</h5>
      <p class="carries">
        Karma balance carried: <strong>{{ format(balance) }}</strong>
        <span class="dim">(+{{ format(receipt.total) }} once you cross)</span>
      </p>
      <p v-if="transcended.length > 0" class="transcended-carry">
        Transcended attachments, gone at full ramp in every life to come:
        <strong>{{ transcended.join(', ') }}</strong>.
      </p>

      <div class="slots">
        <!-- Memory fragments — Seeds carry on an escalating curve. -->
        <div class="slot">
          <span class="slot-name">Memory Fragments</span>
          <p class="slot-help dim">
            Glimpses carry free. Pay to carry a Seed — each one dearer than the last
            ({{ format(nextSeedPrice) }} for the next).
          </p>
          <ul v-if="seeds.length > 0" class="seed-list">
            <li v-for="seed in seeds" :key="seed.key">
              <label>
                <input type="checkbox" :checked="seedSelected(seed.key)" @change="rebirth.toggleSeed(seed.key)" />
                {{ seed.name }}
              </label>
            </li>
          </ul>
          <p v-else class="dim slot-empty">No Seeds this life — only Glimpses, and those carry free.</p>
          <p class="slot-cost">Fragments: <strong>{{ format(seedSpend) }}</strong> karma</p>
        </div>

        <!-- Roots — the per-life SHAPE (count + identity) and the soul's purity ratchet. -->
        <div class="slot">
          <span class="slot-name">Spiritual Roots</span>
          <p class="slot-help dim">Choose the body you build. Rootless is the default — no cost, no speed.</p>
          <div class="element-chips">
            <button
              v-for="element in elements"
              :key="element"
              class="chip"
              :class="{ on: elementHeld(element) }"
              @click="rebirth.toggleRootElement(element)"
            >{{ titleCase(element) }}</button>
          </div>
          <!-- D43 #2: purity is a soul ratchet — the current grade is owned, and
               ONE grade-up is on offer (it carries to every future rooted life). -->
          <div class="purity-row">
            <span class="dim">Purity (soul):</span>
            <span class="chip owned">{{ titleCase(currentPurity) }} · owned</span>
            <button
              v-if="nextPurity !== null"
              class="chip"
              :class="{ on: purityUpgradeSelected }"
              @click="rebirth.setPurityUpgrade(!purityUpgradeSelected)"
            >Raise to {{ titleCase(nextPurity) }}<span class="chip-cost">{{ format(nextPurityCost) }}</span></button>
            <span v-else class="dim">Heaven-grade — the summit; nothing left to buy.</span>
          </div>
          <p v-if="nextPurity !== null" class="slot-help dim">A grade-up is forever — every rooted life you ever live carries it.</p>
          <p class="slot-cost">Roots: <strong>{{ format(rootSpend) }}</strong> karma</p>
        </div>
      </div>

      <p class="spend-total" :class="{ over: !affordable }">
        Total spend: <strong>{{ format(spendTotal) }}</strong> karma
        <span v-if="!affordable" class="over-warn">— more than you'll have</span>
      </p>
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
        <span class="carries-word">What carries:</span> the soul — its karma, its ascents and
        seclusion, its journal and chronicle, the record of every trial it has faced;
        and, free, every Dao truth you have Glimpsed.
        <br />
        <template v-if="transcended.length > 0">
          <span class="transcend-word">What transcends:</span> {{ transcended.join(', ') }} — cut across
          three lives, gone forever at full ramp from your next breath.
          <br />
        </template>
        <span class="spend-word">What you buy for the next life:</span>
        <template v-if="spendTotal > 0">
          {{ selectedSeeds.length }} carried
          {{ selectedSeeds.length === 1 ? 'Seed' : 'Seeds' }}<template v-if="draftElements.length > 0">, a root of
          {{ draftElements.map(titleCase).join(' / ') }}</template><template v-if="purityUpgradeSelected && nextPurity !== null">; the soul's purity rises to
          {{ titleCase(nextPurity) }} — forever</template> — <strong>{{ format(spendTotal) }}</strong> karma.
        </template>
        <template v-else>nothing — a rootless life, no fragments carried (the baseline).</template>
        <br />
        <span class="dim">Karma remaining after crossing: <strong>{{ format(balanceAfterSpend) }}</strong>.</span>
      </p>
      <button class="danger" :disabled="!affordable" @click="confirmCross()">Cross into the next life</button>
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
.slot-help {
  font-size: 0.75rem;
  margin: 0.25rem 0 0.4rem;
  line-height: 1.35;
}
.slot-empty {
  font-size: 0.78rem;
  font-style: italic;
  margin: 0.3rem 0;
}
.seed-list {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0;
}
.seed-list li {
  font-size: 0.8rem;
  color: #c8bcd8;
  padding: 0.1rem 0;
}
.seed-list label {
  cursor: pointer;
}
.seed-list input {
  margin-right: 0.35rem;
}
.slot-cost {
  font-size: 0.78rem;
  color: #a89ab0;
  margin: 0.4rem 0 0;
}
.slot-cost strong {
  color: #f0d060;
}
.element-chips,
.purity-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  margin: 0.3rem 0;
}
.chip {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  margin: 0;
  border: 1px solid #4a3a6a;
  border-radius: 999px;
  background: #1c1626;
  color: #b0a0c8;
}
.chip.on {
  background: #3a2c56;
  color: #e6d4ff;
  border-color: #8a6fd8;
}
.chip.owned {
  background: #241d30;
  color: #b6a8cf;
  border-style: dashed;
  cursor: default;
}
.chip-cost {
  margin-left: 0.3rem;
  font-size: 0.68rem;
  color: #9a8fb0;
}
.spend-total {
  font-size: 0.85rem;
  color: #d8cfe0;
  margin: 0.5rem 0 0;
}
.spend-total strong {
  color: #f0d060;
}
.spend-total.over strong {
  color: #e0a08f;
}
.over-warn {
  color: #e0a08f;
  font-size: 0.78rem;
}
.spend-word {
  color: #c9a6f0;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.transcend-word {
  color: #f0d060;
}
.transcended-carry {
  font-size: 0.82rem;
  color: #e8c860;
  margin: 0.35rem 0 0;
}
.transcended-carry strong {
  color: #f0d060;
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
