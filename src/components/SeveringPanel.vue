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
import { useRealmStore } from '@/stores/realm'
import { SEVERING_DATA, findSeverable, findCorpse } from '@/data/severing'
import { SETPIECE_DATA } from '@/data/setpieces'
import { format } from '@/engine/format'
import type { SeverableKey } from '@/engine/types'

const severing = useSeveringStore()
const realm = useRealmStore()
const severCfg = SETPIECE_DATA.severance

// D28: the offering — prestige('x') consumes a basket of qi + insight. The
// panel shows the exact next-offering cost (D11 — never veil the now), the
// corpse whose rite it is (D30: the corpse JUST CUT — you pay the rite of the
// thing you gave up while mastering that loss; the Past before the first cut),
// and the pill + mastery discount state.
const offering = computed(() => severing.offeringInfo)
function makeOffering(): void {
  realm.prestige('x')
}

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

// D32: recovery math at choice time — the breakeven timeline + offering cost
// trajectory for a HYPOTHETICAL cut, shown before the knife (never veil the
// now). recoverySummary is the one-line readout under each candidate;
// recoveryDetail is the per-turning breakdown, sat in a title tooltip (the
// lighter convention already used here — no expand/details pattern exists
// elsewhere in this codebase to reuse instead).
type RecoveryProjectionLike = ReturnType<typeof severing.recoveryProjection>

function recoveryDetail(recovery: RecoveryProjectionLike): string {
  return recovery.trajectory
    .map((turning) => `Turning ${turning.index + 1}: ~${format(turning.qi)} Qi, ~${format(turning.insight)} Insight`)
    .join('\n')
}

function recoverySummary(recovery: RecoveryProjectionLike): string {
  const corpseName = findCorpse(recovery.corpse).name
  return (
    `Breakeven: after ${recovery.turningsToBreakeven} turnings (of ${recovery.capStep} to full mastery). ` +
    `The ${recovery.turningsToBreakeven} turnings of ${corpseName}'s rite will ask: ` +
    `~${format(recovery.totalQi)} Qi, ~${format(recovery.totalInsight)} Insight in total.`
  )
}
</script>

<template>
  <div class="severing-panel">
    <!-- D28: The Offering — the next ritual step's exact cost (a basket of Act I
         resources, consumed). prestige('x') is a sacrifice, not a qi climb. -->
    <section class="offering">
      <h4>The Offering</h4>
      <p class="offering-rite">
        The rite of <strong>{{ findCorpse(offering.corpse).name }}</strong>
      </p>
      <p class="offering-cost">
        Give up: <strong>{{ format(offering.qi) }}</strong> Qi
        <span :class="{ short: offering.qiShort }">(hold {{ format(offering.qiHave) }})</span>
        and <strong>{{ format(offering.insight) }}</strong> Insight
        <span :class="{ short: offering.insightShort }">(hold {{ format(offering.insightHave) }})</span>
      </p>
      <p class="offering-discounts">
        Mastery discount ×{{ format(offering.masteryScale) }}
        <span class="dim">from {{ offering.rituals }} rituals performed</span>
        <span v-if="offering.pillActive" class="pill-on"> · pill active (offering discounted)</span>
        <span v-else class="dim"> · no pill active</span>
      </p>
      <button
        class="offer-btn"
        :disabled="!offering.affordable"
        @click="makeOffering()"
      >
        Make the Offering
      </button>
      <p v-if="!offering.affordable" class="warn offer-reason">
        <template v-if="offering.qiShort && offering.insightShort">Not enough Qi or Insight yet.</template>
        <template v-else-if="offering.qiShort">Not enough Qi yet.</template>
        <template v-else>Not enough Insight yet.</template>
      </p>
    </section>

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
          <template v-else>
            <p v-if="severing.liveSeverables.length === 0" class="warn">
              Nothing you hold can yet be cut — acquire a severable first.
            </p>
            <!-- D35: a worn stance too lopsided to survive as flesh is wearable
                 but NOT lockable — say why (principle #35 eligibility). -->
            <p v-if="severing.flowingFormBlockReason" class="warn">
              {{ severing.flowingFormBlockReason }}
            </p>
          </template>
          <ul v-if="severing.previousLivedWith && severing.liveSeverables.length > 0" class="menu">
            <li v-for="key in severing.liveSeverables" :key="key" class="candidate">
              <div
                v-for="cand in [{ contribution: severing.contributionOf(key), recovery: severing.recoveryProjection(key) }]"
                :key="key"
              >
                <p class="cand-name"><strong>{{ findSeverable(key).name }}</strong></p>
                <p class="flavor">{{ findSeverable(key).flavor }}</p>
                <!-- D35: the Flowing Form cut locks the CURRENTLY WORN stance into
                     flesh — name it so the choice is legible (D11). -->
                <p v-if="key === 'flowingForm' && severing.wornStanceName" class="locks-form">
                  Locks <strong>{{ severing.wornStanceName }}</strong> — the form you wear becomes
                  permanent flesh. Other stances still stack on top of it.
                </p>
                <p class="lost">
                  You give up: Qi ×{{ format(cand.contribution.qi) }}<span
                    v-if="!cand.contribution.insight.eq(1)"
                  >, Insight ×{{ format(cand.contribution.insight) }}</span>
                </p>
                <p class="gain">
                  In return: a transcendent multiplier over its domain, starting at
                  ×{{ severCfg.startFraction }} of what was cut and rising to
                  ×{{ severCfg.capRatio }} by ritual step {{ severCfg.rampSteps }}.
                </p>
                <p class="recovery" :title="recoveryDetail(cand.recovery)">
                  {{ recoverySummary(cand.recovery) }}
                </p>
                <!-- D39/D32: three-lives legibility — show how many past lives
                     already cut this piece, and announce the third cut BEFORE the
                     knife (never discovered after the fact). -->
                <p v-if="severing.pastLivesSevered(key) > 0" class="lives-severed">
                  Severed in {{ severing.pastLivesSevered(key) }} past
                  {{ severing.pastLivesSevered(key) === 1 ? 'life' : 'lives' }}.
                </p>
                <p v-if="severing.severWouldTranscend(key)" class="transcend-warn">
                  This severance will <strong>transcend</strong>: permanent, across all future lives.
                  The piece will be gone at full ramp from your next breath onward — no weakness
                  window ever again.
                </p>

                <div v-if="armedSeverable === key" class="confirm">
                  <span class="confirm-q">Sever this? The weakness window opens immediately.</span>
                  <p class="confirm-recovery">{{ recoverySummary(cand.recovery) }}</p>
                  <p v-if="severing.severWouldTranscend(key)" class="confirm-transcend">
                    This is your third cut of {{ findSeverable(key).name }} across three lives — it
                    will <strong>transcend</strong>: permanent, across all future lives.
                  </p>
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
.offering {
  padding: 0.5rem 0.6rem;
  margin-bottom: 0.75rem;
  border: 1px solid #4a3a6a;
  border-radius: 6px;
  background: #221a30;
}
.offering h4 {
  margin: 0 0 0.35rem;
  color: #c9a6f0;
}
.offering-rite {
  font-size: 0.9rem;
  margin: 0.25rem 0;
}
.offering-cost {
  font-size: 0.85rem;
  color: #d8cfe0;
  margin: 0.35rem 0;
}
.offering-cost .short {
  color: #e0a08f;
}
.offering-discounts {
  font-size: 0.8rem;
  color: #9fd0c0;
  margin: 0.3rem 0;
}
.offering-discounts .dim {
  color: #8a7f95;
}
.offering-discounts .pill-on {
  color: #d8b25a;
}
.offer-btn {
  border-color: #6a4a9a;
  color: #d8c0f0;
}
.offer-reason {
  margin: 0.3rem 0 0;
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
.locks-form {
  color: #c9a6f0;
  font-size: 0.82rem;
  margin: 0.25rem 0;
}
.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.confirm-q {
  font-size: 0.82rem;
  color: #d8b25a;
}
.recovery {
  color: #9ab0d8;
  font-size: 0.8rem;
  margin: 0.25rem 0;
  cursor: help;
}
.confirm-recovery {
  flex-basis: 100%;
  color: #9ab0d8;
  font-size: 0.8rem;
  margin: 0;
}
.lives-severed {
  color: #c9a6f0;
  font-size: 0.8rem;
  margin: 0.25rem 0;
}
.transcend-warn {
  color: #e8c860;
  font-size: 0.82rem;
  margin: 0.3rem 0;
  padding: 0.3rem 0.4rem;
  border: 1px solid #6a5a2a;
  border-radius: 4px;
  background: #241f14;
}
.transcend-warn strong,
.confirm-transcend strong {
  color: #f0d060;
}
.confirm-transcend {
  flex-basis: 100%;
  color: #e8c860;
  font-size: 0.82rem;
  margin: 0.2rem 0 0;
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
