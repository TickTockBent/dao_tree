// src/data/lattice.ts — single source of truth for the Dao lattice (design §4.2/§8.7).
//
// Port of js/data/lattice.js. The Dao lattice is the second grammar of the
// game: a comprehension graph that NEVER resets within a life — it is
// LIFE-scoped, sitting outside every realm tree. Its currency is Insight, which
// trickles passively once the lattice is revealed mid-Qi-Condensation.
//
// Slice-3 "smallest honest version": Glimpse/Seed tiers only, EXACTLY 15 nodes
// (five elemental roots + two ring-2 derived concepts per element).
// Manifestation/Law tiers and the conflict EXCLUSIVITY they bind are declared
// now as `conflicts` but bind at Manifestation tier in Act II (schema-now,
// content-later — Q5 doctrine).

import type { Condition } from '@/engine/meets'
import type { Element, LatticeNodeKey, LatticeTierKey } from '@/engine/types'

export interface LatticeTierRow {
  readonly key: LatticeTierKey
  readonly label: string
}

/** One effect object per tier: { qiMult } or { insightMult }, value >= 1. */
export type LatticeNodeEffect = { readonly qiMult: number } | { readonly insightMult: number }

export interface LatticeNodeRow {
  readonly key: LatticeNodeKey
  readonly name: string
  readonly element: Element
  /** Node keys that must own tier >= 1 (Glimpse) before this unlocks. Roots = []. */
  readonly requires: readonly LatticeNodeKey[]
  /** [glimpseCost, seedCost] in Insight; positional over tiers. Ascending per node. */
  readonly costs: readonly number[]
  /** One effect object per tier (positional over tiers). */
  readonly effects: readonly LatticeNodeEffect[]
}

export interface LatticeConfig {
  readonly id: 'dao'
  readonly name: string
  readonly symbol: string
  readonly color: string
  /** meets()-style reveal condition (§5a grammar). Latches `revealed` once met. */
  readonly unlock: Condition
  /** Insight currency name + passive trickle/sec (accrued only AFTER reveal). */
  readonly insight: { readonly resource: string; readonly baseRate: number }
  /** Ordered tier rows; index = tier ordinal (glimpse=1, seed=2). */
  readonly tiers: readonly LatticeTierRow[]
  readonly nodes: readonly LatticeNodeRow[]
  /** Pairs of node keys mutually exclusive at depth (§4.2). Binds at Manifestation. */
  readonly conflicts: readonly [LatticeNodeKey, LatticeNodeKey][]
}

export const LATTICE_DATA: LatticeConfig = {
  id: 'dao',
  name: 'Dao Lattice',
  symbol: '道',
  color: '#8a6fd8',
  // §5a reveal grammar: the lattice reveals at Qi Condensation 4th Level, mid-Act-I.
  unlock: { realm: ['q', '4th Level'] },
  // 0.5/sec base makes the cheapest root Glimpse (100) affordable ~3-4 min after
  // reveal on trickle alone (pacing intent).
  insight: { resource: 'Insight', baseRate: 0.5 },
  tiers: [
    { key: 'glimpse', label: 'Glimpse' },
    { key: 'seed', label: 'Seed' },
  ],
  nodes: [
    // --- Roots (the Five Elements, matching spiritual roots §4.2/§7.1) ---
    { key: 'metal', name: 'Metal Root', element: 'metal', requires: [], costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
    { key: 'wood', name: 'Wood Root', element: 'wood', requires: [], costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
    { key: 'water', name: 'Water Root', element: 'water', requires: [], costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
    { key: 'fire', name: 'Fire Root', element: 'fire', requires: [], costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
    { key: 'earth', name: 'Earth Root', element: 'earth', requires: [], costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
    // --- Ring 2 (first derived concept per element; requires its root) ---
    // Sword (Metal): the §4.2 sword line; insight-leaning (gates Sword Trance).
    { key: 'sword', name: 'Sword Intent', element: 'metal', requires: ['metal'], costs: [250, 800], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
    { key: 'growth', name: 'Growth', element: 'wood', requires: ['wood'], costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },
    // Flow (Water): half of the Flow/Stillness tension pair; insight-leaning.
    { key: 'flow', name: 'Flow', element: 'water', requires: ['water'], costs: [250, 800], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
    // Life (Fire): the yang half of Fire's life/death yin-yang pair; qi-leaning.
    { key: 'life', name: 'Life', element: 'fire', requires: ['fire'], costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },
    { key: 'mountain', name: 'Mountain', element: 'earth', requires: ['earth'], costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },
    // --- Ring 2b (deeper/sharper aspect per element; still requires only root) ---
    { key: 'edge', name: 'Cutting Edge', element: 'metal', requires: ['metal'], costs: [600, 2000], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] },
    { key: 'vitality', name: 'Vitality', element: 'wood', requires: ['wood'], costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }] },
    // Stillness (Water): the other half of the Flow/Stillness exclusivity.
    { key: 'stillness', name: 'Stillness', element: 'water', requires: ['water'], costs: [600, 2000], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] },
    // Death (Fire): the yin half of Fire's life/death pair.
    { key: 'death', name: 'Death', element: 'fire', requires: ['fire'], costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }] },
    { key: 'endurance', name: 'Endurance', element: 'earth', requires: ['earth'], costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }] },
  ],
  conflicts: [['flow', 'stillness']],
}

// ---- Convenience lookups ---------------------------------------------------

export function findLatticeNode(key: LatticeNodeKey): LatticeNodeRow {
  const row = LATTICE_DATA.nodes.find((n) => n.key === key)
  if (!row) throw new Error(`Unknown lattice node key: ${key}`)
  return row
}

/** All root nodes (requires = []). */
export function latticeRoots(): readonly LatticeNodeRow[] {
  return LATTICE_DATA.nodes.filter((n) => n.requires.length === 0)
}
