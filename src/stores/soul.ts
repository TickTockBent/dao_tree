// src/stores/soul.ts — the soul-scoped accumulators (slice 9; D21/D23/D25).
//
// Holds the first two typed-accumulator instances (src/data/accumulators.ts):
// the ascent counter ("the core remembers") and the severance ritual ("master
// the severance"), plus the per-attachment severance HISTORY (D24 — recorded
// from day one so the three-lives-transcendence promise is data-real before
// Samsara ships the mechanic).
//
// SCOPE: registered as TREE_DATA layer 'soul' (eternal until Samsara
// differentiates — see trees.ts). Nothing in this store is ever cascade-reset;
// hardReset alone wipes it (fresh()).
//
// SKELETON STATUS: state + recording + save plumbing are REAL; the pacing
// mechanic (reclimbGainMult) is IDENTITY until the slice-9 keep-rule agent
// activates it together with the sim pin migration in the SAME commit
// (Gate-D: the pinned bands move only deliberately — see docs/slice-9.md §1).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { ACCUMULATOR_DATA } from '@/data/accumulators'
import type { RealmId, SeverableKey } from '@/engine/types'

export interface SeveranceHistoryRow {
  severable: SeverableKey
  /** Life number at sever time. Pre-Samsara there is only life 1. */
  life: number
}

export interface SoulSlice {
  /** k — completed c re-climb cycles forced by n/s cascades (D2/D21). */
  ascents: number
  /** Severance-ritual completions — the transcendent multiplier's clock (D25). */
  severanceRituals: number
  /** Per-attachment severance record (D24; three-lives transcendence data). */
  severanceHistory: SeveranceHistoryRow[]
}

export function freshSoulSlice(): SoulSlice {
  return { ascents: 0, severanceRituals: 0, severanceHistory: [] }
}

export const useSoulStore = defineStore('soul', () => {
  const slice = ref<SoulSlice>(freshSoulSlice())

  const ascents = computed(() => slice.value.ascents)
  const severanceRituals = computed(() => slice.value.severanceRituals)
  const severanceHistory = computed<readonly SeveranceHistoryRow[]>(
    () => slice.value.severanceHistory,
  )

  /** An n/s cascade wiped c — the next re-climb is ascent k+1. Called from realm.ts. */
  function recordAscent(): void {
    slice.value = { ...slice.value, ascents: slice.value.ascents + 1 }
  }

  /** A severance-ritual completion — advances every active severance's ramp. */
  function recordSeveranceRitual(): void {
    slice.value = { ...slice.value, severanceRituals: slice.value.severanceRituals + 1 }
  }

  /** Record a severance in the eternal history (D24). */
  function recordSeverance(severable: SeverableKey, life: number): void {
    slice.value = {
      ...slice.value,
      severanceHistory: [...slice.value.severanceHistory, { severable, life }],
    }
  }

  /**
   * "The core remembers" — the re-climb gain multiplier for a realm's
   * prestige gain (folded into realm.resetGain/nextAt so the shown gain stays
   * honest). The real mechanic: identity for every realm except c; for c,
   * min((1/r)^(ascents−1), 1/f) with r/f from ACCUMULATOR_DATA.ascentCounter
   * (D21: r=0.70, f=0.05) — the gain-side equivalent of the sim's re-climb
   * clock scale max(r^(k−1), f).
   *
   * SKELETON: IDENTITY. The slice-9 keep-rule agent activates this together
   * with the pinned-band migration in the same commit (Gate-D). The constants
   * are already live in data so activation is a one-site change here.
   */
  function reclimbGainMult(id: RealmId): Decimal {
    // Referenced now so the data wiring is proven; the formula lands with the
    // pin migration. (ratio/floor are pinned in data-port.test.ts.)
    void ACCUMULATOR_DATA.ascentCounter.ratio
    void id
    return decimalOne()
  }

  // ---- Save slice (id 'soul') ----------------------------------------------
  function save(): Record<string, unknown> {
    return slice.value as unknown as Record<string, unknown>
  }
  function load(s: unknown): void {
    const loaded = (s ?? freshSoulSlice()) as Partial<SoulSlice>
    slice.value = {
      ascents: typeof loaded.ascents === 'number' ? loaded.ascents : 0,
      severanceRituals: typeof loaded.severanceRituals === 'number' ? loaded.severanceRituals : 0,
      severanceHistory: Array.isArray(loaded.severanceHistory)
        ? [...loaded.severanceHistory]
        : [],
    }
  }
  function fresh(): Record<string, unknown> {
    return freshSoulSlice() as unknown as Record<string, unknown>
  }

  return {
    slice,
    ascents,
    severanceRituals,
    severanceHistory,
    recordAscent,
    recordSeveranceRitual,
    recordSeverance,
    reclimbGainMult,
    save,
    load,
    fresh,
  }
})
