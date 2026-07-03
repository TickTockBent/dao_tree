// src/data/realms.ts — single source of truth for the realm chain (spec §5).
//
// Port of js/data/realms.js. Every tunable number for the realm spine lives
// here; tuning edits data, never code. Values originate from
// early-game-spec-v0.1.2.md §5/§6/§7 (design docs live in git history as of
// 0c75e51 — retrieve via `git show 5887814:docs/<name>`), tuned since by the
// pacing passes recorded in the commit log.

import type { Condition } from '@/engine/meets'
import type {
  CoreGradeKey,
  Element,
  RealmId,
  SetpieceKey,
  SoulAspectKey,
} from '@/engine/types'

// ---- Sub-shapes ------------------------------------------------------------

export interface RealmSubstage {
  /** Display label; referenced exactly by hints/journal/gates (§5a). */
  readonly label: string
  /** best threshold; sub-stage done when player[id].best >= at. */
  readonly at: number
  /**
   * Realm multiplier contribution on Qi/sec (no dead mult §9.2), OR `null`.
   *
   * D33: `null` means "this substage's reward is the severance ITSELF, not a
   * modifier" — the Spirit Severing transitions are severance gates whose
   * reward is the transcendent ramp STARTING, not a separate qi bonus (the
   * transition is the event). null is NOT a placeholder 1.0 (rejected as data
   * clutter): every consumer must handle it explicitly so nothing no-ops
   * silently. Act I realms keep their numeric rewards unchanged.
   */
  readonly qiMult: number | null
}

/** A soul aspect row on the Nascent Soul realm. */
export interface SoulAspectRow {
  readonly key: SoulAspectKey
  readonly label: string
  /** The spiritual-root element this aspect embodies, or null for Formless. */
  readonly element: Element | null
  /** meets()-style gate; {} (Formless) is always met (completability floor). */
  readonly requires: Condition
  /** Run-long identity multipliers, every value >= 1 (never a penalty). */
  readonly effect: { readonly qiMult?: number; readonly insightMult?: number }
}

export interface SoulAspectConfig {
  readonly aspects: readonly SoulAspectRow[]
}

/** Foundation Grade weight config (§6). */
export interface FoundationGradeWeights {
  readonly weightMeridian: number
  readonly weightTemper: number
  readonly weightRealm: number
  readonly meridianDenominator: number
  readonly temperDenominator: number
  readonly realmDenominator: number
}

export interface FoundationGradeBand {
  /** Inclusive lower bound on gradeScore. */
  readonly floor: number
  readonly tier: 'Flawed' | 'Stable' | 'Solid' | 'Heaven-grade'
  /** f-gain multiplier for this band. */
  readonly fMult: number
  /** Hard cap a foundation of this grade can ever reach (forge grade key). */
  readonly coreCeiling: CoreGradeKey
  /** Starting Core grade the forge produces before any push offset. */
  readonly baseCore: CoreGradeKey
}

export interface FoundationGradeConfig extends FoundationGradeWeights {
  readonly bands: readonly FoundationGradeBand[]
}

// ---- Realm row -------------------------------------------------------------

export interface RealmRow {
  readonly id: RealmId
  /** Tree row (q=0, f=1, c=2, n=3, s=4). */
  readonly row: number
  readonly name: string
  readonly symbol: string
  readonly color: string
  /** Prestige currency display name. */
  readonly resource: string
  /** Qi required for the first breakthrough. */
  readonly reqBase: number
  /** Prestige gain exponent: gain = (Qi / reqBase)^gainExp. */
  readonly gainExp: number
  /** Optional §5a reveal gate (node appears before unlock). */
  readonly reveal?: Condition
  /** Unlock condition (meets() grammar). */
  readonly unlock: Condition
  /** Ordered sub-stage rows. */
  readonly substages: readonly RealmSubstage[]
  /** Optional cross-system reveal markers keyed off a sub-stage label. */
  readonly reveals?: Readonly<Record<string, string>>
  /** Optional — breakthrough is graded (Foundation §6). */
  readonly graded?: true
  /** Optional Foundation grade config (graded realms only). */
  readonly grade?: FoundationGradeConfig
  /** Optional — key into SETPIECE_DATA (`forge` on c, `firstTribulation` on s). */
  readonly setpiece?: SetpieceKey
  /** Optional Nascent Soul aspect set-piece. */
  readonly soulAspect?: SoulAspectConfig
}

// ---- The data --------------------------------------------------------------

export const REALM_DATA: readonly RealmRow[] = [
  {
    id: 'q',
    row: 0,
    name: 'Qi Condensation',
    symbol: 'Qi',
    color: '#5fc9e0',
    resource: 'qi condensation',
    // Pass-2 tune (pacing §1): reqBase 50→20, gainExp 0.5→0.6 so q.best reaches
    // 6th Level (at:90) in ~30 min, not ~255. Unlock stays at 50 Qi (> reqBase).
    reqBase: 20,
    gainExp: 0.6,
    unlock: { qi: 50 },
    substages: [
      { label: '1st Level', at: 1, qiMult: 1.1 },
      { label: '2nd Level', at: 3, qiMult: 1.1 },
      { label: '3rd Level', at: 8, qiMult: 1.1 },
      { label: '4th Level', at: 20, qiMult: 1.12 },
      { label: '5th Level', at: 45, qiMult: 1.12 },
      { label: '6th Level', at: 90, qiMult: 1.12 },
      { label: '7th Level', at: 170, qiMult: 1.15 },
      { label: '8th Level', at: 300, qiMult: 1.15 },
      { label: '9th Level', at: 500, qiMult: 1.15 },
      { label: '10th Level', at: 800, qiMult: 1.18 },
      { label: '11th Level', at: 1250, qiMult: 1.18 },
      { label: '12th Level', at: 1900, qiMult: 1.18 },
      { label: '13th Level', at: 2800, qiMult: 1.2 },
    ],
    // 6th Level reveals Foundation; 10th Level unlocks Extraordinary Meridians (§5a).
    reveals: { '6th Level': 'foundation', '10th Level': 'extraordinary' },
  },
  {
    id: 'f',
    row: 1,
    name: 'Foundation Establishment',
    symbol: 'Fnd',
    color: '#d8b25a',
    resource: 'foundation',
    // Pass-2 tune (pacing §1): reqBase 5000→1000, gainExp 0.5→0.6 so f.best
    // reaches Great Circle (at:45) in a few-million-Qi budget.
    reqBase: 1000,
    gainExp: 0.6,
    reveal: { realm: ['q', '6th Level'] },
    unlock: { realm: ['q', '6th Level'], meridians: 4 },
    substages: [
      { label: 'Early Foundation', at: 1, qiMult: 1.25 },
      { label: 'Mid Foundation', at: 4, qiMult: 1.25 },
      { label: 'Late Foundation', at: 10, qiMult: 1.3 },
      { label: 'Peak Foundation', at: 22, qiMult: 1.3 },
      { label: 'Great Circle', at: 45, qiMult: 1.4 },
    ],
    reveals: { 'Great Circle': 'core' },
    graded: true,
    grade: {
      weightMeridian: 0.4,
      weightTemper: 0.4,
      weightRealm: 0.2,
      meridianDenominator: 12,
      temperDenominator: 20,
      realmDenominator: 6,
      bands: [
        { floor: 0.0, tier: 'Flawed', fMult: 1.0, coreCeiling: 'lower', baseCore: 'cracked' },
        { floor: 0.35, tier: 'Stable', fMult: 1.5, coreCeiling: 'middle', baseCore: 'lower' },
        { floor: 0.6, tier: 'Solid', fMult: 2.2, coreCeiling: 'upper', baseCore: 'middle' },
        { floor: 0.85, tier: 'Heaven-grade', fMult: 3.5, coreCeiling: 'perfect', baseCore: 'upper' },
      ],
    },
  },
  {
    id: 'c',
    row: 2,
    name: 'Core Formation',
    symbol: 'Core',
    color: '#e0a33a',
    resource: 'core formation',
    reqBase: 250000,
    gainExp: 0.5,
    reveal: { realm: ['f', 'Great Circle'] },
    unlock: { realm: ['f', 'Great Circle'], temperTier: 'tendon' },
    substages: [
      { label: 'Core Forged', at: 1, qiMult: 1.5 },
      { label: 'Core Refined', at: 2, qiMult: 1.75 },
      { label: 'Core Tempered', at: 3, qiMult: 2.0 },
    ],
    // One-time forge (§7a) then refinement (§7b) — never repeatable prestige.
    // Config moved VERBATIM to SETPIECE_DATA.forge; resolved via setpiece key.
    setpiece: 'forge',
  },
  {
    id: 'n',
    row: 3,
    name: 'Nascent Soul',
    symbol: 'Soul',
    color: '#b486e0',
    resource: 'nascent soul',
    // Pass-3 tune (Act I gate, pacing sim): reqBase 5e6→1e6. At 5e6 the full NS
    // climb to Perfected ran ~13.5h alone; 5x cut lands the NS climb near ~3.5h.
    reqBase: 1000000,
    gainExp: 0.5,
    reveal: { realm: ['c', 'Core Forged'] },
    unlock: { realm: ['c', 'Core Refined'] },
    substages: [
      { label: 'Early Nascent Soul', at: 1, qiMult: 1.6 },
      { label: 'Mid Nascent Soul', at: 4, qiMult: 1.7 },
      { label: 'Late Nascent Soul', at: 12, qiMult: 1.8 },
      { label: 'Peak Nascent Soul', at: 30, qiMult: 1.9 },
      { label: 'Great Circle', at: 75, qiMult: 2.1 },
      { label: 'Apex', at: 175, qiMult: 2.3 },
      { label: 'Perfected', at: 400, qiMult: 2.6 },
    ],
    soulAspect: {
      aspects: [
        // Formless — the generalist floor. Always pickable ({}); the completability
        // floor so NS is never aspect-blocked even with no Dao Seeds.
        { key: 'formless', label: 'Formless Soul', element: null, requires: {}, effect: { qiMult: 1.2, insightMult: 1.2 } },
        // Element aspects: Seed-gated, so they carry Formless's 1.2 as a FLOOR on
        // both axes plus their elemental lean — an earned aspect is never the
        // wrong pick against the free floor (the metalSoul trap-aspect fix,
        // 2026-07-02: insight-only lines were strictly worse than Formless for
        // the default Qi grammar; found by the diversity sim's counterfactual
        // probes, lint-enforced in rules.test as the default-grammar floor).
        // Metal (Sword) — the §4.2 sword line is an Insight engine; lean insightMult.
        { key: 'metalSoul', label: 'Sword Soul', element: 'metal', requires: { daoElementTier: ['metal', 2] }, effect: { qiMult: 1.2, insightMult: 1.5 } },
        // Wood — vitality of the living world; lean qiMult.
        { key: 'woodSoul', label: 'Verdant Soul', element: 'wood', requires: { daoElementTier: ['wood', 2] }, effect: { qiMult: 1.45, insightMult: 1.2 } },
        // Water (Flow) — the §4.2 flow line leans Insight.
        { key: 'waterSoul', label: 'Flowing Soul', element: 'water', requires: { daoElementTier: ['water', 2] }, effect: { qiMult: 1.2, insightMult: 1.5 } },
        // Fire (Life) — feeds the body's gathering; lean qiMult.
        { key: 'fireSoul', label: 'Blazing Soul', element: 'fire', requires: { daoElementTier: ['fire', 2] }, effect: { qiMult: 1.5, insightMult: 1.2 } },
        // Earth (Mountain) — immovable foundation; lean qiMult.
        { key: 'earthSoul', label: 'Mountain Soul', element: 'earth', requires: { daoElementTier: ['earth', 2] }, effect: { qiMult: 1.45, insightMult: 1.2 } },
      ],
    },
  },
  {
    id: 's',
    row: 4,
    name: 'Soul Formation',
    symbol: 'Form',
    color: '#e08fb4',
    resource: 'soul formation',
    reqBase: 500000000,
    gainExp: 0.45,
    reveal: { realm: ['n', 'Great Circle'] },
    unlock: { realm: ['n', 'Apex'] },
    substages: [
      { label: 'Early Soul Formation', at: 1, qiMult: 2.8 },
      { label: 'Mid Soul Formation', at: 5, qiMult: 3.0 },
      { label: 'Late Soul Formation', at: 16, qiMult: 3.2 },
      { label: 'Peak Soul Formation', at: 45, qiMult: 3.5 },
      { label: 'Apex of Soul Formation', at: 120, qiMult: 3.8 },
      { label: 'Great Circle of Soul Formation', at: 320, qiMult: 4.2 },
    ],
    setpiece: 'firstTribulation',
  },
  {
    // Slice 9 — Act II opens (docs/slice-9.md; tree membership 'act2' in
    // TREE_DATA, so no Act I realm can cascade-reset it and it cascade-resets
    // nothing below (cross-tree keeps are topological, not exceptional).
    // The realm both reveals AND unlocks on the passed tribulation: what
    // Spirit Severing is actually like stays veiled until the crossing
    // (D11 — veil the ahead, never the now).
    // D28 (The Offering): realm x is NOT a qi climb. prestige('x') is the
    // OFFERING action (a basket of qi+insight consumed); the verb is
    // sacrifice, not accumulate (D27's register break).
    //   - reqBase / gainExp are RETIRED for x — kept only for the RealmRow
    //     type shape; the offering path (severing store) ignores them. No
    //     qi threshold is crossed and no prestige gain accrues; realm-x
    //     points/best/total stay zero for honesty (D28).
    //   - substage `at` values are REINTERPRETED as severance-COUNT
    //     thresholds [1,2,3] (the corpse names already assumed this, D27).
    //     The realm store latches x milestones off severing.severances.length
    //     (NOT realmBest), so the sub-stages mark CUTS, not points.
    // D33 (Q12 closed): the substage qiMults are STRIPPED to `null`. The old
    // 2.0/2.4/2.8 were doing two conflicting jobs (Act II qi scaling AND
    // early-ramp compensation) and the scaling overwhelmed the severance cost —
    // qi ROSE at every trough, contradicting D23's emotional design. Now the
    // transcendent ramp (c=0.5 → k=2.0, SETPIECE_DATA.severance) is the ONLY
    // compensation for a cut: the transition doesn't need a separate bonus
    // because the transition IS the event. null = "reward is the severance
    // itself" (see RealmSubstage.qiMult); consumers skip it explicitly.
    id: 'x',
    row: 5,
    name: 'Spirit Severing',
    symbol: 'Sever',
    color: '#b48fe0',
    resource: 'spirit severing',
    reqBase: 2e10, // RETIRED for x (type-shape only — offering path ignores it).
    gainExp: 0.4, // RETIRED for x (type-shape only — no prestige gain accrues).
    reveal: { tribulationPassed: true },
    unlock: { tribulationPassed: true },
    substages: [
      // `at` = severance COUNT (D28), not a qi/points threshold. qiMult = null
      // (D33): the ramp is the only compensation; the cut grants no qi bonus.
      { label: 'The Past Lies Severed', at: 1, qiMult: null },
      { label: 'The Present Lies Severed', at: 2, qiMult: null },
      { label: 'The Future Lies Severed', at: 3, qiMult: null },
    ],
    setpiece: 'severance',
  },
]

// ---- Convenience lookups (typed) ------------------------------------------

const REALM_BY_ID: Record<RealmId, RealmRow> = Object.fromEntries(
  REALM_DATA.map((r) => [r.id, r]),
) as Record<RealmId, RealmRow>

export function findRealm(id: RealmId): RealmRow {
  return REALM_BY_ID[id]
}

export function realmWithSetpiece(setpieceKey: SetpieceKey): RealmRow | undefined {
  return REALM_DATA.find((r) => r.setpiece === setpieceKey)
}

export function realmWithSoulAspect(): RealmRow | undefined {
  return REALM_DATA.find((r) => r.soulAspect !== undefined)
}

/** Sub-stage index for a given label on a realm, or -1 if not found. */
export function substageIndexForLabel(realm: RealmRow, label: string): number {
  return realm.substages.findIndex((s) => s.label === label)
}

/** The sub-stage label at a given best (highest met sub-stage), or null. */
export function substageLabelAtBest(realm: RealmRow, best: number): string | null {
  let matched: string | null = null
  for (const s of realm.substages) {
    if (best >= s.at) matched = s.label
    else break
  }
  return matched
}
