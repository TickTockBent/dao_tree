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
        { id: "act1", name: "Act I: The Mortal Road" }
    ],
    // EVERY layer the factory registers MUST appear here (linter-enforced).
    layers: {
        q:    { scope: "tree", tree: "act1" },
        f:    { scope: "tree", tree: "act1" },
        c:    { scope: "tree", tree: "act1" },
        // Nascent Soul (expansion §5): row 3, still Act I. A higher-row tree layer,
        // so its breakthrough cascade resets c/f/q below it — the carried-artifact
        // core GRADE survives on the life-scoped Body layer (progression-map §5), the
        // refinement PROGRESS on c wipes with the realm (one-time forge stays forged
        // via coreIsForged()'s stored grade).
        n:    { scope: "tree", tree: "act1" },
        // Soul Formation (design §5 Act I capstone): row 4, still Act I. The highest Act I tree
        // row, so its breakthrough cascade resets n/c/f/q below it — the carried core grade and
        // the chosen aspect survive on the life-scoped Body layer (the §5 carried-artifact
        // precedent); the tribulation run-state on s SURVIVES s's own prestige (the compiled
        // doReset is a self-no-op at equal row, the standard cascade) — the once-per-life
        // capstone is enforced by the tribulationPassed latch on tribGrade, not by a wipe.
        s:    { scope: "tree", tree: "act1" },
        b:    { scope: "life" },
        gate: { scope: "life" },
        // The Dao lattice (design §4.2): comprehension never resets within a life, so it is
        // LIFE-scoped — a member of no tree, untouched by any realm breakthrough cascade.
        // Reincarnation persistence (Glimpses free, Seeds via memory fragments) is a future slice.
        dao:  { scope: "life" },
        // The Sect side-spine (design §4.3 "horizontal standing", slice 5): Contribution,
        // the technique library (player.sect.upgrades), and the chosen archetype all survive
        // every realm breakthrough — LIFE-scoped, a member of no tree. (World-rank re-pricing
        // of the arsenal across a reincarnation, §4.3, is a future slice.)
        sect: { scope: "life" },
        // The Journal (design §1.6 / §8.1): the FIRST eternal-scoped layer. Narrative entries
        // latch into player.journal.unlocked and survive even reincarnation — journals and
        // meta-achievements are the ETERNAL record (§8.1). It is a member of no tree, never
        // touched by any reset; the persistence-scope linter already validates eternal entries.
        journal: { scope: "eternal" },
        // The Legacy store (design §8.1 "Legacy Grades are eternal"; slice 6): the Act I Legacy
        // Grade is computed once on the first tribulation pass and stored eternal-scope — it
        // survives even reincarnation (Samsara reads it to seed the next life, slice 10). A member
        // of no tree, never touched by any reset; the persistence-scope linter validates it like
        // the journal (the other eternal layer).
        legacy: { scope: "eternal" }
    }
};
