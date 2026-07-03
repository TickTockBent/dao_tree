// src/stores/realm.ts — the realm spine (q/f/c/n/s).
//
// Port of the factory's makeRealmLayer + makeMilestones + the realm state
// readers. One store manages all 5 Act I realms. Each realm carries prestige
// currency (points/best/total), unlocked latch, sub-stage milestones, and
// optional set-piece state (forge refinement, tribulation run). The doReset
// cascade is compiled from TREE_DATA + KEEP_RULES via engine/doReset.ts.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { meets } from '@/engine/meets'
import { buildGameState, realmReachedSubstageCount } from '@/engine/state'
import { treeResetKeepKeys } from '@/engine/doReset'
import { REALM_DATA, findRealm, substageLabelAtBest } from '@/data/realms'
import { useGameStore } from './game'
import { useBodyStore } from './body'
import { useSectStore } from './sect'
import { useAlchemyStore } from './alchemy'
import { useHeartDemonsStore } from './heartDemons'
import { useSoulStore } from './soul'
// Slice 9 §3 (scar-on-entry): scar/legacy/tribulation lookups are deferred
// (called inside prestige(), never hoisted into this store's setup()) because
// legacy.ts → tribulation.ts → realm.ts closes a real circular-instantiation
// loop — the same deferred-store-lookup pattern body.ts uses for useScarStore()
// and useSeveringStore().
import { useScarStore } from './scar'
import { useLegacyStore } from './legacy'
import { useTribulationStore } from './tribulation'
// Slice 9 D28 (The Offering): realm-x prestige is the offering action; the
// severing store owns the offering math (cost/afford/consume) and holds the
// severance count that drives realm-x sub-stages. Deferred lookup (called
// inside functions, never hoisted into setup()) — severing.ts already imports
// useRealmStore, so a top-level instantiation here would close the cycle.
import { useSeveringStore } from './severing'
import type { RealmId } from '@/engine/types'

// ---- State shape ----------------------------------------------------------

export interface RealmState {
  points: string
  best: string
  total: string
  unlocked: boolean
  resetTime: number
  milestones: number[]
}

export interface RealmSlice {
  q: RealmState
  f: RealmState
  c: RealmState
  n: RealmState
  s: RealmState
  x: RealmState
}

/** Every realm id in climb order — the single iteration list for this store. */
const ALL_REALM_IDS: readonly RealmId[] = ['q', 'f', 'c', 'n', 's', 'x']

function freshRealmState(unlocked: boolean): RealmState {
  return { points: '0', best: '0', total: '0', unlocked, resetTime: 0, milestones: [] }
}

export function freshRealmSlice(): RealmSlice {
  return {
    q: freshRealmState(true), // q starts unlocked
    f: freshRealmState(false),
    c: freshRealmState(false),
    n: freshRealmState(false),
    s: freshRealmState(false),
    x: freshRealmState(false), // slice 9: Spirit Severing (Act II)
  }
}

// ---- Foundation grade computation -----------------------------------------

/** gradeScore = clamp(weightMeridian×(meridians/denom) + weightTemper×(min(temper,denom)/denom) + weightRealm×(min(realmReachedSubstageCount("q"),denom)/denom), 0, 1). */
function foundationGradeScore(body: ReturnType<typeof useBodyStore>): Decimal {
  const grade = findRealm('f').grade!
  const meridianTerm = new Decimal(body.primaryMeridians)
    .div(grade.meridianDenominator)
    .times(grade.weightMeridian)
  const temperCapped = Math.min(body.temperLevel, grade.temperDenominator)
  const temperTerm = new Decimal(temperCapped).div(grade.temperDenominator).times(grade.weightTemper)
  const realmReached = Math.min(realmReachedSubstageCount('q'), grade.realmDenominator)
  const realmTerm = new Decimal(realmReached).div(grade.realmDenominator).times(grade.weightRealm)
  const score = meridianTerm.add(temperTerm).add(realmTerm)
  // Clamp to [0,1].
  if (score.lt(0)) return decimalZero()
  if (score.gt(1)) return decimalOne()
  return score
}

/** Band index for a score (last band whose floor the score meets; -1 if none). */
function foundationBandIndexForScore(score: Decimal): number {
  const bands = findRealm('f').grade!.bands
  let chosen = -1
  bands.forEach((band, index) => {
    if (score.gte(band.floor)) chosen = index
  })
  return chosen
}

/**
 * Compute the Foundation grade from current body/q state and store BEST on the
 * Body layer (never downgrades). Called on f prestige BEFORE the cascade resets
 * q (so meridians/temper/q.best are intact at compute time).
 */
function computeAndStoreFoundationGrade(body: ReturnType<typeof useBodyStore>): number {
  const score = foundationGradeScore(body)
  const bandIndex = foundationBandIndexForScore(score)
  if (bandIndex > body.foundationGrade) body.foundationGrade = bandIndex
  return body.foundationGrade
}

/** The live f-gain multiplier for the current Foundation band (1 if ungraded). */
function foundationGradeMult(body: ReturnType<typeof useBodyStore>): Decimal {
  const idx = body.foundationGrade
  if (idx < 0) return decimalOne()
  const bands = findRealm('f').grade!.bands
  const band = bands[idx]
  return band ? new Decimal(band.fMult) : decimalOne()
}

// ---- The store ------------------------------------------------------------

export const useRealmStore = defineStore('realm', () => {
  const game = useGameStore()
  const body = useBodyStore()
  const alchemy = useAlchemyStore()
  const heartDemons = useHeartDemonsStore()
  const soul = useSoulStore()

  const slice = ref<RealmSlice>(freshRealmSlice())

  // ---- Per-realm state access --------------------------------------------
  function stateOf(id: RealmId): RealmState {
    return slice.value[id]
  }

  /** realm.best (high-water prestige currency), zero if locked. */
  function realmBest(id: RealmId): Decimal {
    const s = stateOf(id)
    if (!s.unlocked) return decimalZero()
    return new Decimal(s.best)
  }

  /**
   * The sub-stage "reached" measure for a realm: realmBest for Act I realms,
   * but the SEVERANCE COUNT for realm x (D28 — x sub-stages `at` are
   * severance-count thresholds, not qi/points; realmBest('x') stays zero).
   */
  function substageReachedValue(id: RealmId): number {
    if (id === 'x') return useSeveringStore().severances.length
    return realmBest(id).toNumber()
  }

  /** Sub-stage label reached at current best (or, for x, severance count), or null. */
  function realmSubstageLabel(id: RealmId): string | null {
    return substageLabelAtBest(findRealm(id), substageReachedValue(id))
  }

  /** Top sub-stage `at` value (the fully-climbed mark). */
  function realmTopSubstageAt(id: RealmId): number {
    const r = findRealm(id)
    const last = r.substages[r.substages.length - 1]
    return last && last.at > 0 ? last.at : 1
  }

  function hasMilestone(layerId: string, milestone: number): boolean {
    if (layerId in slice.value) {
      return stateOf(layerId as RealmId).milestones.includes(milestone)
    }
    // Delegate to body/sect for non-realm milestone sources.
    if (layerId === 'b') return body.hasMilestone(milestone)
    if (layerId === 'sect') return useSectStore().hasMilestone(milestone)
    return false
  }

  // ---- Unlock / reveal / canReset ----------------------------------------
  function isUnlocked(id: RealmId): boolean {
    const s = stateOf(id)
    if (s.unlocked) return true
    return meets(findRealm(id).unlock, buildGameState())
  }

  function isRevealed(id: RealmId): boolean {
    const s = stateOf(id)
    if (s.unlocked) return true
    const r = findRealm(id)
    const revealCond = r.reveal ?? r.unlock
    return meets(revealCond, buildGameState())
  }

  function canReset(id: RealmId): boolean {
    const s = stateOf(id)
    if (!s.unlocked && !meets(findRealm(id).unlock, buildGameState())) return false
    // D28: realm x is the OFFERING — no qi threshold. canReset = unlock met
    // AND the next offering basket (qi + insight) is affordable.
    if (id === 'x') return useSeveringStore().canAffordOffering()
    return game.points.gte(findRealm(id).reqBase)
  }

  /** Prestige gain = ((points / reqBase) ^ gainExp × foundationGradeMult) ^ 1, floored, max 0. */
  function resetGain(id: RealmId): Decimal {
    // D28: realm-x points/best/total are RETIRED — the offering accrues no
    // prestige gain (the reward is the severance ramp, not a currency).
    if (id === 'x') return decimalZero()
    if (!canReset(id)) return decimalZero()
    const r = findRealm(id)
    let gain = game.points.div(r.reqBase).pow(r.gainExp)
    if (r.graded) gain = gain.times(foundationGradeMult(body))
    // Alchemy breakthrough aid (slice 7): folded HERE so the shown gain matches
    // the landed gain while a clarity charge is held; identity otherwise.
    gain = gain.times(alchemy.breakthroughGainMult(id))
    // "The core remembers" (slice 9, D2/D21): the c re-climb accelerates
    // across ascents. Identity until the keep-rule agent activates it with
    // the pin migration (same commit — Gate-D).
    gain = gain.times(soul.reclimbGainMult(id))
    gain = gain.pow(1) // TMT gainExp field is the constant 1.
    return gain.floor().max(0)
  }

  /** Qi required for the next prestige gain (the `nextAt`). */
  function nextAt(id: RealmId): Decimal {
    const r = findRealm(id)
    const nextGain = resetGain(id).add(1)
    // Invert: nextGain = (points/reqBase)^gainExp × gainMult → points = (nextGain/gainMult)^(1/gainExp) × reqBase.
    // The alchemy aid factor is part of gainMult so the shown nextAt stays honest while a charge is held.
    let gainMult = r.graded ? foundationGradeMult(body) : decimalOne()
    gainMult = gainMult.times(alchemy.breakthroughGainMult(id))
    gainMult = gainMult.times(soul.reclimbGainMult(id)) // keep nextAt honest (slice 9)
    return nextGain.div(gainMult).root(r.gainExp).times(r.reqBase).max(r.reqBase).ceil()
  }

  // ---- Prestige + doReset cascade ----------------------------------------
  /**
   * Prestige a realm: validate, compute gain, run onPrestige (graded Foundation
   * grade), award points, then run the doReset cascade over lower tree layers.
   */
  function prestige(id: RealmId): void {
    if (!canReset(id)) return
    // D28: realm x is the OFFERING action, not a qi climb. Consume the basket
    // (qi + insight, subtracted by performOffering), then run the EXISTING
    // hooks in the EXISTING order — scar-on-entry (first crossing), the
    // unlocked latch, and recordSeveranceRitual — all keep firing. No prestige
    // gain accrues (points/best/total stay zero, D28) and game.points is NOT
    // wiped: the offering consumed only its basket, not all remaining qi.
    if (id === 'x') {
      const severing = useSeveringStore()
      // Capture the first-crossing BEFORE the unlocked latch below (as the
      // generic path does): the first offering IS the crossing into Act II.
      const isFirstActTwoCrossing = !stateOf('x').unlocked
      if (!severing.performOffering()) return
      // Demon Trial objective progress (unchanged from the generic path).
      heartDemons.onTrialPrestige()
      // Unlocked latch only — no points/best/total award (retired, D28).
      const s = stateOf('x')
      slice.value.x = { ...s, unlocked: true, resetTime: 0 }
      // Sub-stage milestones now derive from severance count (D28).
      latchMilestones('x')
      // Scar-on-entry (slice 9 §3, retired spec §1.3): the first crossing
      // leaves the guaranteed scar. Reuses the shipped ONE-slot scar system;
      // typed per-act scar slots (retired spec §10.9) become necessary only
      // when Act III adds a SECOND act-entry scar — revisit then.
      if (isFirstActTwoCrossing) {
        useScarStore().deepenScar()
        useLegacyStore().recordActTwoEntry(useTribulationStore().tribGrade)
      }
      // The ritual clock advances on every offering (carries active ramps).
      soul.recordSeveranceRitual()
      // Cascade over lower same-tree layers — a no-op for x (act2 tree resets
      // nothing below), kept for correctness/symmetry.
      runDoResetCascade('x')
      return
    }
    // Below here handles the Act I realms only (q/f/c/n/s); realm x returned
    // above via its D28 offering branch.
    const r = findRealm(id)
    const gain = resetGain(id)
    // A held clarity charge boosted this gain (folded in resetGain) — consume it.
    const aidApplied = alchemy.breakthroughGainMult(id).gt(decimalOne())

    // onPrestige runs BEFORE the cascade resets q (meridians/temper/q.best intact).
    if (r.graded) {
      // Heart Demons (slice 8, §7.4 "rushed low-grade breakthroughs"): the
      // LIVE score band of THIS prestige — not the stored best — measures the
      // rush, so a weak breakthrough corrupts even a decorated cultivator.
      // Computed BEFORE computeAndStoreFoundationGrade so both read the same
      // pre-cascade state.
      const liveBandIndex = foundationBandIndexForScore(foundationGradeScore(body))
      const liveBand = findRealm('f').grade!.bands[liveBandIndex]
      if (liveBand) heartDemons.onGradedPrestige(liveBand.tier)
      computeAndStoreFoundationGrade(body)
    }
    if (aidApplied) alchemy.consumeBreakthroughAid(id)
    // Demon Trial objective progress (slice 8): every realm breakthrough counts.
    heartDemons.onTrialPrestige()

    // Award points: points += gain; best = max(best, points); total += gain.
    const s = stateOf(id)
    const newPoints = new Decimal(s.points).add(gain)
    const newBest = Decimal.max(new Decimal(s.best), newPoints)
    slice.value[id] = {
      ...s,
      points: newPoints.toString(),
      best: newBest.toString(),
      total: new Decimal(s.total).add(gain).toString(),
      unlocked: true,
      resetTime: 0,
    }

    // Latch sub-stage milestones (done() = best >= stage.at).
    latchMilestones(id)

    // (Scar-on-entry + the severance-ritual clock are handled in the D28
    // realm-x branch above; the Act I path below never touches them.)

    // Run the doReset cascade: reset every strictly-lower same-tree tree-scoped layer.
    runDoResetCascade(id)

    // Reset Qi (player.points). Row 0 wipes to 0; higher rows reset to starting Qi (0).
    game.points = decimalZero()
  }

  /** Latch any newly-met sub-stage milestones for a realm. */
  function latchMilestones(id: RealmId): void {
    const r = findRealm(id)
    // D28: realm x latches milestones off SEVERANCE COUNT (its sub-stage `at`
    // thresholds are cut-counts), so the qiMult bonuses reward CUTS, not
    // points; every Act I realm still latches off realmBest.
    const reached = substageReachedValue(id)
    const s = stateOf(id)
    const earned = new Set(s.milestones)
    r.substages.forEach((stage, index) => {
      if (reached >= stage.at) earned.add(index)
    })
    slice.value[id] = { ...s, milestones: [...earned].sort((a, b) => a - b) }
  }

  /** Run the doReset cascade over all tree-scoped layers below the resetter. */
  function runDoResetCascade(resettingId: RealmId): void {
    for (const targetId of ALL_REALM_IDS) {
      if (targetId === resettingId) continue
      const keepKeys = treeResetKeepKeys(targetId, resettingId, hasMilestone)
      if (keepKeys === null) continue // not reset (different scope/tree/row)
      const hadProgress = new Decimal(stateOf(targetId).points).gt(0)
      resetRealm(targetId, keepKeys)
      // Slice 9 (D2): an n/s cascade wiping live c progress begins a new
      // ascent — the counter the "core remembers" curve compounds over.
      // (Wiping an already-empty c is not a re-climb; mirrors the sim's
      // segment definition. The keep-rule agent owns any refinement.)
      if (targetId === 'c' && hadProgress && (resettingId === 'n' || resettingId === 's')) {
        soul.recordAscent()
      }
    }
  }

  /** Reset a realm's state, preserving any keep keys (best, milestones). */
  function resetRealm(id: RealmId, keepKeys: readonly string[]): void {
    const s = stateOf(id)
    const fresh = freshRealmState(s.unlocked)
    const preserved: Partial<RealmState> = {}
    for (const key of keepKeys) {
      if (key === 'best') preserved.best = s.best
      else if (key === 'milestones') preserved.milestones = [...s.milestones]
    }
    slice.value[id] = { ...fresh, ...preserved, unlocked: s.unlocked }
  }

  // ---- Pipeline multipliers ----------------------------------------------
  /** Per-realm realmMult: product of reached sub-stage qiMults. */
  function realmEffect(id: RealmId): Decimal {
    let product = decimalOne()
    const r = findRealm(id)
    const s = stateOf(id)
    r.substages.forEach((stage, index) => {
      if (s.milestones.includes(index)) product = product.times(stage.qiMult)
    })
    return product
  }

  /** Global realmMult: product across ALL unlocked realms' reached sub-stages. */
  const realmMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const r of REALM_DATA) {
      const s = stateOf(r.id)
      if (!s.unlocked) continue
      r.substages.forEach((stage, index) => {
        if (s.milestones.includes(index)) product = product.times(stage.qiMult)
      })
    }
    return product
  })

  // ---- Update hook (called each tick) ------------------------------------
  function update(diff: number): void {
    // Reset-time accrual + best maintenance for unlocked realms.
    for (const id of ALL_REALM_IDS) {
      const s = stateOf(id)
      if (!s.unlocked) continue
      const newResetTime = s.resetTime + diff
      const best = new Decimal(s.best)
      const points = new Decimal(s.points)
      const newBest = Decimal.max(best, points)
      slice.value[id] = {
        ...s,
        resetTime: newResetTime,
        best: newBest.eq(best) ? s.best : newBest.toString(),
      }
    }
    // Latch milestones for all unlocked realms (sub-stage done() re-evaluated).
    for (const id of ALL_REALM_IDS) {
      if (stateOf(id).unlocked) latchMilestones(id)
    }
  }

  // ---- Save slice --------------------------------------------------------
  function save(): Record<string, unknown> {
    return slice.value as unknown as Record<string, unknown>
  }
  function load(s: unknown): void {
    const loaded = (s ?? freshRealmSlice()) as Partial<RealmSlice>
    slice.value = {
      q: { ...freshRealmState(true), ...loaded.q },
      f: { ...freshRealmState(false), ...loaded.f },
      c: { ...freshRealmState(false), ...loaded.c },
      n: { ...freshRealmState(false), ...loaded.n },
      s: { ...freshRealmState(false), ...loaded.s },
      x: { ...freshRealmState(false), ...loaded.x }, // absent in pre-slice-9 saves → fresh
    }
  }
  function fresh(): Record<string, unknown> {
    return freshRealmSlice() as unknown as Record<string, unknown>
  }

  return {
    slice,
    stateOf,
    realmBest,
    realmSubstageLabel,
    realmTopSubstageAt,
    hasMilestone,
    isUnlocked,
    isRevealed,
    canReset,
    resetGain,
    nextAt,
    prestige,
    latchMilestones,
    realmEffect,
    realmMult,
    update,
    save,
    load,
    fresh,
  }
})

export { decimalOne, decimalZero }
export { realmReachedSubstageCount }
