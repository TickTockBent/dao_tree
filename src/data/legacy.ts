// src/data/legacy.ts — the eternal Legacy store (design §8.1 "Legacy Grades are eternal";
// §5 Act I table "Act I Legacy Grade = f(core grade, aspect depth, Dao Seeds, sect rank,
// tribulation grade) ⟨tune weights⟩, stored eternal-scope").
//
// Port of js/data/legacy.js. The Act I Legacy Grade is computed ONCE, on the
// first tribulation PASS, from a weighted blend of everything Act I built,
// stored eternal-scope, and NEVER downgraded (a later weaker life can only
// raise it — eternal permanence §8.1).

import type { LegacyBandKey } from '@/engine/types'

export interface LegacyWeights {
  readonly coreGrade: number
  readonly tribulation: number
  readonly aspect: number
  readonly sectStanding: number
  readonly daoSeeds: number
}

export interface LegacyDenominators {
  /** Top ceilingIndex of the core ladder (Perfect = index 4). */
  readonly coreGrade: number
  /** none = 0, formless = 1, element = 2. */
  readonly aspect: number
  /** ~eight held Seeds is "deeply comprehended" for Act I ⟨tune⟩. */
  readonly daoSeeds: number
  /** The deeds checkpoint count (Outer + Inner Disciple = 2). */
  readonly sectStanding: number
  /** The tribulation gradeIndex top (Flawless = index 3). */
  readonly tribulation: number
}

export interface LegacyBand {
  readonly key: LegacyBandKey
  readonly label: string
  /** Inclusive lower bound on the [0,1] weighted score. */
  readonly floor: number
  /** Live eternal payoff folded into Qi/sec via legacyQiMult(). */
  readonly qiMult: number
}

export interface LegacyActOneConfig {
  /** Per-input weight; sums to 1 (linter-checkable, §6 gradeScore precedent). */
  readonly weights: LegacyWeights
  readonly denominators: LegacyDenominators
  readonly bands: readonly LegacyBand[]
}

export interface LegacyConfig {
  readonly id: 'legacy'
  readonly name: string
  readonly symbol: string
  readonly color: string
  readonly actOne: LegacyActOneConfig
}

export const LEGACY_DATA: LegacyConfig = {
  id: 'legacy',
  name: 'Legacy',
  symbol: '魂',
  color: '#d9c25a',
  actOne: {
    // ⟨tune⟩: core grade is the heaviest single axis (the carried artifact is
    // the spine of Act I); tribulation next (capstone performance); then
    // aspect / sect standing / Dao Seeds as side-grammar contributions.
    weights: {
      coreGrade: 0.35,
      tribulation: 0.25,
      aspect: 0.15,
      sectStanding: 0.15,
      daoSeeds: 0.1,
    },
    denominators: {
      coreGrade: 4,
      aspect: 2,
      daoSeeds: 8,
      sectStanding: 2,
      tribulation: 3,
    },
    bands: [
      { key: 'faint', label: 'Faint Legacy', floor: 0.0, qiMult: 1.0 },
      { key: 'steady', label: 'Steady Legacy', floor: 0.3, qiMult: 1.15 },
      { key: 'radiant', label: 'Radiant Legacy', floor: 0.55, qiMult: 1.35 },
      { key: 'eternal', label: 'Eternal Legacy', floor: 0.8, qiMult: 1.6 },
    ],
  },
}

export function legacyBandByKey(key: LegacyBandKey): LegacyBand {
  const row = LEGACY_DATA.actOne.bands.find((b) => b.key === key)
  if (!row) throw new Error(`Unknown legacy band key: ${key}`)
  return row
}
