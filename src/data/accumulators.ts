// src/data/accumulators.ts — the typed-accumulator instances (slice 9).
//
// Two soul-scoped instances ship in slice 9 (docs/architecture.md staging;
// D21/D23/D25). The next accumulator should be a data entry here, not a new
// feature — that is the point of the type.

import type { AccumulatorDef } from '@/engine/accumulator'
import type { AccumulatorKey } from '@/engine/types'

export const ACCUMULATOR_DATA: Readonly<Record<AccumulatorKey, AccumulatorDef>> = {
  /**
   * "The core remembers" (D2/D21): k counts the c re-climbs forced by n/s
   * cascades; the k-th re-climb runs at effective scale max(r^(k−1), f).
   * r = 0.70 and f = 0.05 are SIGNED OFF (D21) — the "moment" register: the
   * mastered re-temper ends at ~9 minutes, never experientially vanished,
   * and the floor bounds the optimizer (Competent's 1,344 re-climbs cannot
   * compound below 5% scale). Rule 0.1: these two numbers move only with
   * new evidence and Wes's sign-off.
   */
  ascentCounter: { key: 'ascentCounter', scope: 'soul', ratio: 0.7, floor: 0.05, persistence: 'never-reset' },
  /**
   * "Master the severance" (D23/D25): counts severance-ritual completions —
   * the ramp driver that carries each severance's transcendent multiplier
   * from c·m past breakeven to k·m. Curve constants (start fraction, cap
   * ratio, ramp steps) live on SETPIECE_DATA.severance.
   */
  severanceRitual: { key: 'severanceRitual', scope: 'soul', persistence: 'never-reset' },
}
