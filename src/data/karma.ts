// src/data/karma.ts — the karma firsts table (slice 10 / D36 + D40).
//
// "The heavens pay for firsts." Every karma income source is a KARMA_DATA row
// paying `base × rⁿ` (n = prior lives that earned that exact first) with floor
// f = 0 — the one accumulator where hitting zero is correct (D36). A first is
// an EVENT KEY × a declared QUALIFIER TUPLE from a typed, closed vocabulary
// (D40): the bare event pays its full base exactly once ever (the headline);
// each qualified variant pays `VARIANT_SHARE × base` (an echo, a smaller bell).
//
// STATUS (skeleton): the TABLE SHAPE, the axis vocabularies, and the
// expansion-count pin ship here. Class bases / VARIANT_SHARE / KARMA_DECAY_RATIO
// are now D41-RULED starting points (8/8/7/4, 0.4, 0.5), ⟨tune⟩ pending the Gate-D
// re-run sign-off — no longer measurement-only placeholders. Nothing consumes
// this table yet.
//
// ⚠️ DESIGN-REVIEWABLE: the v1 row set below was drafted conservatively from
// EXISTING game events and ships as reviewed at D41 #3 (25 rows, pin 121).

import type {
  RealmId,
  SecretRealmSiteKey,
  SeverableKey,
} from '@/engine/types'
import type { HeartDemonTrialKey } from '@/data/heart-demons'

// ---- Classes + qualifier axes (D40) ----------------------------------------

/**
 * The four karma income classes. The dynasty harness decomposes measured
 * income by this axis (D40 income-shape directive): milestone headlines /
 * milestone echoes / deed+encounter firsts / grade deltas — the SHAPE tells
 * whether karma is a novelty-incentive or has collapsed into a
 * performance-incentive.
 */
export type KarmaClass = 'milestone' | 'grade-delta' | 'deed' | 'encounter'

/**
 * The typed, closed qualifier vocabulary (D40). Per-row opt-in; a row declares
 * the axes that apply to it.
 *   - rootShape   — declared at rebirth; life 1 = rootless. Vocabulary is
 *     {rootless} today (size 1), so declaring it costs ZERO expansion until
 *     roots ship (then the vocabulary grows — a deliberate expansion-count
 *     commit). Included on the rows where it will apply.
 *   - buildMark   — DERIVED by one fixed rule from the sim-actor grammar
 *     (deriveBuildMark below). The harness measures per build for free.
 *   - realmEra    — the realm at event time (the circumstance an encounter/deed
 *     happened in).
 *   - worldContext — RESERVED (the almanac era). ZERO instances: no v1 row may
 *     declare it (lint-enforced). The member exists so the schema is complete.
 */
export type KarmaQualifierAxis = 'rootShape' | 'buildMark' | 'realmEra' | 'worldContext'

/**
 * A karma income row. `base` is SIGNED BY TYPE (may be negative — the schema
 * supports negative-income rows for future content). ALL v1 rows are positive:
 * zero placeholder-negative rows, zero zero-base dead data (spec §2 as amended;
 * lint-enforced).
 */
export interface KarmaEventRow {
  /** Stable event key (event × the row identity; unique across the table). */
  readonly key: string
  /** Income class. */
  readonly class: KarmaClass
  /** Class base (D41 #1-ruled starting point; ⟨tune⟩ pending the re-run sign-off). */
  readonly base: number
  /** Declared qualifier axes (per-row opt-in; closed to the typed union). */
  readonly qualifiers: readonly KarmaQualifierAxis[]
}

// ---- Tuning knobs (all v0, measurement-only unless noted) -------------------

/**
 * r — the per-repeat decay ratio (`base × rⁿ`). MUST be < 1 (bounded income
 * provable from the data shape). D41 #1 kept it at 0.5 — a third repeat at 25%
 * is genuinely diminishing while a second visit still pays. ⟨tune⟩ pending the
 * re-run sign-off.
 */
export const KARMA_DECAY_RATIO = 0.5

/**
 * f — the income floor. f = 0 IS THE DESIGN (D36), not a tuning value: karma is
 * the one accumulator where hitting zero is correct — the tenth identical life
 * genuinely isn't a first anymore and shouldn't pay like one. NEVER raise it.
 */
export const KARMA_FLOOR = 0

/**
 * variantShare — each qualified variant (echo) pays `VARIANT_SHARE × base`; the
 * bare headline pays full base. The exploration-vs-loyalty lever is TWO explicit
 * knobs: this share and the axis vocabulary (D40). D41 #1 ruled 0.25 → 0.4 — an
 * echo at nearly half a headline is the right register ("this was real, and worth
 * noting, but it wasn't your first time"). ⟨tune⟩ pending the re-run sign-off.
 */
export const VARIANT_SHARE = 0.4

// ---- Axis vocabularies (closed; drive the expansion-count pin) --------------
//
// The number of distinct qualified variants a row generates is the PRODUCT of
// the vocabulary sizes of its declared axes. worldContext is RESERVED with an
// empty vocabulary — no row may declare it.

/** rootShape vocabulary — {rootless} pre-roots (size 1). Grows when roots ship. */
export const ROOT_SHAPE_VOCAB = ['rootless'] as const

/** buildMark vocabulary — the sim-actor grammar (D40), size 6. */
export const BUILD_MARK_VOCAB = [
  'gatherer',
  'meridian',
  'lattice',
  'sect',
  'pill',
  'balanced',
] as const

/** realmEra vocabulary — the realm at event time (the six climb realms), size 6. */
export const REALM_ERA_VOCAB: readonly RealmId[] = ['q', 'f', 'c', 'n', 's', 'x']

/** worldContext vocabulary — RESERVED, EMPTY (zero instances until the almanac). */
export const WORLD_CONTEXT_VOCAB: readonly string[] = []

export type BuildMark = (typeof BUILD_MARK_VOCAB)[number]

/** Vocabulary size per axis (the multiplicand in the expansion-count pin). */
export const AXIS_VOCAB_SIZE: Readonly<Record<KarmaQualifierAxis, number>> = {
  rootShape: ROOT_SHAPE_VOCAB.length, // 1
  buildMark: BUILD_MARK_VOCAB.length, // 6
  realmEra: REALM_ERA_VOCAB.length, // 6
  worldContext: WORLD_CONTEXT_VOCAB.length, // 0 (RESERVED)
}

/** Per-class allowed qualifier axes (D40's class rules; lint-enforced). */
export const CLASS_ALLOWED_AXES: Readonly<Record<KarmaClass, readonly KarmaQualifierAxis[]>> = {
  // Milestones may take rootShape (root identity, present from breath one) and
  // buildMark (the D36 canonical "first Nascent Soul as a meridian build").
  milestone: ['rootShape', 'buildMark'],
  // Grade deltas take NO qualifiers — the delta already prices improvement;
  // qualifying it would double-pay (D40).
  'grade-delta': [],
  // Deeds may take realmEra (the circumstance the deed happened in).
  deed: ['realmEra'],
  // Encounters may take realmEra (which era the site/encounter was met in).
  encounter: ['realmEra'],
}

// ---- Class bases (D41 #1 — ruled starting points) --------------------------
//
// D41 #1 reweighted the v0 measurement placeholders (10/6/5/4) toward the
// build-distinct classes: milestones still largest (they're the most content),
// but deeds/encounters at near-parity instead of half-weight, targeting
// build-distinct (deed+encounter) income at 25–35%. Deed/encounter never exceed
// the milestone base — reaching Nascent Soul is a bigger moment than completing
// an expedition (D41 mid-flight). ⟨tune⟩ pending the re-run sign-off.

const CLASS_BASE_V0: Readonly<Record<KarmaClass, number>> = {
  milestone: 8,
  'grade-delta': 4,
  deed: 8,
  encounter: 7,
}

// ---- The v1 firsts table (DESIGN-REVIEWABLE — flagged for Wes) --------------
//
// Drafted from EXISTING game events only. Every base is its class's v0 weight
// (uniform, measurement-only). Every base > 0; no worldContext; grade rows
// unqualified.

/** Realm-reached milestones (one per climb realm). */
const REALM_MILESTONE_ROWS: readonly KarmaEventRow[] = (
  ['q', 'f', 'c', 'n', 's', 'x'] as const
).map((realmId): KarmaEventRow => ({
  key: `reachRealm:${realmId}`,
  class: 'milestone',
  base: CLASS_BASE_V0.milestone,
  qualifiers: ['rootShape', 'buildMark'],
}))

/** Life-structure milestones (capstones + build-defining picks). */
const STRUCTURE_MILESTONE_ROWS: readonly KarmaEventRow[] = [
  'passFirstTribulation', // the Act I capstone + the rebirth unlock
  'latticeManifestation', // first lattice node reaches Manifestation
  'chooseProfession', // the Act I profession slot is picked
  'joinSect', // a sect archetype is chosen
].map((key): KarmaEventRow => ({
  key,
  class: 'milestone',
  base: CLASS_BASE_V0.milestone,
  qualifiers: ['rootShape', 'buildMark'],
}))

/**
 * Grade-delta rows (personal-best deltas only; NO qualifiers). Legacy grade,
 * foundation grade best, core grade best, tribulation grade best.
 */
const GRADE_DELTA_ROWS: readonly KarmaEventRow[] = [
  'legacyGradeDelta',
  'foundationGradeDelta',
  'coreGradeDelta',
  'tribulationGradeDelta',
].map((key): KarmaEventRow => ({
  key,
  class: 'grade-delta',
  base: CLASS_BASE_V0['grade-delta'],
  qualifiers: [],
}))

/**
 * Deed rows — heart-demon trials endured (per trial key), qualified by the era
 * they were endured in (trials fire across Act I realms — realmEra has real
 * spread). Transcendence (the third cut) becomes its own deed row when the
 * step-6 transcendence agent lands it (§4).
 */
const TRIAL_DEED_ROWS: readonly KarmaEventRow[] = (
  ['whisperingDoubt', 'hungryShadow', 'hollowCrown'] as HeartDemonTrialKey[]
).map((trial): KarmaEventRow => ({
  key: `endureTrial:${trial}`,
  class: 'deed',
  base: CLASS_BASE_V0.deed,
  qualifiers: ['realmEra'],
}))

/**
 * Deed rows — severances performed (per severable key). Headline-only (NO
 * realmEra): severances require the passed tribulation, so they cluster in the
 * Act II era — realmEra would be almost entirely dead variants. Conservative;
 * FLAGGED for review.
 */
const SEVERANCE_DEED_ROWS: readonly KarmaEventRow[] = (
  ['soulAspect', 'profession', 'extraordinaryMeridians', 'manifestation', 'flowingForm'] as SeverableKey[]
).map((severable): KarmaEventRow => ({
  key: `severed:${severable}`,
  class: 'deed',
  base: CLASS_BASE_V0.deed,
  qualifiers: [],
}))

/**
 * Deed rows — TRANSCENDENCES (per severable key). Headline-only like the
 * severance deeds. D43 #1: transcendence — cutting the same attachment across
 * three distinct lives so it is gone permanently at full ramp — is the single
 * highest-stakes irreversible in the game and the most significant moment a
 * dynasty reaches; excluding it would mean that moment earns no karma. It is a
 * headline deed (the choice/consummation is the identity moment; a buildMark or
 * era qualifier would price circumstance a transcendence does not carry). NEVER
 * fired by the sim's analytic dynasty rosters (they never transcend), so DYNASTY
 * KARMA is byte-identical — this row set is inert until a live third cut.
 */
const TRANSCENDENCE_DEED_ROWS: readonly KarmaEventRow[] = (
  ['soulAspect', 'profession', 'extraordinaryMeridians', 'manifestation', 'flowingForm'] as SeverableKey[]
).map((severable): KarmaEventRow => ({
  key: `transcended:${severable}`,
  class: 'deed',
  base: CLASS_BASE_V0.deed,
  qualifiers: [],
}))

/**
 * Encounter rows — secret-realm sites first-cleared (per site), qualified by
 * the era the site was cleared in (sites persist and can be first-cleared
 * across several realms — realmEra has real spread).
 */
const SITE_ENCOUNTER_ROWS: readonly KarmaEventRow[] = (
  ['verdantHollow', 'invertedSpiritLand', 'shatteredStarVault'] as SecretRealmSiteKey[]
).map((site): KarmaEventRow => ({
  key: `clearedSite:${site}`,
  class: 'encounter',
  base: CLASS_BASE_V0.encounter,
  qualifiers: ['realmEra'],
}))

/** The complete v1 karma firsts table. */
export const KARMA_DATA: readonly KarmaEventRow[] = [
  ...REALM_MILESTONE_ROWS,
  ...STRUCTURE_MILESTONE_ROWS,
  ...GRADE_DELTA_ROWS,
  ...TRIAL_DEED_ROWS,
  ...SEVERANCE_DEED_ROWS,
  ...TRANSCENDENCE_DEED_ROWS,
  ...SITE_ENCOUNTER_ROWS,
]

// ---- Expansion-count decomposition (drives the Gate-D pin) ------------------
//
// The number of distinct FIRSTS the table generates:
//   headlines = one bare event per row (KARMA_DATA.length)
//   variants  = Σ over rows that declare axes of Π(axis vocab sizes)
//   total     = headlines + variants
// Adding an axis to a row (or growing an axis vocabulary — e.g. roots shipping)
// changes this number; the pin makes that a deliberate, signed-off commit.

/** Π of the vocabulary sizes of a row's declared axes (empty product = 1). */
export function rowVariantCount(row: KarmaEventRow): number {
  if (row.qualifiers.length === 0) return 0 // headline-only rows generate no variants
  return row.qualifiers.reduce((product, axis) => product * AXIS_VOCAB_SIZE[axis], 1)
}

export interface KarmaExpansion {
  readonly rows: number
  readonly headlines: number
  readonly variants: number
  readonly total: number
  /** Variant counts decomposed by class (the D40 income-shape axis). */
  readonly variantsByClass: Readonly<Record<KarmaClass, number>>
}

/** Compute the expansion decomposition from the live table. */
export function karmaExpansion(): KarmaExpansion {
  const variantsByClass: Record<KarmaClass, number> = {
    milestone: 0,
    'grade-delta': 0,
    deed: 0,
    encounter: 0,
  }
  let variants = 0
  for (const row of KARMA_DATA) {
    const count = rowVariantCount(row)
    variants += count
    variantsByClass[row.class] += count
  }
  const headlines = KARMA_DATA.length
  return {
    rows: KARMA_DATA.length,
    headlines,
    variants,
    total: headlines + variants,
    variantsByClass,
  }
}

// ---- buildMark derivation (ONE fixed rule — D41 #4: baseline-relative) -------
//
// ⚠️ DESIGN-REVIEWABLE (flagged for Wes). A pure function of the build investment
// at event time. D41 #4 ruling: the v0 soft-caps measured ABSOLUTE investment,
// so "everyone maxes meridians" collapsed three of four actors to `balanced` and
// mislabeled the lattice build `meridian`. The rule SHAPE (dominant axis) is
// correct; the fix is to score each axis by how far the actor exceeds the
// UNIVERSAL BASELINE — the mark is the axis where investment most exceeds the
// baseline everyone shares.
//
// TWO REGIMES (D41's own language — "meridians are the baseline everyone shares"):
//   - meridians is the UNIVERSAL SPINE. Every build opens all 12 primaries, so a
//     meridian MARK requires going PAST the universal level (extraordinary
//     meridians): score = max(0, (meridians − baseline) / baseline). At exactly
//     12 the score is 0 — opening the spine is not a build identity.
//   - latticeNodes / sectMilestones / pillsBrewed are ELECTIVE specialties. A
//     gatherer builds none; a specialist reaches the roster-median specialist
//     level. Score = investment / baseline — a full specialist scores ~1.0.
//
// WHY NOT plain (investment − median): the dynasty roster's competent builds
// invest HOMOGENEOUSLY on the elective axes (Competent/Realistic/Lattice all own
// 15 lattice nodes; Competent/Realistic/Sect all reach 3 sect milestones), so the
// roster median EQUALS the specialist level. Subtracting it would zero out the
// specialists' own axis and re-collapse the lattice/sect builds to balanced —
// exactly the failure D41 #4 exists to fix. Fraction-of-baseline keeps the
// specialist axis at ~1.0 while a superset build (both lattice AND sect, neither
// dominant) reads `balanced`. FLAGGED for Wes: the honest baseline for these
// axes is the specialist level (=roster median here), used as a scale, not a
// subtracted floor.

/** Investment snapshot read at the moment a first is recorded. */
export interface BuildInvestment {
  /** Total meridians opened (primary + extraordinary). */
  readonly meridians: number
  /** Lattice nodes owned (any tier). */
  readonly latticeNodes: number
  /** Sect milestones reached (0..3). */
  readonly sectMilestones: number
  /** Pills brewed this life. */
  readonly pillsBrewed: number
}

/**
 * BUILD_MARK_BASELINES — the median dynasty-roster actor's life-end investment
 * per axis (D41 #4: "the median actor's investment in that axis"). MEASURED from
 * the roster (Competent / Realistic / Lattice / Sect) on 2026-07-04:
 *   medians = meridians 12, latticeNodes 15, sectMilestones 3, pillsBrewed 0.
 *
 * ⟨provisional⟩ — roster-median derived; the sim medians are the best v1 method,
 * to be RE-DERIVED from real player saves post-itch (Wes, D41 mid-flight). The
 * shipped function stays PURE — re-derive these deliberately when the roster (or
 * real save data) changes.
 *
 * Two values are NOT the raw measured median, documented here:
 *   - meridians 12 = the UNIVERSAL spine (all four actors open exactly 12); used
 *     as the subtracted baseline (only extraordinary meridians score).
 *   - pillsBrewed: the raw roster median is 0 (only Realistic brews, so the
 *     median across four actors is 0 — useless as a scale). The v0 alchemy cap 10
 *     is retained as the pill SCALE. FLAGGED: the pillsBrewed input is a coarse
 *     proxy (life-end held-pill count, not lifetime brews), so any positive pill
 *     investment reads as a strong pill signal — adequate for v1.
 */
export const BUILD_MARK_BASELINES = {
  meridians: 12,
  latticeNodes: 15,
  sectMilestones: 3,
  pillsBrewed: 10,
} as const

/**
 * An elective axis must reach this fraction of the specialist baseline to signal
 * a build (below it on every axis → 'gatherer', no real investment past the
 * universal). v0 ⟨tune⟩.
 */
const BUILD_MARK_ACTIVITY_FLOOR = 0.5
/** The dominant axis must exceed this multiple of the runner-up to claim the mark. */
const BUILD_MARK_DOMINANCE_RATIO = 1.5

/**
 * Derive the buildMark from an investment snapshot. Pure, deterministic, one
 * fixed rule (D41 #4 baseline-relative). Returns one of
 * gatherer/meridian/lattice/sect/pill/balanced.
 */
export function deriveBuildMark(investment: BuildInvestment): BuildMark {
  // meridians: excess PAST the universal spine (only extraordinary meridians score).
  const meridianExcess = Math.max(
    0,
    (investment.meridians - BUILD_MARK_BASELINES.meridians) / BUILD_MARK_BASELINES.meridians,
  )
  const scores: { readonly mark: BuildMark; readonly score: number }[] = [
    { mark: 'meridian', score: meridianExcess },
    { mark: 'lattice', score: investment.latticeNodes / BUILD_MARK_BASELINES.latticeNodes },
    { mark: 'sect', score: investment.sectMilestones / BUILD_MARK_BASELINES.sectMilestones },
    { mark: 'pill', score: investment.pillsBrewed / BUILD_MARK_BASELINES.pillsBrewed },
  ]
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  const top = sorted[0]!
  const runnerUp = sorted[1]!
  // No axis reaches specialist significance → no real investment past the
  // universal baseline → gatherer.
  if (top.score < BUILD_MARK_ACTIVITY_FLOOR) return 'gatherer'
  // A single axis clearly dominates → that build; otherwise (multiple axes at
  // the baseline, none dominant) → balanced is a REAL mark, not a default bucket.
  if (top.score >= runnerUp.score * BUILD_MARK_DOMINANCE_RATIO) return top.mark
  return 'balanced'
}
