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
// STATUS: state + recording + save plumbing + the pacing mechanic
// (reclimbGainMult) are all REAL. Activated together with the sim pin
// migration in the SAME body of work (Gate-D: the pinned bands moved
// deliberately when the mechanic landed — see docs/slice-9.md §1).

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
  /**
   * Slice 10 / D37: the rebirth counter. Latched forever (only ever rises);
   * doubles as the strand gate clause (post-slice) and the `rebirths` core
   * meets() clause. 0 today — nothing increments it yet (the step-4 crossing
   * does).
   */
  rebirths: number
  /**
   * Slice 10 / D36: the SOUL-side endurance record — per demon-trial-key, how
   * many times the soul has FACED that trial (survives rebirth). The trial's
   * POWER (daoHeartStacks) is body-state and dies with the flesh; this record
   * is identity and carries. Write-only in the skeleton — nothing reads it yet.
   */
  trialsEndured: Record<string, number>
  /**
   * Slice 10 / D37: the lattice "walked path" accumulator — how many
   * Manifestation-tier nodes the soul has walked in prior lives, driving the
   * Manifestation re-walk discount. Data only; no consumer yet.
   */
  walkedManifestations: number
}

export function freshSoulSlice(): SoulSlice {
  return {
    ascents: 0,
    severanceRituals: 0,
    severanceHistory: [],
    rebirths: 0,
    trialsEndured: {},
    walkedManifestations: 0,
  }
}

export const useSoulStore = defineStore('soul', () => {
  const slice = ref<SoulSlice>(freshSoulSlice())

  const ascents = computed(() => slice.value.ascents)
  const severanceRituals = computed(() => slice.value.severanceRituals)
  const severanceHistory = computed<readonly SeveranceHistoryRow[]>(
    () => slice.value.severanceHistory,
  )
  const rebirths = computed(() => slice.value.rebirths)
  const trialsEndured = computed<Readonly<Record<string, number>>>(
    () => slice.value.trialsEndured,
  )
  const walkedManifestations = computed(() => slice.value.walkedManifestations)

  /** An n/s cascade wiped c — the next re-climb is ascent k+1. Called from realm.ts. */
  function recordAscent(): void {
    slice.value = { ...slice.value, ascents: slice.value.ascents + 1 }
  }

  /** A severance-ritual completion — advances every active severance's ramp. */
  function recordSeveranceRitual(): void {
    slice.value = { ...slice.value, severanceRituals: slice.value.severanceRituals + 1 }
  }

  /** Record a severance in the soul history (D24). */
  function recordSeverance(severable: SeverableKey, life: number): void {
    slice.value = {
      ...slice.value,
      severanceHistory: [...slice.value.severanceHistory, { severable, life }],
    }
  }

  /**
   * Record that the soul has ENDURED a demon trial of this key (D36). Called
   * one line into heartDemons' trial-clear path — the ONLY behavioral touch in
   * the slice-10 skeleton. Increments a per-key counter that carries across
   * rebirth; nothing reads it yet (identity/chronicle/karma consumers land in
   * later chunks).
   */
  function recordTrialEndured(trialKey: string): void {
    const nextEndured = { ...slice.value.trialsEndured }
    nextEndured[trialKey] = (nextEndured[trialKey] ?? 0) + 1
    slice.value = { ...slice.value, trialsEndured: nextEndured }
  }

  /** Latch a rebirth (D37). Only ever rises; the step-4 crossing calls this. */
  function recordRebirth(): void {
    slice.value = { ...slice.value, rebirths: slice.value.rebirths + 1 }
  }

  /** Add to the walked-path accumulator (D37). No consumer yet. */
  function recordWalkedManifestations(count: number): void {
    if (count <= 0) return
    slice.value = {
      ...slice.value,
      walkedManifestations: slice.value.walkedManifestations + count,
    }
  }

  /**
   * "The core remembers" — the re-climb gain multiplier for a realm's
   * prestige gain (folded into realm.resetGain/nextAt so the shown gain stays
   * honest). Identity for every realm except c; for c,
   * min((1/r)^(k−1), 1/f) with r/f from ACCUMULATOR_DATA.ascentCounter
   * (D21: r=0.70, f=0.05) — the gain-side reciprocal of the sim's re-climb
   * clock scale max(r^(k−1), f), so mastery compounds gain and the floor f
   * caps it at 1/f (= 20×, D21's optimizer bound).
   *
   * INDEXING (off-by-one, deliberate): k := ascents. The sim's
   * trackCReclimbCurve indexes the FIRST re-climb at ascentIndex = 1 (clock
   * scale r^0, unscaled). realm.ts increments `ascents` at wipe time, so
   * immediately after the first n/s wipe ascents === 1 and the player is ON
   * that first re-climb (k = 1) → (1/r)^0 = identity; after the second wipe
   * ascents === 2 → (1/r)^1; etc. ascents === 0 is c's pre-wipe INITIAL climb
   * and must stay identity, never (1/r)^(−1) = r (which would PENALISE it).
   */
  function reclimbGainMult(id: RealmId): Decimal {
    const currentReclimbIndex = slice.value.ascents
    if (id !== 'c' || currentReclimbIndex === 0) return decimalOne()
    const decayRatio = ACCUMULATOR_DATA.ascentCounter.ratio!
    const scaleFloor = ACCUMULATOR_DATA.ascentCounter.floor!
    const gainWithoutCap = decimalOne().div(decayRatio).pow(currentReclimbIndex - 1)
    const gainCap = decimalOne().div(scaleFloor)
    return gainWithoutCap.min(gainCap)
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
      // Slice 10 fields default cleanly for older saves (backward-compatible).
      rebirths: typeof loaded.rebirths === 'number' ? loaded.rebirths : 0,
      trialsEndured:
        loaded.trialsEndured && typeof loaded.trialsEndured === 'object'
          ? { ...loaded.trialsEndured }
          : {},
      walkedManifestations:
        typeof loaded.walkedManifestations === 'number' ? loaded.walkedManifestations : 0,
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
    rebirths,
    trialsEndured,
    walkedManifestations,
    recordAscent,
    recordSeveranceRitual,
    recordSeverance,
    recordTrialEndured,
    recordRebirth,
    recordWalkedManifestations,
    reclimbGainMult,
    save,
    load,
    fresh,
  }
})
