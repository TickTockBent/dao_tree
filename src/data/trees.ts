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
  trees: [{ id: 'act1', name: 'Act I: The Mortal Road' }],
  layers: {
    q: { scope: 'tree', tree: 'act1' },
    f: { scope: 'tree', tree: 'act1' },
    c: { scope: 'tree', tree: 'act1' },
    n: { scope: 'tree', tree: 'act1' },
    s: { scope: 'tree', tree: 'act1' },
    b: { scope: 'life' },
    gate: { scope: 'life' },
    dao: { scope: 'life' },
    sect: { scope: 'life' },
    journal: { scope: 'eternal' },
    legacy: { scope: 'eternal' },
  },
}
