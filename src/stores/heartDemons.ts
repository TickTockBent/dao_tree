// src/stores/heartDemons.ts — Heart Demon corruption + Demon Trials (slice 8).
//
// SKELETON: the public API below is the pinned contract — hooks in realm.ts
// (onGradedPrestige + onTrialPrestige), forge.ts (onForgePush), tribulation.ts
// (onTribulationResolved), and pipelines.ts (trialQiMult × daoHeartQiMult)
// call into it; App/Body UI reads it. The trial state machine is implemented
// by the slice-8 agent; every getter currently returns identity/default so
// the game plays unchanged until then.
//
// Contract notes for the implementer (design §6.3 concurrency, pinned):
//   - Corruption accumulation PAUSES during an active trial: source hooks add
//     to `banked` instead of `corruption`; the passive bleed also pauses.
//   - On clear: daoHeartStacks++, corruption resets to the cleared threshold's
//     floor... no — design keeps it simple: corruption continues from where it
//     stood; the cleared threshold is marked crossed (thresholdsCrossed++) so
//     the same threshold never re-fires. `banked` then flushes into corruption,
//     and if the flush crosses the NEXT threshold, the queued trial fires
//     immediately (one at a time — never two active).
//   - After the data's thresholds are exhausted, the final trial repeats every
//     HEART_DEMON_DATA.repeatEvery further corruption (the ladder never ends).
//   - Trials cannot fail: objectives only progress, never regress. Objective
//     progress lives on this store (trialElapsed / trialQiGathered /
//     trialPrestiges) and resets when a trial starts.
//   - All numbers from HEART_DEMON_DATA. Corruption is a plain number.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import type { HeartDemonTrialKey } from '@/data/heart-demons'
import type { ForgePushKey, TribGradeKey, FoundationBandTier } from '@/engine/types'

export interface DemonsSlice {
  /** The corruption stat (§7.4). Plain number; thresholds are small. */
  corruption: number
  /** Sources banked while a trial is active (flushed on clear). */
  banked: number
  /** How many threshold crossings have fired (incl. repeat-ladder firings). */
  thresholdsCrossed: number
  /** Permanent Dao Heart stacks earned from cleared trials. */
  daoHeartStacks: number
  /** The active trial, or null. */
  activeTrial: HeartDemonTrialKey | null
  /** Objective progress for the active trial. */
  trialElapsed: number
  trialQiGathered: number
  trialPrestiges: number
  /** Latched: corruption has ever been > 0 (reveals the panel + journal beat). */
  touched: boolean
}

export function freshDemonsSlice(): DemonsSlice {
  return {
    corruption: 0,
    banked: 0,
    thresholdsCrossed: 0,
    daoHeartStacks: 0,
    activeTrial: null,
    trialElapsed: 0,
    trialQiGathered: 0,
    trialPrestiges: 0,
    touched: false,
  }
}

export const useHeartDemonsStore = defineStore('heartDemons', () => {
  const corruption = ref(0)
  const banked = ref(0)
  const thresholdsCrossed = ref(0)
  const daoHeartStacks = ref(0)
  const activeTrial = ref<HeartDemonTrialKey | null>(null)
  const trialElapsed = ref(0)
  const trialQiGathered = ref(0)
  const trialPrestiges = ref(0)
  const touched = ref(false)

  /** Panel revealed once corruption has ever been gained. */
  function isRevealed(): boolean {
    return touched.value
  }

  const trialIsActive = computed<boolean>(() => activeTrial.value !== null)

  /** Qi/sec debuff while a trial holds (identity when none). */
  const trialQiMult = computed<Decimal>(() => decimalOne()) // TODO(slice-8 agent)

  /** Permanent Dao Heart Qi mult (qiMultPerStack ^ stacks; identity at 0). */
  const daoHeartQiMult = computed<Decimal>(() => decimalOne()) // TODO(slice-8 agent)

  // ---- Source hooks (called from realm/forge/tribulation — pinned) ---------

  /** Graded (Foundation) prestige landed at this band tier (§7.4 rushed breakthroughs). */
  function onGradedPrestige(_bandTier: FoundationBandTier): void {
    // TODO(slice-8 agent)
  }

  /** A forge push was performed (§7.4 reckless pushes; Steady adds nothing). */
  function onForgePush(_pushKey: ForgePushKey): void {
    // TODO(slice-8 agent)
  }

  /** A tribulation resolved at this grade (§7.4; clean grades add nothing). */
  function onTribulationResolved(_gradeKey: TribGradeKey): void {
    // TODO(slice-8 agent)
  }

  /** Any realm prestige fired (objective progress for 'prestigeCount' trials). */
  function onTrialPrestige(): void {
    // TODO(slice-8 agent)
  }

  function update(_diff: number): void {
    // TODO(slice-8 agent): bleed (paused in trial); threshold crossing → begin
    // trial; trial objective progress (endure/gatherQi via pipelines rate);
    // clear → daoHeartStacks++, flush banked, fire queued crossing.
  }

  function save(): Record<string, unknown> {
    return {
      corruption: corruption.value,
      banked: banked.value,
      thresholdsCrossed: thresholdsCrossed.value,
      daoHeartStacks: daoHeartStacks.value,
      activeTrial: activeTrial.value,
      trialElapsed: trialElapsed.value,
      trialQiGathered: trialQiGathered.value,
      trialPrestiges: trialPrestiges.value,
      touched: touched.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshDemonsSlice()) as Partial<DemonsSlice>
    corruption.value = s.corruption ?? 0
    banked.value = s.banked ?? 0
    thresholdsCrossed.value = s.thresholdsCrossed ?? 0
    daoHeartStacks.value = s.daoHeartStacks ?? 0
    activeTrial.value = s.activeTrial ?? null
    trialElapsed.value = s.trialElapsed ?? 0
    trialQiGathered.value = s.trialQiGathered ?? 0
    trialPrestiges.value = s.trialPrestiges ?? 0
    touched.value = s.touched ?? false
  }
  function fresh(): Record<string, unknown> {
    return freshDemonsSlice() as unknown as Record<string, unknown>
  }

  return {
    corruption,
    banked,
    thresholdsCrossed,
    daoHeartStacks,
    activeTrial,
    trialElapsed,
    trialQiGathered,
    trialPrestiges,
    touched,
    trialIsActive,
    trialQiMult,
    daoHeartQiMult,
    isRevealed,
    onGradedPrestige,
    onForgePush,
    onTribulationResolved,
    onTrialPrestige,
    update,
    save,
    load,
    fresh,
  }
})
