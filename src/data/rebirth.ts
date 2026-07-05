// src/data/rebirth.ts — the rebirth economy: memory fragments + spiritual roots
// (slice 10 step 5 / D38 + D41 #2). The two-item menu's prices and the root
// discount grid live here (a data table — where numbers live). All KARMA prices
// are D41 #2-SIGNED; the root discount MAGNITUDES are ⟨tune⟩ (a CONSERVATIVE v1
// envelope pending the root-dominance sweep, spec §6.4 — Wes reviews them).

import type { Element } from '@/engine/types'

// ---- Memory fragments — Seeds (D41 #2, SIGNED) ------------------------------

/**
 * SEED_FRAGMENT_BASE — the first carried Seed costs this many karma (D41 #2:
 * "first Seed ~15 karma"). SIGNED.
 */
export const SEED_FRAGMENT_BASE = 15

/**
 * SEED_FRAGMENT_GROWTH — each additional Seed carried costs ×this over the
 * previous (D41 #2: "growth ~2× per additional" → 15/30/60/120…). Escalation IS
 * the design (D38: the curve's SHAPE controls continuity, karma income controls
 * how far up it you reach — two knobs for two jobs; the curve self-enforces the
 * ceiling without a cap — "life 1 carries two comfortably, three with a stretch;
 * a 28-karma late repeat carries exactly one"). SIGNED.
 */
export const SEED_FRAGMENT_GROWTH = 2

/**
 * TECHNIQUE_FRAGMENT_COST — a studied technique rides a SEPARATE FLAT track
 * (D38 / D41 #2: "separate flat track at ~8" — tools, not comprehension; never
 * competing with Seeds on the escalation curve at the margin). SIGNED.
 *
 * ⚠️ v1: technique CARRY is DEFERRED (structurally awkward — see the note in
 * stores/rebirth.ts: a technique's meaning/visibility is bound to the
 * life-scoped joined sect archetype + library tier, all reset at rebirth). This
 * constant ships so the price is settled when the sect-continuity story exists.
 */
export const TECHNIQUE_FRAGMENT_COST = 8

/**
 * The karma cost of carrying the (alreadySelected + 1)-th Seed:
 * base × growth^alreadySelected → 15, 30, 60, 120, … (D41 #2).
 */
export function seedFragmentCost(alreadySelected: number): number {
  return SEED_FRAGMENT_BASE * Math.pow(SEED_FRAGMENT_GROWTH, alreadySelected)
}

/**
 * Total karma to carry `count` Seeds — the geometric sum
 * Σ_{i=0}^{count-1} base × growth^i (closed form, growth ≠ 1): 15/45/105/225/…
 */
export function seedFragmentTotal(count: number): number {
  if (count <= 0) return 0
  return (SEED_FRAGMENT_BASE * (Math.pow(SEED_FRAGMENT_GROWTH, count) - 1)) / (SEED_FRAGMENT_GROWTH - 1)
}

// ---- Spiritual roots — configuration + purity (D38 read #1/#2, D41 #2) -------

/** The five spiritual roots — the canonical lattice root elements (data/lattice.ts). */
export const ROOT_ELEMENTS: readonly Element[] = ['metal', 'wood', 'water', 'fire', 'earth']

/** Root element-count bounds: single-element deep-narrow … five-element wide-shallow. */
export const MIN_ROOT_ELEMENTS = 1
export const MAX_ROOT_ELEMENTS = 5

/** Purity grades (D38 read #2: Mortal free default → Earth → Heaven, the dynasty project). */
export type PurityGrade = 'mortal' | 'earth' | 'heaven'
export const PURITY_GRADES: readonly PurityGrade[] = ['mortal', 'earth', 'heaven']

/**
 * A grade's rank in the ratchet order (D43 #2). Mortal 0 < Earth 1 < Heaven 2 —
 * the soul-scoped purity latch never moves down, so higher rank wins.
 */
export function purityRank(grade: PurityGrade): number {
  return PURITY_GRADES.indexOf(grade)
}

/**
 * The grade ONE step up from `grade` (the only purchase the rebirth menu offers,
 * D43 #2), or null at the top (Heaven — nothing left to buy). Mortal → Earth →
 * Heaven → null: two lifetime purchases total.
 */
export function nextPurityGrade(grade: PurityGrade): PurityGrade | null {
  return PURITY_GRADES[purityRank(grade) + 1] ?? null
}

/**
 * ROOT_CONFIG_COST — the NOMINAL karma to declare a root's count + identity
 * (D38 read #1: "the first rebirth decision is a genre choice, not a power
 * choice" — a token cost that prevents thoughtless clicking, never a power
 * gate). ⟨tune — placeholder⟩.
 */
export const ROOT_CONFIG_COST = 3

/**
 * ROOT_PURITY_COST — purity is the karma SINK and the dynasty project (D38 read
 * #2). D41 #2-SIGNED: Mortal free (the baseline), Earth 200 (~1.5 first lives,
 * mid-dynasty), Heaven 800 (a genuine dynasty project, ~life 15–20; the grade-up
 * is a chronicle event). SIGNED.
 */
export const ROOT_PURITY_COST: Readonly<Record<PurityGrade, number>> = {
  mortal: 0,
  earth: 200,
  heaven: 800,
}

// ---- Root lattice-region discounts (SPEED, NEVER ACCESS — D38 read #3) -------
//
// ⟨tune — pending the root-dominance sweep (spec §6.4)⟩. CONSERVATIVE v1
// envelope, NOT swept — Wes prices these against the sweep. Two shape axes
// (D38 read #3 — deep-narrow vs wide-shallow):
//   - fewer elements → a DEEPER discount on each matching region;
//   - five elements  → a SHALLOW discount, but across ALL five regions;
//   - purity SCALES the magnitude (Mortal = none; Heaven = full).
// A root NEVER unlocks a node — the discount only lowers the Insight COST of
// nodes whose element the root holds, applied at the single dao cost path
// (dao.nodeCost) and NOWHERE in any gate.

/**
 * ROOT_DISCOUNT_BY_COUNT — the HEAVEN-grade discount FRACTION on a matching
 * region, indexed by element count (1..5). Deep-and-narrow at the top,
 * shallow-and-wide at the bottom. ⟨tune⟩:
 *   1 → 0.35  (single-element Heaven — the cap: ≤35% off matching regions)
 *   2 → 0.28
 *   3 → 0.22
 *   4 → 0.17
 *   5 → 0.12  (five-element Heaven — shallow, but across all five)
 */
export const ROOT_DISCOUNT_BY_COUNT: Readonly<Record<number, number>> = {
  1: 0.35,
  2: 0.28,
  3: 0.22,
  4: 0.17,
  5: 0.12,
}

/**
 * ROOT_PURITY_SCALE — purity scales the discount magnitude (never adds new
 * discounts, so Heaven single-element and Heaven five-element are different
 * shapes at the same power level — no dominant strategy by construction, D38
 * read #2). Mortal = 0 (identity without power — the free default reads as
 * baseline, D38 read #1); Earth = half; Heaven = full. ⟨tune⟩.
 */
export const ROOT_PURITY_SCALE: Readonly<Record<PurityGrade, number>> = {
  mortal: 0,
  earth: 0.5,
  heaven: 1,
}

/**
 * The discount FRACTION applied to a matching-element node's Insight cost for a
 * root of `elementCount` elements at `purity`. 0 when rootless (< 1 element) or
 * Mortal purity. The cost multiplier is (1 − fraction).
 */
export function rootDiscountFraction(elementCount: number, purity: PurityGrade): number {
  if (elementCount < MIN_ROOT_ELEMENTS) return 0
  const clamped = Math.min(Math.max(elementCount, MIN_ROOT_ELEMENTS), MAX_ROOT_ELEMENTS)
  const heavenMagnitude = ROOT_DISCOUNT_BY_COUNT[clamped] ?? 0
  return heavenMagnitude * ROOT_PURITY_SCALE[purity]
}

/**
 * A life's spiritual-root configuration (life-scoped; the chronicle records it;
 * null = rootless, the D38 baseline).
 */
export interface RootConfig {
  readonly elements: readonly Element[]
  readonly purity: PurityGrade
}
