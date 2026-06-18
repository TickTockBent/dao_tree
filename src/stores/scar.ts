// src/stores/scar.ts — the failure-scar slot (cross-cutting; reads/writes Body).
//
// Port of the factory's deepenScar + scarHealTick + scarQiMult + temperedQiMult.
// ONE slot that DEEPENS (never stacks): a debuff while active, a heal arc that
// converts each depth into a permanent "Tempered by Ruin" buff. The scar slot
// state lives on the Body store (life-scoped); this store owns the scar/heal logic.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { SETPIECE_DATA } from '@/data/setpieces'
import { useBodyStore } from '@/stores/body'

export interface ScarSlice {
  scarHealProgress: number
}

export function freshScarSlice(): ScarSlice {
  return { scarHealProgress: 0 }
}

export const useScarStore = defineStore('scar', () => {
  const body = useBodyStore()

  /** Local copy of heal progress (also mirrored on body for save persistence). */
  const scarHealProgress = ref(0)

  // ---- Reads from Body ----------------------------------------------------

  /** Active (unhealed) depth: max(scarDepth - scarHealedDepth, 0). */
  const activeDepth = computed(() => Math.max(body.scarDepth - body.scarHealedDepth, 0))

  const scarIsActive = computed(() => activeDepth.value > 0)

  /** Active debuff: debuffQiMultPerDepth ^ activeDepth (the scarQiMult factor). */
  const scarQiMult = computed<Decimal>(() => {
    const cfg = SETPIECE_DATA.scar
    if (activeDepth.value <= 0) return decimalOne()
    return Decimal.pow(cfg.debuffQiMultPerDepth, activeDepth.value)
  })

  /** Permanent buff: temperedQiMultPerDepth ^ healedDepth (the temperedQiMult factor). */
  const temperedQiMult = computed<Decimal>(() => {
    const cfg = SETPIECE_DATA.scar
    if (body.scarHealedDepth <= 0) return decimalOne()
    return Decimal.pow(cfg.temperedQiMultPerDepth, body.scarHealedDepth)
  })

  // ---- Deepen + heal ------------------------------------------------------

  /**
   * Deepen the scar one step, capped at maxDepth. Resets in-flight heal progress
   * toward the NEW (deeper) depth. Called on a Failed or Scarred tribulation result.
   */
  function deepenScar(): void {
    const cfg = SETPIECE_DATA.scar
    if (body.scarDepth < cfg.maxDepth) {
      body.scarDepth = body.scarDepth + 1
      body.scarHealProgress = 0
      scarHealProgress.value = 0
    }
  }

  /** Heal goal for the current (next-to-heal) depth: healGoalPerDepth × (healedDepth + 1). */
  function scarHealGoal(): number {
    const cfg = SETPIECE_DATA.scar
    const depthBeingHealed = body.scarHealedDepth + 1
    return cfg.healGoalPerDepth * depthBeingHealed
  }

  /** Fraction [0,1] of the current heal bar. */
  const scarHealBarFraction = computed(() => {
    const goal = scarHealGoal()
    if (goal <= 0) return decimalZero()
    const fraction = body.scarHealProgress / goal
    if (fraction < 0) return decimalZero()
    if (fraction > 1) return decimalOne()
    return new Decimal(fraction)
  })

  /**
   * Passive heal accrual. Accrues only while the scar is active; a full heal bar
   * converts ONE depth to healedDepth and carries the remainder.
   */
  function scarHealTick(diff: number): void {
    if (!scarIsActive.value) return
    const cfg = SETPIECE_DATA.scar
    let progress = body.scarHealProgress + cfg.healRatePerSecond * diff

    while (scarIsActive.value && progress >= scarHealGoal()) {
      progress -= scarHealGoal()
      body.scarHealedDepth = body.scarHealedDepth + 1
    }
    // Fully healed: drain leftover.
    if (!scarIsActive.value) progress = 0
    body.scarHealProgress = progress
    scarHealProgress.value = progress
  }

  function update(diff: number): void {
    scarHealTick(diff)
  }

  // ---- Save slice ---------------------------------------------------------
  // The scar slot (depth, healedDepth) lives on the Body store; this store only
  // persists the heal progress (mirrored on body for convenience).
  function save(): Record<string, unknown> {
    return { scarHealProgress: body.scarHealProgress }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshScarSlice()) as Partial<ScarSlice>
    scarHealProgress.value = s.scarHealProgress ?? 0
    // Mirror to body (body owns the canonical slot for save persistence).
    body.scarHealProgress = s.scarHealProgress ?? 0
  }
  function fresh(): Record<string, unknown> {
    return freshScarSlice() as unknown as Record<string, unknown>
  }

  return {
    scarHealProgress,
    activeDepth,
    scarIsActive,
    scarQiMult,
    temperedQiMult,
    scarHealGoal,
    scarHealBarFraction,
    deepenScar,
    scarHealTick,
    update,
    save,
    load,
    fresh,
  }
})
