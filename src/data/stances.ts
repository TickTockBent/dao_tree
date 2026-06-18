// src/data/stances.ts — single source of truth for cultivation stances (design §6.1/§8.4).
//
// Port of js/data/stances.js. Stances are voluntary, toggleable global modifiers
// with an opportunity cost — "enterable and exitable freely" (§6.1). They
// introduce no resource and no reset; a stance only retunes the live multiplier
// product. Every stance must TRADE: at least one modifier < 1 AND at least one
// > 1, so it is a real opportunity cost (lint-enforced, §6.1/§6.3).

import type { Condition } from '@/engine/meets'
import type { StanceKey } from '@/engine/types'

export interface StanceModifiers {
  /** Multiply Qi/sec while active (stanceQiMult). Omitted = identity (1). */
  readonly qiMult?: number
  /** Multiply Insight/sec while active (stanceInsightMult). Omitted = identity (1). */
  readonly insightMult?: number
}

export interface StanceRow {
  readonly key: StanceKey
  readonly name: string
  /** meets()-style condition (extended with daoNode for lattice gates). {} = always. */
  readonly unlock: Condition
  /** Global factors this stance applies WHILE ACTIVE. Every value > 0 (§6.3). */
  readonly modifiers: StanceModifiers
}

export interface StanceData {
  /** How many stances may be active at once. 1 in slice 3 (single-slot storage). */
  readonly maxActive: number
  readonly stances: readonly StanceRow[]
}

export const STANCE_DATA: StanceData = {
  maxActive: 1,
  stances: [
    {
      // Breathing Trance (§6.1 starter): qi down, Insight up. Seeds the lattice
      // grammar early at near-zero cost. Free with the dao layer (unlock {}).
      key: 'breathingTrance',
      name: 'Breathing Trance',
      unlock: {},
      modifiers: { qiMult: 0.7, insightMult: 2.0 },
    },
    {
      // Sword Trance (§6.1 starter): "everything down, sword-line Insight way up."
      // Unlocks once Sword Intent is glimpsed (daoNode ["sword", 1]).
      key: 'swordTrance',
      name: 'Sword Trance',
      unlock: { daoNode: ['sword', 1] },
      modifiers: { qiMult: 0.4, insightMult: 3.5 },
    },
  ],
}

export function findStance(key: StanceKey): StanceRow {
  const row = STANCE_DATA.stances.find((s) => s.key === key)
  if (!row) throw new Error(`Unknown stance key: ${key}`)
  return row
}
