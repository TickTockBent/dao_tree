// src/engine/accumulator.ts — the typed-accumulator vocabulary (slice 9).
//
// Accumulators — state that accumulates across resets and feeds back — are a
// first-class engine concept with a scope enum, not individual features
// (docs/architecture.md, "the convergent architecture"). Slice 9 ships the
// first two instances, both soul-scoped: the ascent counter (D2/D21 — "the
// core remembers") and the severance ritual (D23/D25 — "you've mastered the
// core; now master the severance").
//
// STAGING DISCIPLINE (agreed, docs/architecture.md): the TYPE is defined here,
// but no machinery exists for scopes with zero instances. 'world' and 'dao'
// are reserved enum values — slice 10's world instances (sect seed-stores,
// wild seedings) force the cross-scope generalization; dao validates it.
// Premature generality is how convergent designs die.

import type { AccumulatorKey } from './types'

/**
 * Where an accumulator lives across the reset topology:
 * - 'soul'  — carried by the reincarnating cultivator. Slice 10 / D37
 *   differentiated the old pre-Samsara 'eternal' TREE_DATA scope into
 *   soul | world | file; soul-scoped accumulators now persist via the 'soul'
 *   layer scope, topologically unreachable by the reincarnation cascade.
 * - 'world' — RESERVED: living in the world, findable by any life (the
 *   chronicle is the founding world-scope instance — see stores/chronicle.ts).
 * - 'dao'   — RESERVED: comprehension/philosophical progress.
 */
export type AccumulatorScope = 'soul' | 'world' | 'dao'

export interface AccumulatorDef {
  readonly key: AccumulatorKey
  readonly scope: AccumulatorScope
  /**
   * Diminishing-returns descriptor (wider-not-taller, design-principles #21):
   * geometric per-step ratio. For the ascent counter this is r (D21) — the
   * k-th re-climb runs at effective scale max(ratio^(k−1), floor). The
   * severance ritual's curve constants live on the severance set-piece config
   * (SETPIECE_DATA.severance) because they are jointly pinned with the
   * multiplier ramp (D25); its entry here carries scope + persistence only.
   */
  readonly ratio?: number
  /** Scale floor f (D21): the register knob AND the optimizer bound. */
  readonly floor?: number
  /**
   * Persistence rule. 'never-reset': survives every cascade, the tribulation,
   * and severing (D23: invert-survival-lists — the counter is on the KEEPS
   * list explicitly). Samsara persistence is decided per-scope at slice 10.
   */
  readonly persistence: 'never-reset'
}
