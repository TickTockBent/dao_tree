// src/engine/meets.ts — the universal unlock/done/when/trigger condition DSL.
//
// Port of the factory's `meets()` grammar as a typed discriminated union
// rather than the original loose-object-with-string-keys. Every data table's
// `unlock` / `done` / `when` / `trigger` / `requires` field is typed against
// `Condition`, so a typo'd key fails at compile time instead of being silently
// ignored (the §5a scale-bug class — `meets()` silently returns true on
// unknown keys, the worst possible gate failure).
//
// `meets()` is a PURE function over a `GameState` snapshot interface — not
// over `player`/`tmp` globals — so it is testable and headless-runnable
// without mounting Vue/Pinia. Callers build a `GameState` from store state.

import type Decimal from 'break_eternity.js'
import type { Element, LayerId, LatticeNodeKey, LatticeTierKey, RealmId, TemperTierKey } from './types'

// ---- The condition grammar -------------------------------------------------

/**
 * A single condition clause. Fields on a `Condition` object AND-combine
 * (every clause must hold). This mirrors the original `meets()` shape exactly:
 * the factory's `unlock`/`done`/`when` objects are plain objects whose keys
 * AND together, and each key has its own value shape.
 *
 * In the data tables, conditions are written as plain object literals with
 * any subset of these keys. We type them as `Partial<ConditionClauses>` so
 * data authors can write the natural shape; `meets()` evaluates only the
 * present keys.
 */
export interface ConditionClauses {
  /** Qi gathered (player.points) >= N. */
  qi: number
  /** Primary meridians opened >= N. */
  meridians: number
  /** All 12 primary meridians opened. */
  primaryMeridiansAll: true
  /** Temper tier reached (skin/flesh/tendon/bone/marrow). */
  temperTier: TemperTierKey
  /**
   * Realm reached. Second element is either a numeric `best` threshold or a
   * named sub-stage label string (the §5a standard — labels preferred to
   * avoid scale bugs).
   */
  realm: [RealmId, number | string]
  /** Lattice node owned at tier >= N (1 = Glimpse, 2 = Seed). */
  daoNode: [LatticeNodeKey, number]
  /** Any node of element owned at tier >= N. */
  daoElementTier: [Element, number]
  /** Any lattice node owned at tier >= N. */
  anyDaoNode: number
  /** Core forged (core grade index >= 0). */
  coreForged: true
  /** Core forged but below its ceiling (forge still has headroom). */
  coreBelowCeiling: true
  /** A sect archetype has been chosen. */
  sectJoined: true
  /** Sect contribution best >= N. */
  contribution: number
  /** An achievement is earned: [layerId, achievementId]. */
  achievement: [LayerId, number]
}

/** A condition object: any subset of clauses, AND-combined. Empty = always true. */
export type Condition = Partial<ConditionClauses>

// ---- Hint-only shadow grammar ----------------------------------------------
//
// The hint cascade + journal latches use a few keys that aren't part of the
// core `meets()` grammar (they read derived engine state). The original
// hintEngine evaluates these locally, strips them, then delegates the rest to
// `meets()`. We keep that discipline: `HintClauses` extends `Condition` with
// the shadow keys; `evaluateHintCondition` consumes the shadow keys first,
// then calls `meets()` on the remainder.

export interface HintClauses extends ConditionClauses {
  /** A layer tab has been unlocked (latched `player[layer].unlocked`). */
  layerUnlocked: LayerId
  /** Soul aspect is unchosen (Nascent Soul unlocked but no aspect picked). */
  aspectUnchosen: true
  /** Sect is revealed but not yet joined. */
  sectUnjoined: true
  /** Tribulation is ready to begin (trigger met, not passed, not active, cooldown elapsed). */
  tribulationReady: true
  /** An unhealed scar is active. */
  scarActive: true
  /** The tribulation has been passed. */
  tribulationPassed: true
  /** At least one scar depth has been healed. */
  scarHealed: true
}

export type HintCondition = Partial<HintClauses>

// ---- GameState snapshot interface ------------------------------------------
//
// The pure `meets()` reads only what it needs from this snapshot. Stores
// build a `GameState` each evaluation (cheap — a handful of scalar reads).

export interface GameState {
  /** player.points — total Qi gathered this life. */
  qi: Decimal
  /** Primary meridians opened count. */
  primaryMeridians: number
  /** Whether all 12 primary meridians are open. */
  primaryMeridiansAll: boolean
  /** Current temper tier key, or null if none. */
  temperTier: TemperTierKey | null
  /** Per-realm `best` (high-water prestige currency). */
  realmBest: Record<RealmId, Decimal>
  /** Per-realm sub-stage label reached (the highest met sub-stage label). */
  realmSubstageLabel: Record<RealmId, string | null>
  /** Per-realm substage label → `at` threshold (for resolving label-based realm conditions). */
  realmSubstageThresholds: Record<RealmId, Record<string, number>>
  /** Per-node tier owned (0 = none, 1 = Glimpse, 2 = Seed). */
  daoNodeTier: Record<LatticeNodeKey, number>
  /** Highest tier owned for any node of each element. */
  daoElementMaxTier: Record<Element, number>
  /** Highest tier owned across all nodes. */
  daoAnyNodeMaxTier: number
  /** Core grade index (-1 = unforged, 0..4 = cracked..perfect). */
  coreGradeIndex: number
  /** Core grade ceiling index for the current Foundation band. */
  coreCeilingIndex: number
  /** Whether a sect archetype is chosen. */
  sectJoined: boolean
  /** Sect contribution best. */
  contributionBest: Decimal
  /** Earned achievement ids per layer. */
  achievements: Record<string, Set<number>>
}

// ---- Evaluation ------------------------------------------------------------

/** True if a single clause holds against the state. */
function clauseHolds<K extends keyof ConditionClauses>(
  key: K,
  value: ConditionClauses[K],
  state: GameState,
): boolean {
  switch (key) {
    case 'qi':
      return state.qi.gte(value as number)
    case 'meridians':
      return state.primaryMeridians >= (value as number)
    case 'primaryMeridiansAll':
      return state.primaryMeridiansAll
    case 'temperTier':
      return state.temperTier === value
    case 'realm': {
      const [realmId, threshold] = value as [RealmId, number | string]
      const best = state.realmBest[realmId]
      if (best === undefined) return false
      if (typeof threshold === 'number') return best.gte(threshold)
      // Resolve label → numeric `at` threshold, then check best >= at.
      const at = state.realmSubstageThresholds[realmId]?.[threshold]
      if (at === undefined) return false
      return best.gte(at)
    }
    case 'daoNode': {
      const [nodeKey, tier] = value as [LatticeNodeKey, number]
      return (state.daoNodeTier[nodeKey] ?? 0) >= tier
    }
    case 'daoElementTier': {
      const [element, tier] = value as [Element, number]
      return (state.daoElementMaxTier[element] ?? 0) >= tier
    }
    case 'anyDaoNode':
      return state.daoAnyNodeMaxTier >= (value as number)
    case 'coreForged':
      return state.coreGradeIndex >= 0
    case 'coreBelowCeiling':
      return state.coreGradeIndex >= 0 && state.coreGradeIndex < state.coreCeilingIndex
    case 'sectJoined':
      return state.sectJoined
    case 'contribution':
      return state.contributionBest.gte(value as number)
    case 'achievement': {
      const [layerId, achievementId] = value as [LayerId, number]
      return state.achievements[layerId]?.has(achievementId) ?? false
    }
    default:
      // Exhaustiveness check — unknown keys should never reach here because
      // the type system rejects them at the call site. This default is
      // unreachable for typed callers; for safety we treat unknowns as
      // false (the OPPOSITE of the original `meets()`, which silently
      // returned true — this is the bug-class fix).
      return false
  }
}

/**
 * Evaluate a `Condition` (AND of clauses) against a `GameState` snapshot.
 * Empty condition (no clauses) → true. Unknown clauses → false (intentional
 * inversion of the original silent-true behavior; the type system should
 * make this unreachable, but the runtime guard catches untyped input).
 */
export function meets(condition: Condition, state: GameState): boolean {
  for (const key of Object.keys(condition) as (keyof Condition)[]) {
    const value = condition[key]
    if (value === undefined) continue
    if (!clauseHolds(key, value as ConditionClauses[typeof key], state)) return false
  }
  return true
}

// ---- Lattice tier ordinal helper -------------------------------------------

/** Tier ordinal lookup (glimpse=1, seed=2). Used by data readers. */
export function tierOrdinal(key: LatticeTierKey): number {
  if (key === 'glimpse') return 1
  if (key === 'seed') return 2
  return 0
}

// ---- Hint condition evaluation (shadow keys + delegation) -------------------

/**
 * Extended state for hint/journal evaluation. Adds the shadow-key values that
 * `evaluateHintCondition` consumes locally before delegating to `meets()`.
 */
export interface HintState extends GameState {
  /** Set of unlocked layer ids. */
  unlockedLayers: Set<LayerId>
  /** True if the soul aspect is unchosen (NS unlocked but no aspect picked). */
  aspectUnchosen: boolean
  /** True if the sect is revealed but not yet joined. */
  sectUnjoined: boolean
  /** True if the tribulation is ready to begin. */
  tribulationReady: boolean
  /** True if an unhealed scar is active. */
  scarActive: boolean
  /** True if the tribulation has been passed. */
  tribulationPassed: boolean
  /** True if at least one scar depth has been healed. */
  scarHealed: boolean
}

/**
 * Evaluate a `HintCondition` (which may include shadow keys) against a
 * `HintState`. Shadow keys are consumed here; the remaining clauses are
 * delegated to `meets()`.
 */
export function evaluateHintCondition(condition: HintCondition, state: HintState): boolean {
  const remaining: Condition = {}
  for (const key of Object.keys(condition) as (keyof HintClauses)[]) {
    const value = condition[key]
    if (value === undefined) continue
    switch (key) {
      case 'layerUnlocked':
        if (!state.unlockedLayers.has(value as LayerId)) return false
        break
      case 'aspectUnchosen':
        if (!state.aspectUnchosen) return false
        break
      case 'sectUnjoined':
        if (!state.sectUnjoined) return false
        break
      case 'tribulationReady':
        if (!state.tribulationReady) return false
        break
      case 'scarActive':
        if (!state.scarActive) return false
        break
      case 'tribulationPassed':
        if (!state.tribulationPassed) return false
        break
      case 'scarHealed':
        if (!state.scarHealed) return false
        break
      default:
        // Core grammar key — delegate to meets().
        Object.assign(remaining, { [key]: value })
        break
    }
  }
  return meets(remaining, state)
}
