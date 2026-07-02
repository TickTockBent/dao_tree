// src/stores/severing.ts — Spirit Severing: active severances + the
// transcendent multiplier (slice 9; docs/slice-9.md §2, D23/D25).
//
// LIFE-scoped (TREE_DATA layer 'severing'): severed things return next life.
// The eternal severance HISTORY lives on the soul store (D24).
//
// SKELETON STATUS: the state shape, save plumbing, and every consumer-facing
// getter are PINNED here; the ceremony (charge → commit → outcome), the
// live-contribution measurement shown on the severance menu (D11 — the game
// tells you exactly what you are giving up), sequential corpse gating
// (lived-with = breakeven crossed), and the real ramp math are the slice-9
// severing agent's surface. Every getter is identity/empty until then, so
// the game plays byte-identical to pre-slice-9 (the no-dead-mult invariant).
//
// CONTRACT for the implementer:
// - transcendentQiMult / transcendentInsightMult: product over active
//   severances of min(c·m·g^steps, k·m) per D25 (c/k/steps on
//   SETPIECE_DATA.severance; steps = soul.severanceRituals −
//   record.ritualStepsAtSever; m = the contribution captured at sever time).
//   The multiplier covers a SUPERSET of the severed domain (k > 1 makes the
//   lifetime cover definitional) — the cross-check lint verifies the SHAPE,
//   the sim asserts the pacing (never lint).
// - isSevered() is consulted by the nullification seams already wired in
//   pipelines.ts (soul aspect), body.ts (extraordinary meridians), and
//   alchemy.ts (profession pills) — implement the manifestation seam with
//   the lattice ring (dao store).
// - Severing calls soul.recordSeverance() (history) and captures the piece's
//   live contribution BEFORE nullifying it.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { SEVERING_DATA } from '@/data/severing'
import type { CorpseKey, SeverableKey } from '@/engine/types'

export interface SeveranceRecord {
  corpse: CorpseKey
  severable: SeverableKey
  /** soul.severanceRituals at sever time — the ramp counts steps from here. */
  ritualStepsAtSever: number
  /** Live contribution captured at sever time (Decimal strings — the m in c·m → k·m). */
  severedQiMult: string
  severedInsightMult: string
}

export interface SeveringSlice {
  severances: SeveranceRecord[]
}

export function freshSeveringSlice(): SeveringSlice {
  return { severances: [] }
}

export const useSeveringStore = defineStore('severing', () => {
  const slice = ref<SeveringSlice>(freshSeveringSlice())

  const severances = computed<readonly SeveranceRecord[]>(() => slice.value.severances)

  /** True if this piece is severed THIS LIFE (its effect is nullified). */
  function isSevered(key: SeverableKey): boolean {
    return slice.value.severances.some((s) => s.severable === key)
  }

  /** The next corpse to sever, or null when all three are cut. */
  const nextCorpse = computed<CorpseKey | null>(() => {
    const done = slice.value.severances.length
    return SEVERING_DATA.corpses[done]?.key ?? null
  })

  /**
   * Severables the player can cut RIGHT NOW (acquired + not already severed).
   * SKELETON: empty — the implementer derives availability from the owning
   * stores (aspect chosen / profession picked / ext track complete /
   * manifestation owned) and pairs each with its measured live contribution
   * for the menu (D11).
   */
  const liveSeverables = computed<readonly SeverableKey[]>(() => [])

  /** Whether the severing ceremony can begin (SKELETON: never). */
  const canSever = computed<boolean>(() => false)

  /** Perform a severance (SKELETON: refuses). Returns success. */
  function sever(severable: SeverableKey): boolean {
    void severable
    return false
  }

  /** Transcendent multiplier over the qi axis (identity until implemented). */
  const transcendentQiMult = computed<Decimal>(() => decimalOne())

  /** Transcendent multiplier over the insight axis (identity until implemented). */
  const transcendentInsightMult = computed<Decimal>(() => decimalOne())

  /** Tick hook (registered in main.ts/test-setup.ts; ceremony pacing lands here). */
  function update(diff: number): void {
    void diff
  }

  // ---- Save slice (id 'severing') -------------------------------------------
  function save(): Record<string, unknown> {
    return slice.value as unknown as Record<string, unknown>
  }
  function load(s: unknown): void {
    const loaded = (s ?? freshSeveringSlice()) as Partial<SeveringSlice>
    slice.value = {
      severances: Array.isArray(loaded.severances) ? [...loaded.severances] : [],
    }
  }
  function fresh(): Record<string, unknown> {
    return freshSeveringSlice() as unknown as Record<string, unknown>
  }

  return {
    slice,
    severances,
    isSevered,
    nextCorpse,
    liveSeverables,
    canSever,
    sever,
    transcendentQiMult,
    transcendentInsightMult,
    update,
    save,
    load,
    fresh,
  }
})
