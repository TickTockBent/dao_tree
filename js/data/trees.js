// js/data/trees.js — persistence-scope + tree-membership table (design §8.1, §1.1)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js to compile
// each layer's doReset, and by js/build/linter.js to prove no tree's reset closure
// leaks into a life/eternal layer. ONE table replaces the reference's ~20 scattered
// per-layer reset guards: tree membership and reset scope are declared as data, not
// hand-rolled guard code (design §1.1).
//
// Persistence scopes (design §8.1):
//   "tree"    — reset by its act's mega-prestige AND by the intra-tree row cascade
//               (a higher-row tree layer prestiging resets lower-row tree layers in
//               the SAME tree). Requires a `tree` field referencing trees[].id.
//   "life"    — survives every act transition; resets only at reincarnation (a future
//               slice). The Body layer (meridians, temper, stored grades) and the
//               checkpoint story-gate layer are life-scoped, so they sit OUTSIDE
//               every tree and are never touched by a realm breakthrough. No `tree`.
//   "eternal" — survives reincarnation (a future slice). None in v0.1.
//
// TREE_DATA shape (consumed by the factory + linter):
//   trees   array   the acts; each { id, name }.
//   layers  object  EVERY layer the factory registers MUST appear here as
//                   layers[layerId] = { scope, tree? }:
//                     scope  string  "tree" | "life" | "eternal"
//                     tree   string  required iff scope === "tree"; references
//                                    trees[].id. Forbidden for life/eternal.
//                   The factory hard-fails (defense in depth ahead of the linter) if
//                   it registers a layer with no entry here.

var TREE_DATA = {
    trees: [
        { id: "act1", name: "Act I — Mortal Road" }
    ],
    // EVERY layer the factory registers MUST appear here (linter-enforced).
    layers: {
        q:    { scope: "tree", tree: "act1" },
        f:    { scope: "tree", tree: "act1" },
        c:    { scope: "tree", tree: "act1" },
        b:    { scope: "life" },
        gate: { scope: "life" },
        // The Dao lattice (design §4.2): comprehension never resets within a life, so it is
        // LIFE-scoped — a member of no tree, untouched by any realm breakthrough cascade.
        // Reincarnation persistence (Glimpses free, Seeds via memory fragments) is a future slice.
        dao:  { scope: "life" }
    }
};
