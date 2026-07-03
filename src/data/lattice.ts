// src/data/lattice.ts — single source of truth for the Dao lattice (design §4.2/§8.7).
//
// Port of js/data/lattice.js. The Dao lattice is the second grammar of the
// game: a comprehension graph that NEVER resets within a life — it is
// LIFE-scoped, sitting outside every realm tree. Its currency is Insight, which
// trickles passively once the lattice is revealed mid-Qi-Condensation.
//
// Slice-3 "smallest honest version" shipped Glimpse/Seed tiers only, EXACTLY
// 15 nodes (five elemental roots + two ring-2 derived concepts per element).
//
// Slice 9 (D22, "medium lattice") adds the Manifestation tier — a THIRD
// cost/effect entry on every node, positional over `tiers` — plus 10 new
// ring-3 nodes (one successor per existing ring-2/ring-2b node), for 25 total.
// Manifestation is Act II's severable-grade power (docs/slice-9.md §4); the
// flow/stillness `conflicts` pair, declared since slice 3, BINDS here: the
// dao store refuses a Manifestation purchase that would put both conflicting
// nodes at tier 3 simultaneously (data-driven off `conflicts`, no hardcoded
// keys in the store). Buying ANY node's Manifestation tier — and ANY tier of
// a ring-3 node, since ring-3 is whole-cloth Act II content — additionally
// requires the passed tribulation, enforced in the store's buy path (not
// pricing alone) so Act I's pinned pacing bands cannot move because of it.
// Laws are Act III realm content, not lattice nodes (D22).

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
  /**
   * [glimpseCost, seedCost, manifestationCost] in Insight; positional over
   * `tiers`. Ascending per node. The Manifestation entry is Act-II-scale
   * ⟨tune⟩ — reachability is gated by tribulationPassed in the store, not by
   * price, so its exact value cannot move Act I's pinned pacing bands.
   */
  readonly costs: readonly number[]
  /** One effect object per tier (positional over `tiers`: glimpse, seed, manifestation). */
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
    { key: 'manifestation', label: 'Manifestation' },
  ],
  nodes: [
    // --- Roots (the Five Elements, matching spiritual roots §4.2/§7.1) ---
    // Manifestation cost/effect (3rd entry) is Act-II-scale ⟨tune⟩ — the
    // store gates reachability on tribulationPassed, not this number.
    { key: 'metal', name: 'Metal Root', element: 'metal', requires: [], costs: [100, 300, 3000], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }, { qiMult: 1.12 }] },
    { key: 'wood', name: 'Wood Root', element: 'wood', requires: [], costs: [100, 300, 3000], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }, { qiMult: 1.12 }] },
    { key: 'water', name: 'Water Root', element: 'water', requires: [], costs: [100, 300, 3000], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }, { qiMult: 1.12 }] },
    { key: 'fire', name: 'Fire Root', element: 'fire', requires: [], costs: [100, 300, 3000], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }, { qiMult: 1.12 }] },
    { key: 'earth', name: 'Earth Root', element: 'earth', requires: [], costs: [100, 300, 3000], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }, { qiMult: 1.12 }] },
    // --- Ring 2 (first derived concept per element; requires its root) ---
    // Sword (Metal): the §4.2 sword line; insight-leaning (gates Sword Trance).
    { key: 'sword', name: 'Sword Intent', element: 'metal', requires: ['metal'], costs: [250, 800, 7500], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }, { insightMult: 1.15 }] },
    { key: 'growth', name: 'Growth', element: 'wood', requires: ['wood'], costs: [250, 800, 7500], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }, { qiMult: 1.15 }] },
    // Flow (Water): half of the Flow/Stillness tension pair; insight-leaning.
    // The pair's Manifestation-tier EXCLUSIVITY (declared in `conflicts` since
    // slice 3) binds here: dao.ts refuses the purchase that would put both
    // flow and stillness at tier 3 simultaneously.
    { key: 'flow', name: 'Flow', element: 'water', requires: ['water'], costs: [250, 800, 7500], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }, { insightMult: 1.15 }] },
    // Life (Fire): the yang half of Fire's life/death yin-yang pair; qi-leaning.
    { key: 'life', name: 'Life', element: 'fire', requires: ['fire'], costs: [250, 800, 7500], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }, { qiMult: 1.15 }] },
    { key: 'mountain', name: 'Mountain', element: 'earth', requires: ['earth'], costs: [250, 800, 7500], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }, { qiMult: 1.15 }] },
    // --- Ring 2b (deeper/sharper aspect per element; still requires only root) ---
    { key: 'edge', name: 'Cutting Edge', element: 'metal', requires: ['metal'], costs: [600, 2000, 17500], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }, { insightMult: 1.18 }] },
    { key: 'vitality', name: 'Vitality', element: 'wood', requires: ['wood'], costs: [600, 2000, 17500], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }, { qiMult: 1.18 }] },
    // Stillness (Water): the other half of the Flow/Stillness exclusivity.
    { key: 'stillness', name: 'Stillness', element: 'water', requires: ['water'], costs: [600, 2000, 17500], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }, { insightMult: 1.18 }] },
    // Death (Fire): the yin half of Fire's life/death pair.
    { key: 'death', name: 'Death', element: 'fire', requires: ['fire'], costs: [600, 2000, 17500], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }, { qiMult: 1.18 }] },
    { key: 'endurance', name: 'Endurance', element: 'earth', requires: ['earth'], costs: [600, 2000, 17500], effects: [{ qiMult: 1.05 }, { qiMult: 1.1 }, { qiMult: 1.18 }] },
    // --- Ring 3 (slice 9 / D22): one successor per ring-2 node. Whole-cloth
    // Act II content — dao.ts gates EVERY tier of a ring-3 node behind the
    // passed tribulation (not just Manifestation), because an unbounded
    // cheapest-first buyer (the Realistic sim actor — unlike Competent's
    // capped 8-Seed target) would otherwise afford these from banked Insight
    // alone well inside Act I and move the pinned pacing bands. Costs still
    // sit above every existing node's cheapest tier as a second line of
    // defense. ⟨tune⟩ throughout.
    { key: 'severingIntent', name: 'Severing Intent', element: 'metal', requires: ['sword'], costs: [1500, 5000, 25000], effects: [{ insightMult: 1.05 }, { insightMult: 1.11 }, { insightMult: 1.2 }] },
    { key: 'blossoming', name: 'Blossoming', element: 'wood', requires: ['growth'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
    // River of Time (Water, from Flow): the Time-adjacent continuation of the sword/flow exemplar chains.
    { key: 'riverOfTime', name: 'River of Time', element: 'water', requires: ['flow'], costs: [1500, 5000, 25000], effects: [{ insightMult: 1.05 }, { insightMult: 1.11 }, { insightMult: 1.2 }] },
    { key: 'undying', name: 'Undying', element: 'fire', requires: ['life'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
    { key: 'unmovable', name: 'Unmovable', element: 'earth', requires: ['mountain'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
    // --- Ring 3 (slice 9 / D22): one successor per ring-2b node ---
    { key: 'soulBlade', name: 'Soul Blade', element: 'metal', requires: ['edge'], costs: [1500, 5000, 25000], effects: [{ insightMult: 1.05 }, { insightMult: 1.11 }, { insightMult: 1.2 }] },
    { key: 'evergreen', name: 'Evergreen', element: 'wood', requires: ['vitality'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
    { key: 'eternalStillness', name: 'Eternal Stillness', element: 'water', requires: ['stillness'], costs: [1500, 5000, 25000], effects: [{ insightMult: 1.05 }, { insightMult: 1.11 }, { insightMult: 1.2 }] },
    // Rebirth (Fire, from Death): the other half of the Life/Death tension carried into ring 3.
    { key: 'rebirth', name: 'Rebirth', element: 'fire', requires: ['death'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
    { key: 'boundless', name: 'Boundless', element: 'earth', requires: ['endurance'], costs: [1500, 5000, 25000], effects: [{ qiMult: 1.06 }, { qiMult: 1.12 }, { qiMult: 1.22 }] },
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
