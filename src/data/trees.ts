// src/data/trees.ts — persistence-scope + tree-membership registry (design §8.1, §1.1).
//
// Port of js/data/trees.js. ONE table replaces ~20 scattered per-layer reset
// guards: tree membership and reset scope are declared as data, compiled by
// engine/doReset.ts, and the linter proves no tree's reset closure leaks into a
// life/eternal layer.
//
// Every registered system/layer MUST appear in `layers` with a scope; the
// engine hard-fails (defense in depth ahead of the linter) if it encounters a
// layer with no entry here.

import type { LayerId, Scope, TreeId } from '@/engine/types'

export interface TreeRow {
  readonly id: TreeId
  readonly name: string
}

export interface LayerScopeEntry {
  /** "tree" | "life" | "eternal". */
  readonly scope: Scope
  /** Required iff scope === "tree"; references trees[].id. Forbidden for life/eternal. */
  readonly tree?: TreeId
}

export interface TreeData {
  readonly trees: readonly TreeRow[]
  /** Every registered layer id → its scope entry. */
  readonly layers: Readonly<Record<LayerId, LayerScopeEntry>>
}

export const TREE_DATA: TreeData = {
  trees: [
    { id: 'act1', name: 'Act I: The Mortal Road' },
    // Slice 9: Act II opens with Spirit Severing. A separate tree means the
    // doReset cascade can NEVER cross the act boundary in either direction
    // (same-tree guard in engine/doReset.ts) — Act I state survives Act II
    // resets topologically, not by keep-rule exception.
    { id: 'act2', name: 'Act II: Severing the Mortal' },
  ],
  layers: {
    q: { scope: 'tree', tree: 'act1' },
    f: { scope: 'tree', tree: 'act1' },
    c: { scope: 'tree', tree: 'act1' },
    n: { scope: 'tree', tree: 'act1' },
    s: { scope: 'tree', tree: 'act1' },
    x: { scope: 'tree', tree: 'act2' },
    b: { scope: 'life' },
    gate: { scope: 'life' },
    dao: { scope: 'life' },
    sect: { scope: 'life' },
    journal: { scope: 'eternal' },
    legacy: { scope: 'eternal' },
    // Slice 7: both survive every realm breakthrough (life-scoped, members of no
    // tree). The secret-realm EXPEDITION run-state additionally resets on
    // expedition entry — a LOCAL scope handled inside the store, deliberately
    // outside this registry (design §6.4: nothing outside the expedition resets).
    secret: { scope: 'life' },
    alchemy: { scope: 'life' },
    // Slice 8: corruption + Dao Heart stacks survive realm breakthroughs
    // (the permanent anti-rush tension, §7.4). Samsara carry is a slice-10
    // decision — eternal promotion recorded as an open question there.
    demons: { scope: 'life' },
    // Slice 8.5: Deep Meditation rungs are ETERNAL — QoL is never clawed back,
    // not by cascade and (design intent) not by reincarnation. The soul
    // learned to cultivate unattended; a new body does not unlearn it.
    seclusion: { scope: 'eternal' },
    // Slice 9: soul-scoped accumulators (ascent counter + severance ritual,
    // D21/D23/D25). 'eternal' here is the pre-Samsara encoding of the SOUL
    // accumulator scope (docs/architecture.md) — slice 10's differentiation
    // audit (open-questions Q6) assigns it explicitly.
    soul: { scope: 'eternal' },
    // Slice 9: active severances are LIFE-scoped — severed things return next
    // life (D23). The severance HISTORY (three-lives transcendence, D24)
    // lives on the soul slice, not here.
    severing: { scope: 'life' },
  },
}
