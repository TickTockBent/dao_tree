// src/data/body.ts — single source of truth for the Body side layer (spec §3/§4/§6).
//
// Port of js/data/body.js. The Body layer is life-scoped and NEVER reset, so the
// permanent body tracks (meridians, tempering) and the stored grades (§6)
// survive every realm breakthrough by topology. All numbers are pass-1 ⟨tune⟩.

import type { Condition } from '@/engine/meets'
import type { BodyBuyableKey, TemperTierKey } from '@/engine/types'

export interface BodyQiConfig {
  /** Base Qi/sec (spec §2). */
  readonly baseRate: number
  /** Starting Core Grade index sentinel (-1 = no core forged yet). */
  readonly coreGradeStartIndex: -1
}

export interface BodyBuyableRow {
  /** Semantic key (the new engine uses this; the old TMT numeric id is dropped). */
  readonly key: BodyBuyableKey
  readonly title: string
  readonly resourceWord: string
  /** Optional — appends "(+N% per <noun>)" to the effect line. Omitted for temper. */
  readonly effectStepNoun?: string
  readonly costBase: number
  /** cost(x) = costBase * costRatio^x. */
  readonly costRatio: number
  /** effect(x) = effectBase^x (1.15 meridian, 1 temper — temper handled via tiers). */
  readonly effectBase: number
  /** purchaseLimit (caps purchasability §4a/§4b). */
  readonly limit: number
  /** Unlock condition (meets() grammar); null = always. */
  readonly unlock: Condition | null
}

export interface TemperTierRow {
  readonly key: TemperTierKey
  readonly label: string
  /** First level in the tier. */
  readonly fromLevel: number
  /** Immediate Qi/sec granted when this tier is first entered (§4b). */
  readonly qiBonus: number
}

export interface BodyGradeSlotConfig {
  /** Index before any breakthrough/forge (no grade yet). */
  readonly startIndex: -1
}

export interface BodyConfig {
  readonly id: 'b'
  readonly name: string
  readonly symbol: string
  readonly color: string
  readonly resource: string
  readonly qi: BodyQiConfig
  readonly buyables: readonly BodyBuyableRow[]
  /** Key of the Temper Body buyable (its tier crossings drive per-tier milestones). */
  readonly temperBuyableKey: BodyBuyableKey
  readonly temperTiers: readonly TemperTierRow[]
  /** Stored, reset-immune grade slots (§6). */
  readonly grades: {
    readonly foundationGrade: BodyGradeSlotConfig
    readonly coreGrade: BodyGradeSlotConfig
  }
  /** Chosen Soul Aspect slot (LIFE-scoped; "" = unchosen). */
  readonly soulAspect: { readonly startKey: '' }
  /** Failure-scar slot (LIFE-scoped; design §1.3/§6.2/§10.9). */
  readonly scar: {
    readonly startDepth: 0
    readonly startHealProgress: 0
    readonly startHealedDepth: 0
  }
}

export const BODY_DATA: BodyConfig = {
  id: 'b',
  name: 'Body',
  symbol: 'Body',
  color: '#c97b5a',
  resource: 'body refinement',
  qi: {
    // Pass-2 tune: raised 1→2 so the early grind clears the §1 45-90 min target
    // after the gradeScore blocker fix removed the inadvertent 3.5x Heaven f-gain.
    baseRate: 2,
    coreGradeStartIndex: -1,
  },
  buyables: [
    {
      key: 'primaryMeridian',
      title: 'Primary Meridian',
      resourceWord: 'Qi/sec',
      effectStepNoun: 'meridian',
      costBase: 10,
      // Pass-3 tune (Act I gate, pacing sim): 3→2. At 3 the 11th→12th open cost
      // ~1.8M Qi — the back half of the track was dead weight pre-core.
      costRatio: 2,
      effectBase: 1.15,
      limit: 12,
      unlock: null,
    },
    {
      key: 'extraordinaryMeridian',
      title: 'Extraordinary Meridian',
      resourceWord: 'Qi/sec',
      effectStepNoun: 'meridian',
      costBase: 5000,
      costRatio: 5,
      effectBase: 1.25,
      limit: 8,
      // Unlocks after all 12 primary open AND Qi Condensation 10th Level (§4a/§5a).
      unlock: { primaryMeridiansAll: true, realm: ['q', '10th Level'] },
    },
    {
      key: 'temper',
      title: 'Temper Body',
      resourceWord: 'Foundation ceiling',
      costBase: 25,
      // Pass-2 tune: 2.2→1.7 so reaching Tendon (level 10, the Core gate §5c)
      // isn't a Qi wall. Pass-3 tune: 1.7→1.45 so Bone/Marrow tiers (15/20) are
      // reachable in budget pre-forge.
      costRatio: 1.45,
      effectBase: 1,
      limit: 24,
      unlock: null,
    },
  ],
  temperBuyableKey: 'temper',
  temperTiers: [
    { key: 'skin', label: 'Skin', fromLevel: 1, qiBonus: 1.05 },
    { key: 'flesh', label: 'Flesh', fromLevel: 5, qiBonus: 1.05 },
    { key: 'tendon', label: 'Tendons', fromLevel: 10, qiBonus: 1.05 },
    { key: 'bone', label: 'Bones', fromLevel: 15, qiBonus: 1.05 },
    { key: 'marrow', label: 'Marrow', fromLevel: 20, qiBonus: 1.05 },
  ],
  grades: {
    foundationGrade: { startIndex: -1 },
    coreGrade: { startIndex: -1 },
  },
  soulAspect: { startKey: '' },
  scar: { startDepth: 0, startHealProgress: 0, startHealedDepth: 0 },
}

// ---- Convenience lookups ---------------------------------------------------

export function findBodyBuyable(key: BodyBuyableKey): BodyBuyableRow {
  const row = BODY_DATA.buyables.find((b) => b.key === key)
  if (!row) throw new Error(`Unknown body buyable key: ${key}`)
  return row
}

export function temperTierByKey(key: TemperTierKey): TemperTierRow {
  const row = BODY_DATA.temperTiers.find((t) => t.key === key)
  if (!row) throw new Error(`Unknown temper tier key: ${key}`)
  return row
}

/** The temper tier currently active at a given temper level, or null if level 0. */
export function temperTierForLevel(level: number): TemperTierRow | null {
  if (level < 1) return null
  let matched: TemperTierRow | null = null
  for (const tier of BODY_DATA.temperTiers) {
    if (level >= tier.fromLevel) matched = tier
    else break
  }
  return matched
}
