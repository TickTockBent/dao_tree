// src/stores/forge.ts — the Core Formation forge (set-piece instance 1).
//
// Port of the factory's performForge + refinementTick + core grade readers.
// The forge is a ONE-TIME event: spend Foundation currency (f.points) to
// produce a Core grade, then optionally refine it up to the Foundation ceiling.
// The core grade is stored on the Body layer (life-scoped); this store owns
// the c-layer refinement state (progress, warming, crack flag).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { SETPIECE_DATA, forgeGradeByKey } from '@/data/setpieces'
import { findRealm } from '@/data/realms'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useHeartDemonsStore } from '@/stores/heartDemons'
// Slice 10 (D40): the core grade-delta karma source (readerless, deferred).
import { recordGradeDelta } from '@/engine/karmaEvents'
import type { ForgePushKey } from '@/engine/types'

export interface ForgeSlice {
  refinementProgress: string
  warming: boolean
  lastForgeCracked: boolean
}

export function freshForgeSlice(): ForgeSlice {
  return { refinementProgress: '0', warming: false, lastForgeCracked: false }
}

// Named constants (§11).
const FORGE_FLOOR_INDEX = 0

export const useForgeStore = defineStore('forge', () => {
  const body = useBodyStore()
  const realm = useRealmStore()

  const refinementProgress = ref(decimalZero())
  const warming = ref(false)
  const lastForgeCracked = ref(false)

  // ---- Core grade reads (stored on Body) ----------------------------------

  /** Core grade index from the Body store (-1 = unforged). */
  const coreGradeIndex = computed(() => body.coreGrade)

  /** True if a core has been forged (index >= 0). */
  const coreIsForged = computed(() => coreGradeIndex.value >= 0)

  /** The stored Foundation band row (or null if no Foundation established). */
  const storedFoundationBand = computed(() => {
    const bandIndex = body.foundationGrade
    if (bandIndex < 0) return null
    const bands = findRealm('f').grade?.bands
    return bands ? bands[bandIndex] ?? null : null
  })

  /** Base core grade index the forge produces before push offset. */
  const coreBaseGradeIndex = computed(() => {
    const band = storedFoundationBand.value
    if (!band) return -1
    return forgeGradeByKey(band.baseCore).ceilingIndex
  })

  /** Hard cap a forged core can ever reach (from Foundation band's coreCeiling). */
  const coreCeilingGradeIndex = computed(() => {
    const band = storedFoundationBand.value
    if (!band) return -1
    return forgeGradeByKey(band.coreCeiling).ceilingIndex
  })

  /** Core grade global mult (the coreGradeMult pipeline factor). */
  const coreGradeMult = computed<Decimal>(() => {
    const idx = coreGradeIndex.value
    if (idx < 0) return decimalOne()
    const grade = SETPIECE_DATA.forge.grades.find((g) => g.ceilingIndex === idx)
    return grade ? new Decimal(grade.globalMult) : decimalOne()
  })

  // ---- Forge availability + cost ------------------------------------------

  /** Fuel cost for a push option: fuelBase × fuelMult. */
  function forgeFuelCost(pushKey: ForgePushKey): Decimal {
    const option = SETPIECE_DATA.forge.pushOptions.find((p) => p.key === pushKey)!
    return new Decimal(SETPIECE_DATA.forge.fuelBase).times(option.fuelMult)
  }

  /** True if the forge is open: Core unlocked, f.points >= forgeReq, not already forged. */
  const forgeIsAvailable = computed(() => {
    if (coreIsForged.value) return false
    if (!realm.isUnlocked('c')) return false
    return new Decimal(realm.stateOf('f').points).gte(SETPIECE_DATA.forge.forgeReq)
  })

  /** Can a specific push option be afforded right now? */
  function canAffordForgePush(pushKey: ForgePushKey): boolean {
    if (coreIsForged.value) return false
    const fState = realm.stateOf('f')
    return new Decimal(fState.points).gte(forgeFuelCost(pushKey))
  }

  // ---- The one-time forge action -----------------------------------------

  /**
   * Execute a one-time forge with the chosen push option. Spends f.points fuel,
   * computes finalGrade = min(baseCore + offset (minus crackTierDrop on crack),
   * foundationCeiling), clamps to Cracked floor, stores on Body. Returns the
   * resolved grade index, or -1 if the forge is not available.
   */
  function performForge(pushKey: ForgePushKey): number {
    if (!forgeIsAvailable.value) return -1
    const option = SETPIECE_DATA.forge.pushOptions.find((p) => p.key === pushKey)!
    if (!canAffordForgePush(pushKey)) return -1

    // Heart Demons (slice 8, §7.4 "reckless forge pushes"): the PUSH is the
    // corruption source, win or crack — Steady adds nothing (data-driven).
    useHeartDemonsStore().onForgePush(pushKey)

    // Spend the fuel (f.points).
    const fuelCost = forgeFuelCost(pushKey)
    const fState = realm.stateOf('f')
    const newPoints = new Decimal(fState.points).sub(fuelCost).max(0)
    realm.slice.f = { ...fState, points: newPoints.toString() }

    // Compute the produced grade.
    let producedIndex = coreBaseGradeIndex.value + option.offset

    // Crack roll.
    let cracked = false
    if (Math.random() < option.crackChance) {
      cracked = true
      producedIndex = producedIndex - SETPIECE_DATA.forge.crackTierDrop
    }

    // Clamp to [Cracked floor, Foundation ceiling].
    const ceiling = coreCeilingGradeIndex.value
    if (producedIndex < FORGE_FLOOR_INDEX) producedIndex = FORGE_FLOOR_INDEX
    if (ceiling >= 0 && producedIndex > ceiling) producedIndex = ceiling

    body.coreGrade = producedIndex
    lastForgeCracked.value = cracked
    // Slice 10 (D40): the core grade just landed — pay a grade-delta karma first
    // on a strict personal best across lives (the store gates it).
    recordGradeDelta('coreGradeDelta', body.coreGrade)
    return producedIndex
  }

  // ---- Refinement (§7b) ---------------------------------------------------

  /** True if the core is forged but below its ceiling (refinement can progress). */
  const refinementCanProgress = computed(() => {
    if (!coreIsForged.value) return false
    return coreGradeIndex.value < coreCeilingGradeIndex.value
  })

  /** Fraction [0,1] of the current refinement bar. */
  const refinementBarFraction = computed(() => {
    const goal = SETPIECE_DATA.forge.refinement.goal
    const fraction = refinementProgress.value.div(goal)
    if (fraction.lt(0)) return decimalZero()
    if (fraction.gt(1)) return decimalOne()
    return fraction
  })

  /** Per-tick accrual. Raises the grade one tier per full bar, capped at ceiling. */
  function refinementTick(diff: number): void {
    if (!warming.value || !refinementCanProgress.value) return
    const cfg = SETPIECE_DATA.forge.refinement
    const goal = new Decimal(cfg.goal)
    const gained = new Decimal(cfg.ratePerSecond).times(diff)
    let progress = refinementProgress.value.add(gained)

    let raisedThisTick = false
    while (progress.gte(goal) && refinementCanProgress.value) {
      progress = progress.sub(goal)
      const raised = body.coreGrade + cfg.tierStep
      const ceiling = coreCeilingGradeIndex.value
      body.coreGrade = raised > ceiling ? ceiling : raised
      raisedThisTick = true
    }
    // Slice 10 (D40): refinement raised the core grade — re-check the grade-delta
    // karma first (pays only on a strict personal best; the store gates it).
    if (raisedThisTick) recordGradeDelta('coreGradeDelta', body.coreGrade)
    // At the ceiling, drain leftover so the bar reads full-and-done.
    if (!refinementCanProgress.value) progress = decimalZero()
    refinementProgress.value = progress
  }

  function toggleWarming(): void {
    if (!refinementCanProgress.value) {
      warming.value = false
      return
    }
    warming.value = !warming.value
  }

  // ---- Update hook --------------------------------------------------------
  function update(diff: number): void {
    refinementTick(diff)
  }

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return {
      refinementProgress: refinementProgress.value.toString(),
      warming: warming.value,
      lastForgeCracked: lastForgeCracked.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshForgeSlice()) as Partial<ForgeSlice>
    refinementProgress.value = new Decimal(s.refinementProgress ?? '0')
    warming.value = s.warming ?? false
    lastForgeCracked.value = s.lastForgeCracked ?? false
  }
  function fresh(): Record<string, unknown> {
    return freshForgeSlice() as unknown as Record<string, unknown>
  }

  return {
    refinementProgress,
    warming,
    lastForgeCracked,
    coreGradeIndex,
    coreIsForged,
    coreBaseGradeIndex,
    coreCeilingGradeIndex,
    coreGradeMult,
    forgeIsAvailable,
    forgeFuelCost,
    canAffordForgePush,
    performForge,
    refinementCanProgress,
    refinementBarFraction,
    refinementTick,
    toggleWarming,
    update,
    save,
    load,
    fresh,
  }
})
