// src/data/setpieces.ts — the set-piece config type (design §6.2).
//
// Port of js/data/setpieces.js. A "set-piece" is a one-time, performance-graded
// breakthrough event mounted on a realm row. The FORGE (Core Formation) is
// instance 1; the FIRST TRIBULATION (Soul Formation, Act I capstone) is
// instance 2. Each realm that carries a set-piece names it by key in
// REALM_DATA via `setpiece`; the engine resolves the config from here.

import type { CoreGradeKey, ForgePushKey, TribGradeKey, TribWaveKey } from '@/engine/types'
import type { Condition } from '@/engine/meets'

// ---- INSTANCE 1 — The Forge ------------------------------------------------

export interface ForgePushOption {
  readonly key: ForgePushKey
  readonly label: string
  readonly fuelMult: number
  /** Shifts the produced grade (0/1/2 for Steady/Forceful/Reckless). */
  readonly offset: number
  /** Drop-one-tier risk. */
  readonly crackChance: number
}

export interface ForgeRefinementConfig {
  /** Progress units for one tier. */
  readonly goal: number
  /** Base accrual per second while warming. */
  readonly ratePerSecond: number
  /** Tiers gained per full bar. */
  readonly tierStep: number
  /** Refinement bar width (px) — UI dimension as data (§11). */
  readonly barWidth: number
  readonly barHeight: number
}

export interface ForgeGradeRow {
  readonly key: CoreGradeKey
  readonly label: string
  /** Ordered ladder position (0..4 = cracked..perfect). */
  readonly ceilingIndex: number
  /** Global Qi/sec multiplier. */
  readonly globalMult: number
}

export interface ForgeConfig {
  /** f.points required to open the forge. */
  readonly forgeReq: number
  /** Base fuel spent per push (× fuelMult). */
  readonly fuelBase: number
  readonly pushOptions: readonly ForgePushOption[]
  /** A crack drops exactly this many tiers; cracked is the floor. */
  readonly crackTierDrop: number
  readonly refinement: ForgeRefinementConfig
  readonly grades: readonly ForgeGradeRow[]
}

// ---- INSTANCE 2 — The First Tribulation -----------------------------------

export interface TribIntensityConfig {
  readonly base: number
  /** Scales intensity gently with the s realm high-water. */
  readonly perBest: number
}

export interface TribWaveRow {
  readonly key: TribWaveKey
  readonly name: string
  /** Damage × intensity drains the pool when the wave's scheduled moment crosses. */
  readonly damage: number
}

export interface TribPoolConfig {
  readonly weightTemper: number
  readonly temperDenominator: number
  readonly weightMeridians: number
  readonly meridianDenominator: number
  readonly weightCoreGrade: number
  readonly weightTechniques: number
  readonly techniqueDenominator: number
  readonly qiFuelWeight: number
  readonly qiFuelDenominator: number
}

export interface TribGradeRow {
  readonly key: TribGradeKey
  readonly label: string
  /** False only for Failed (index 0). */
  readonly passes: boolean
  /** True marks grades that leave a scar (Failed always; Scarred by definition). */
  readonly scars: boolean
  /** Inclusive lower bound on remaining pool fraction. */
  readonly floor?: number
}

export interface TribulationConfig {
  readonly kind: 'tribulation'
  readonly name: string
  readonly trigger: Condition
  readonly intensity: TribIntensityConfig
  readonly durationSeconds: number
  readonly waves: readonly TribWaveRow[]
  readonly pool: TribPoolConfig
  readonly grades: readonly TribGradeRow[]
  readonly retryCooldownSeconds: number
}

// ---- The Scar table --------------------------------------------------------

export interface ScarTable {
  /** Depth ceiling (§10.9 lean 3). */
  readonly maxDepth: number
  /** Active debuff = this^activeDepth (~12%/depth Qi/sec down, never zero §6.3). */
  readonly debuffQiMultPerDepth: number
  /** Heal progress units per depth healed. */
  readonly healGoalPerDepth: number
  /** Passive heal accrual/sec. */
  readonly healRatePerSecond: number
  /** Permanent buff = this^healedDepth (~6%/depth healed, "Tempered by Ruin"). */
  readonly temperedQiMultPerDepth: number
}

// ---- The aggregate --------------------------------------------------------

export interface SetpieceData {
  readonly forge: ForgeConfig
  readonly firstTribulation: TribulationConfig
  readonly scar: ScarTable
}

export const SETPIECE_DATA: SetpieceData = {
  forge: {
    forgeReq: 25,
    fuelBase: 25,
    pushOptions: [
      { key: 'steady', label: 'Steady', fuelMult: 1, offset: 0, crackChance: 0.0 },
      { key: 'forceful', label: 'Forceful', fuelMult: 2, offset: 1, crackChance: 0.15 },
      { key: 'reckless', label: 'Reckless', fuelMult: 3, offset: 2, crackChance: 0.35 },
    ],
    crackTierDrop: 1,
    refinement: { goal: 100, ratePerSecond: 1, tierStep: 1, barWidth: 360, barHeight: 28 },
    grades: [
      { key: 'cracked', label: 'Cracked', ceilingIndex: 0, globalMult: 2 },
      { key: 'lower', label: 'Lower', ceilingIndex: 1, globalMult: 3 },
      { key: 'middle', label: 'Middle', ceilingIndex: 2, globalMult: 4 },
      { key: 'upper', label: 'Upper', ceilingIndex: 3, globalMult: 6 },
      { key: 'perfect', label: 'Perfect', ceilingIndex: 4, globalMult: 8 },
    ],
  },
  firstTribulation: {
    kind: 'tribulation',
    name: 'The First Tribulation',
    trigger: { realm: ['s', 'Great Circle of Soul Formation'] },
    intensity: { base: 1.0, perBest: 0.0005 },
    durationSeconds: 35,
    waves: [
      { key: 'gale', name: 'Gale', damage: 14 },
      { key: 'flame', name: 'Heart Flame', damage: 18 },
      { key: 'frost', name: 'Killing Frost', damage: 22 },
      { key: 'thunder', name: 'Nine-Fold Thunder', damage: 28 },
      { key: 'tribulationLightning', name: 'Tribulation Lightning', damage: 36 },
    ],
    pool: {
      weightTemper: 90,
      temperDenominator: 24,
      weightMeridians: 90,
      meridianDenominator: 12,
      weightCoreGrade: 130,
      weightTechniques: 60,
      techniqueDenominator: 4,
      qiFuelWeight: 90,
      qiFuelDenominator: 12,
    },
    grades: [
      { key: 'failed', label: 'Failed', passes: false, scars: true },
      { key: 'shaken', label: 'Shaken', passes: true, scars: false, floor: 0.0 },
      { key: 'scarred', label: 'Scarred', passes: true, scars: true, floor: 0.35 },
      { key: 'flawless', label: 'Flawless', passes: true, scars: false, floor: 0.7 },
    ],
    retryCooldownSeconds: 60,
  },
  scar: {
    maxDepth: 3,
    debuffQiMultPerDepth: 0.88,
    healGoalPerDepth: 240,
    healRatePerSecond: 1,
    temperedQiMultPerDepth: 1.06,
  },
}

// ---- Convenience lookups ---------------------------------------------------

export function forgeGradeByKey(key: CoreGradeKey): ForgeGradeRow {
  const row = SETPIECE_DATA.forge.grades.find((g) => g.key === key)
  if (!row) throw new Error(`Unknown forge grade key: ${key}`)
  return row
}

export function tribGradeByKey(key: TribGradeKey): TribGradeRow {
  const row = SETPIECE_DATA.firstTribulation.grades.find((g) => g.key === key)
  if (!row) throw new Error(`Unknown tribulation grade key: ${key}`)
  return row
}
