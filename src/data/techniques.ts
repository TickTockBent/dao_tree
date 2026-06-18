// src/data/techniques.ts — the permanent arts library (design §4.3, LIFE scope).
//
// Port of js/data/techniques.js. Techniques are a permanent arts library bought
// with Contribution. They are LIFE-scoped (owned techniques persist in sect
// state), never reset this slice.
//
// SCHOOL + TIER GATING (design §4.3 "each offers a different technique library"):
//   - school "sword"     — visible/buyable ONLY while joined to the Azure Sword Sect.
//   - school "formation" — visible/buyable ONLY while joined to the Stone Formation Sect.
//   - school "universal" — available to BOTH archetypes.
//   - libraryTier 1 — buyable as soon as the technique's school is available.
//   - libraryTier 2 — additionally gated on the sect LIBRARY milestone.

import type { TechniqueKey, TechniqueSchool } from '@/engine/types'

/** Effect is ONLY { qiMult } OR { insightMult }, every value >= 1 (never a penalty). */
export type TechniqueEffect = { readonly qiMult: number } | { readonly insightMult: number }

export interface TechniqueRow {
  readonly key: TechniqueKey
  readonly name: string
  readonly school: TechniqueSchool
  /** 1 = buyable when school available; 2 = additionally gated on library milestone. */
  readonly libraryTier: 1 | 2
  /** Contribution cost (ascending WITHIN a school so it reads as a ladder). */
  readonly cost: number
  readonly effect: TechniqueEffect
  readonly flavor: string
}

export const TECHNIQUE_DATA: readonly TechniqueRow[] = [
  // --- Sword school (Azure Sword Sect, element metal). Leans insightMult. ---
  { key: 'azureForm', name: 'Azure Sword Form', school: 'sword', libraryTier: 1, cost: 600, effect: { qiMult: 1.12 }, flavor: 'The first form: a straight cut, endlessly drilled.' },
  { key: 'severingArc', name: 'Severing Arc', school: 'sword', libraryTier: 1, cost: 1800, effect: { insightMult: 1.2 }, flavor: 'Intent sharpens until the blade cuts the idea of resistance.' },
  { key: 'swordHeart', name: 'Sword Heart Sutra', school: 'sword', libraryTier: 2, cost: 9000, effect: { insightMult: 1.3 }, flavor: 'A heart that is a blade comprehends the Dao of severance.' },
  // --- Formation school (Stone Formation Sect, element earth). Leans qiMult. ---
  { key: 'stoneSkin', name: 'Stone Skin Array', school: 'formation', libraryTier: 1, cost: 600, effect: { qiMult: 1.12 }, flavor: 'A novice\'s ward: stone drawn close until the flesh forgets it is soft.' },
  { key: 'wardLattice', name: 'Warding Lattice', school: 'formation', libraryTier: 1, cost: 1800, effect: { qiMult: 1.2 }, flavor: 'Spirit-stones set in a quiet grid drink ambient Qi and return it tenfold.' },
  { key: 'mountainHeart', name: 'Mountain Heart Seal', school: 'formation', libraryTier: 2, cost: 9000, effect: { qiMult: 1.3 }, flavor: 'The formation and the formationmaster become one immovable peak.' },
  // --- Universal (shared sect canon, available to BOTH archetypes). ---
  { key: 'breathCanon', name: 'Eight Breaths Canon', school: 'universal', libraryTier: 1, cost: 1200, effect: { qiMult: 1.1 }, flavor: 'Eight measured breaths the sect teaches every outer disciple.' },
  { key: 'stillMind', name: 'Still-Mind Meditation', school: 'universal', libraryTier: 2, cost: 5000, effect: { insightMult: 1.15 }, flavor: 'A mind made still hears the Dao that a loud one drowns out.' },
]

export function findTechnique(key: TechniqueKey): TechniqueRow {
  const row = TECHNIQUE_DATA.find((t) => t.key === key)
  if (!row) throw new Error(`Unknown technique key: ${key}`)
  return row
}

/** Array index for a technique (its positional upgrade id). */
export function techniqueIndex(key: TechniqueKey): number {
  const idx = TECHNIQUE_DATA.findIndex((t) => t.key === key)
  if (idx < 0) throw new Error(`Unknown technique key: ${key}`)
  return idx
}
