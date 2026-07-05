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
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { HEART_DEMON_DATA, findDemonTrial } from '@/data/heart-demons'
import type { HeartDemonTrialKey } from '@/data/heart-demons'
import { findRealm } from '@/data/realms'
import { usePipelinesStore } from './pipelines'
import { useSoulStore } from './soul'
// Slice 10 (D36): enduring a trial is a deed first (realmEra-qualified). The
// soul-record (identity) and the karma deed (novelty income) ring together.
import { recordTrialDeed } from '@/engine/karmaEvents'
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

  /** Corruption value at which the next trial fires (for the panel's marker). */
  const nextThresholdAt = computed<number>(() => nextThreshold().at)

  const trialIsActive = computed<boolean>(() => activeTrial.value !== null)

  /** Qi/sec debuff while a trial holds (identity when none). */
  const trialQiMult = computed<Decimal>(() =>
    activeTrial.value === null
      ? decimalOne()
      : new Decimal(findDemonTrial(activeTrial.value).qiMultWhileActive),
  )

  /** Permanent Dao Heart Qi mult (qiMultPerStack ^ stacks; identity at 0). */
  const daoHeartQiMult = computed<Decimal>(() =>
    new Decimal(HEART_DEMON_DATA.daoHeart.qiMultPerStack).pow(daoHeartStacks.value),
  )

  /**
   * gatherQi target: reqBaseFactor × q.reqBase (a small finite number ~8000).
   * Kept finite by construction so the float-capped accumulator (below) is safe.
   */
  function gatherQiTarget(factor: number): number {
    return factor * findRealm('q').reqBase
  }

  // ---- Source hooks (called from realm/forge/tribulation — pinned) ---------

  /**
   * Add corruption from a source. While a trial is active, accumulation PAUSES
   * (§6.3): the amount banks toward the next threshold instead. `touched`
   * latches on any positive gain (reveals the panel).
   */
  function addCorruption(amount: number): void {
    if (amount <= 0) return
    touched.value = true
    if (activeTrial.value !== null) banked.value += amount
    else corruption.value += amount
  }

  /** Graded (Foundation) prestige landed at this band tier (§7.4 rushed breakthroughs). */
  function onGradedPrestige(bandTier: FoundationBandTier): void {
    const sources = HEART_DEMON_DATA.corruption.sources.rushedBreakthrough
    addCorruption((sources as Record<string, number>)[bandTier] ?? 0)
  }

  /** A forge push was performed (§7.4 reckless pushes; Steady adds nothing). */
  function onForgePush(pushKey: ForgePushKey): void {
    const sources = HEART_DEMON_DATA.corruption.sources.forgePush
    addCorruption((sources as Record<string, number>)[pushKey] ?? 0)
  }

  /** A tribulation resolved at this grade (§7.4; clean grades add nothing). */
  function onTribulationResolved(gradeKey: TribGradeKey): void {
    const sources = HEART_DEMON_DATA.corruption.sources.tribulation
    addCorruption((sources as Record<string, number>)[gradeKey] ?? 0)
  }

  /** Any realm prestige fired (objective progress for 'prestigeCount' trials). */
  function onTrialPrestige(): void {
    if (activeTrial.value === null) return
    if (findDemonTrial(activeTrial.value).objective.type === 'prestigeCount') {
      trialPrestiges.value += 1
    }
  }

  // ---- Trial state machine (§6.3) ------------------------------------------

  /** Corruption at which the next trial fires, and which trial it is. */
  function nextThreshold(): { at: number; trial: HeartDemonTrialKey } {
    const thresholds = HEART_DEMON_DATA.thresholds
    if (thresholdsCrossed.value < thresholds.length) {
      return thresholds[thresholdsCrossed.value]!
    }
    // Past the table: the final trial repeats every `repeatEvery` corruption.
    const last = thresholds[thresholds.length - 1]!
    const repeatsBeyond = thresholdsCrossed.value - thresholds.length
    return {
      at: last.at + HEART_DEMON_DATA.repeatEvery * (repeatsBeyond + 1),
      trial: last.trial,
    }
  }

  /** Begin a trial: zero objective progress, count the crossing. */
  function beginTrial(key: HeartDemonTrialKey): void {
    thresholdsCrossed.value += 1
    activeTrial.value = key
    trialElapsed.value = 0
    trialQiGathered.value = 0
    trialPrestiges.value = 0
  }

  /** Clear the active trial: grant a stack, flush banked corruption. */
  function clearTrial(): void {
    // Slice 10 / D36: the FLESH keeps the power (daoHeartStacks, life-scoped),
    // the SOUL keeps the record that it faced this trial (soul-scoped, carries
    // across rebirth). This one write is the only behavioral touch in the
    // slice-10 skeleton; the counter it writes has no reader yet.
    const clearedTrial = activeTrial.value
    if (clearedTrial !== null) {
      useSoulStore().recordTrialEndured(clearedTrial)
      recordTrialDeed(clearedTrial) // slice 10 (D36): the karma deed row
    }
    daoHeartStacks.value += 1
    activeTrial.value = null
    corruption.value += banked.value
    banked.value = 0
  }

  /** True once the active trial's objective is met. */
  function objectiveComplete(key: HeartDemonTrialKey): boolean {
    const objective = findDemonTrial(key).objective
    switch (objective.type) {
      case 'endure':
        return trialElapsed.value >= objective.seconds
      case 'gatherQi':
        return trialQiGathered.value >= gatherQiTarget(objective.reqBaseFactor)
      case 'prestigeCount':
        return trialPrestiges.value >= objective.count
    }
  }

  function update(diff: number): void {
    if (activeTrial.value === null) {
      // (a) passive orthodox bleed (paused during a trial).
      const bleedRate =
        HEART_DEMON_DATA.corruption.bleedPerSecond +
        HEART_DEMON_DATA.corruption.bleedPerDaoHeartStack * daoHeartStacks.value
      corruption.value = Math.max(0, corruption.value - bleedRate * diff)
      // (b) threshold crossing → begin the next (or queued) trial.
      const next = nextThreshold()
      if (corruption.value >= next.at) beginTrial(next.trial)
      return
    }
    // (c) a trial is active — progress its objective, then clear if met.
    const key = activeTrial.value
    const objective = findDemonTrial(key).objective
    if (objective.type === 'endure') {
      trialElapsed.value += diff
    } else if (objective.type === 'gatherQi') {
      // Cap accumulation at the (small, finite) target so late-game Qi/sec
      // rates can never overflow the plain-number accumulator.
      const rate = usePipelinesStore().qiPerSecond.toNumber() * diff
      const target = gatherQiTarget(objective.reqBaseFactor)
      trialQiGathered.value = Math.min(target, trialQiGathered.value + rate)
    }
    // prestigeCount progresses via onTrialPrestige (the realm hook).
    if (objectiveComplete(key)) clearTrial()
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
    // Validate the saved trial key against the data table (review catch): an
    // unknown key (stale save across a data rename) would otherwise throw in
    // findDemonTrial() on the next tick and halt the loop. Recovery: drop the
    // trial AND un-count its crossing, so the same threshold re-fires on the
    // next update with whatever trial the CURRENT data assigns it — the player
    // loses nothing but the partial objective progress.
    const savedTrial = s.activeTrial ?? null
    const trialKnown =
      savedTrial !== null && HEART_DEMON_DATA.trials.some((t) => t.key === savedTrial)
    activeTrial.value = trialKnown ? savedTrial : null
    if (savedTrial !== null && !trialKnown && thresholdsCrossed.value > 0) {
      thresholdsCrossed.value -= 1
    }
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
    nextThresholdAt,
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
