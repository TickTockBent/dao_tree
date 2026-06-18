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
}

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

  /** Sub-stage label reached at current best, or null. */
  function realmSubstageLabel(id: RealmId): string | null {
    return substageLabelAtBest(findRealm(id), realmBest(id).toNumber())
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
    return game.points.gte(findRealm(id).reqBase)
  }

  /** Prestige gain = ((points / reqBase) ^ gainExp × foundationGradeMult) ^ 1, floored, max 0. */
  function resetGain(id: RealmId): Decimal {
    if (!canReset(id)) return decimalZero()
    const r = findRealm(id)
    let gain = game.points.div(r.reqBase).pow(r.gainExp)
    if (r.graded) gain = gain.times(foundationGradeMult(body))
    gain = gain.pow(1) // TMT gainExp field is the constant 1.
    return gain.floor().max(0)
  }

  /** Qi required for the next prestige gain (the `nextAt`). */
  function nextAt(id: RealmId): Decimal {
    const r = findRealm(id)
    const nextGain = resetGain(id).add(1)
    // Invert: nextGain = (points/reqBase)^gainExp × gainMult → points = (nextGain/gainMult)^(1/gainExp) × reqBase.
    const gainMult = r.graded ? foundationGradeMult(body) : decimalOne()
    return nextGain.div(gainMult).root(r.gainExp).times(r.reqBase).max(r.reqBase).ceil()
  }

  // ---- Prestige + doReset cascade ----------------------------------------
  /**
   * Prestige a realm: validate, compute gain, run onPrestige (graded Foundation
   * grade), award points, then run the doReset cascade over lower tree layers.
   */
  function prestige(id: RealmId): void {
    if (!canReset(id)) return
    const r = findRealm(id)
    const gain = resetGain(id)

    // onPrestige runs BEFORE the cascade resets q (meridians/temper/q.best intact).
    if (r.graded) computeAndStoreFoundationGrade(body)

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

    // Run the doReset cascade: reset every strictly-lower same-tree tree-scoped layer.
    runDoResetCascade(id)

    // Reset Qi (player.points). Row 0 wipes to 0; higher rows reset to starting Qi (0).
    game.points = decimalZero()
  }

  /** Latch any newly-met sub-stage milestones for a realm. */
  function latchMilestones(id: RealmId): void {
    const r = findRealm(id)
    const best = realmBest(id).toNumber()
    const s = stateOf(id)
    const earned = new Set(s.milestones)
    r.substages.forEach((stage, index) => {
      if (best >= stage.at) earned.add(index)
    })
    slice.value[id] = { ...s, milestones: [...earned].sort((a, b) => a - b) }
  }

  /** Run the doReset cascade over all tree-scoped layers below the resetter. */
  function runDoResetCascade(resettingId: RealmId): void {
    const REALM_IDS: RealmId[] = ['q', 'f', 'c', 'n', 's']
    for (const targetId of REALM_IDS) {
      if (targetId === resettingId) continue
      const keepKeys = treeResetKeepKeys(targetId, resettingId, hasMilestone)
      if (keepKeys === null) continue // not reset (different scope/tree/row)
      resetRealm(targetId, keepKeys)
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
    for (const id of ['q', 'f', 'c', 'n', 's'] as RealmId[]) {
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
    for (const id of ['q', 'f', 'c', 'n', 's'] as RealmId[]) {
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
