// src/data/gates.ts — single source of truth for story gates (spec §8).
//
// Port of js/data/gates.js. Story gates are fire-once achievements that read
// live cross-layer state and grant a permanent global buff — never reset-based
// challenges (§8/§9.1). Each carries kind:"checkpoint" so the linter
// distinguishes narrative gates from optional buffs. Gates live on a life-scoped
// layer so they never reset.

import type { Condition } from '@/engine/meets'
import type { GateAchievementKey } from '@/engine/types'

export interface GateAchievement {
  /** Semantic key (referenced by hints/journal via achievement:["gate", id]). */
  readonly key: GateAchievementKey
  /** "checkpoint" (narrative gate) — data category, §8. */
  readonly kind: 'checkpoint'
  readonly name: string
  /** Live-state condition (meets() grammar). */
  readonly done: Condition
  /** Permanent global buff granted while held. */
  readonly effect: { readonly qiMult: number }
  /** Optional hard wall: a later layer's unlock reads hasAchievement of this. null = buff only. */
  readonly gates: null
}

export interface GateData {
  readonly id: 'gate'
  readonly name: string
  readonly symbol: string
  readonly color: string
  readonly achievements: readonly GateAchievement[]
}

export const GATE_DATA: GateData = {
  id: 'gate',
  // Display renamed to "Deeds" (slice 5): the gate layer is the CHECKPOINT RECORD.
  name: 'Deeds',
  symbol: '事',
  color: '#9a8fd8',
  achievements: [
    {
      key: 'outerDisciple',
      kind: 'checkpoint',
      name: 'Outer Disciple',
      // done = JOINED a sect AND reached Foundation (any grade) AND meridians >= 6
      // AND temper tier >= Flesh (§8). A no-sect cultivator never earns this rank.
      done: { sectJoined: true, realm: ['f', 'Early Foundation'], meridians: 6, temperTier: 'flesh' },
      effect: { qiMult: 1.25 },
      gates: null,
    },
    {
      key: 'innerDisciple',
      kind: 'checkpoint',
      name: 'Inner Disciple',
      // sectJoined + contribution best >= 1000 (mid-game standing) + realm c Core Forged.
      done: { sectJoined: true, contribution: 1000, realm: ['c', 'Core Forged'] },
      effect: { qiMult: 1.3 },
      gates: null,
    },
  ],
}

/** The numeric achievement id for a given key (positional + 11, matching the
 * old TMT achievement-id convention so existing achievement:["gate", N]
 * references in journal data resolve unchanged). */
export function gateAchievementId(key: GateAchievementKey): number {
  const idx = GATE_DATA.achievements.findIndex((a) => a.key === key)
  if (idx < 0) throw new Error(`Unknown gate achievement key: ${key}`)
  return 11 + idx
}
