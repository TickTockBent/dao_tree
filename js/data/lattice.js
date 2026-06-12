// js/data/lattice.js — single source of truth for the Dao lattice (design §4.2/§8.7)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (makeDaoLayer,
// the daoNode* multiplier readers) the same way REALM_DATA/BODY_DATA are. The Dao
// lattice is the second grammar of the game (design §4.2): a comprehension tree that
// NEVER resets within a life — it is LIFE-scoped (trees.js dao entry), sitting outside
// every realm tree, untouched by a breakthrough cascade. Its currency is Insight, which
// trickles passively once the lattice is revealed mid-Qi-Condensation (§4.2/§3.1 table:
// "first Stance" appears in Qi Condensation). Reincarnation persistence (Glimpses free,
// Seeds via memory-fragment purchase, §4.2) is a FUTURE slice — life-scope is enough now.
//
// This is the slice-3 "smallest honest version" (§11 slice 3): Glimpse/Seed tiers only,
// EXACTLY 15 nodes (five elemental roots + two ring-2 derived concepts per element).
// Manifestation/Law tiers and the conflict EXCLUSIVITY they bind (§4.2 "can't manifest
// both Stillness and Flow") are declared now as `conflicts` but bind at the Manifestation
// tier in Act II (schema-now-content-later, Q5 doctrine) — present so the graph shape is
// fixed and the names foreshadow the §4.2 tension pairs (Fire's life/death yin-yang pair;
// Water Flow vs the earth-adjacent Stillness).
//
// LATTICE_DATA shape (consumed by makeDaoLayer):
//   id/name/symbol/color  display fields; id is the TMT layer id ("dao")
//   unlock     object   meets()-style reveal condition (§5a grammar). Once met the
//                       lattice latches revealed and stays shown (§4.2 never resets).
//   insight    object   { resource, baseRate } — Insight currency name + passive
//                       trickle/sec accrued only AFTER reveal (no pre-unlock banking).
//   tiers      array    ordered tier rows { key, label }; index = tier ordinal. A node's
//                       costs[]/effects[] are positional over this array (Glimpse, Seed).
//   nodes      array    EXACTLY 15 node rows (see node row shape below).
//   conflicts  array    pairs of node keys that are mutually exclusive at depth (§4.2).
//                       Declared now, BINDS at Manifestation (Act II); inert at Glimpse/Seed.
//
// Node row shape (consumed by makeDaoLayer buyables + daoNode* readers):
//   key        string   semantic node key (referenced by requires/conflicts + meets daoNode)
//   buyableId  number   TMT buyable id; the tens digit is the tab ROW (1x roots, 2x/3x rings)
//   name       string   display name
//   element    string   one of the five roots' keys (metal/wood/water/fire/earth)
//   requires   array    node keys that must own tier >= 1 (Glimpse) before this unlocks.
//                       Roots require nothing []; each ring-2 node requires exactly its root.
//   costs      array    [glimpseCost, seedCost] in Insight; positional over tiers. Ascending
//                       per node (seed > glimpse) and deeper rings cost more (see pacing notes).
//   effects    array    one effect object per tier: { qiMult } or { insightMult }, value >= 1.
//                       Nodes are pure BONUSES (every value >= 1); Glimpse effects are small
//                       (~1.02-1.04), Seed effects larger (~1.05-1.10). qiMult folds into
//                       cultivationQiPerSecond via daoNodeQiMult(); insightMult compounds the
//                       Insight trickle via daoNodeInsightMult() (no dead mult §9.2).
//
// PACING INTENT (§11 slice 3, stated here because the numbers live here):
//   - unlock at q 4th Level: q.best>=20 (realms.js substage "4th Level" at:20), which the
//     pacing spine reaches ~10-20 min into a fresh run — the lattice opens mid-Qi-Condensation
//     as the design table prescribes ("first Stance" in Qi Condensation).
//   - baseRate 0.5 Insight/sec: on trickle alone the cheapest Glimpse (cost 100) is affordable
//     in ~200s (~3-4 min) of reveal, matching "first Glimpse within ~3-5 min on trickle alone".
//   - root Glimpse 100 / Seed 300; ring-2 Glimpse 250 / Seed 800; ring-2b Glimpse 600 /
//     Seed 2000. Deeper rings cost more (gating depth), and all 15 Seeds (sum ~16k Insight)
//     is a LONG background arc — hours at 0.5/sec base, faster as insightMult nodes compound.

var LATTICE_DATA = {
    id: "dao",
    name: "Dao Lattice",
    symbol: "道",                       // the Dao glyph; the implementer's chosen display symbol
    color: "#8a6fd8",
    // §5a reveal grammar (named stage label, never a numeric token — the realms.js
    // standard): the lattice reveals at Qi Condensation 4th Level, mid-Act-I (§4.2).
    unlock: { realm: ["q", "4th Level"] },
    // Insight trickles passively once revealed (§4.2). 0.5/sec base makes the cheapest
    // root Glimpse (100) affordable ~3-4 min after reveal on trickle alone (pacing intent).
    insight: { resource: "Insight", baseRate: 0.5 },
    // Glimpse → Seed (slice 3 stops here; Manifestation/Law are Act II, §4.2).
    tiers: [
        { key: "glimpse", label: "Glimpse" },
        { key: "seed",    label: "Seed" }
    ],
    nodes: [
        // --- Roots (ids 11-15, tab row 1): the Five Elements, matching spiritual roots
        // (§4.2/§7.1). Require nothing — the lattice's entry points. Each gives a small
        // Qi Glimpse and a larger Qi Seed (the broad, cheap base of the lattice, §4.2).
        { key: "metal", buyableId: 11, name: "Metal Root", element: "metal", requires: [],
          costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "wood",  buyableId: 12, name: "Wood Root",  element: "wood",  requires: [],
          costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "water", buyableId: 13, name: "Water Root", element: "water", requires: [],
          costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "fire",  buyableId: 14, name: "Fire Root",  element: "fire",  requires: [],
          costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "earth", buyableId: 15, name: "Earth Root", element: "earth", requires: [],
          costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },

        // --- Ring 2 (ids 21-25, tab row 2): first derived concept per element (§4.2:
        // Metal→Sword, Water→Flow, Fire→Life). Each requires its own root. A mix of
        // qiMult and insightMult so the lattice teaches its two currencies early.
        // Sword (Metal): the §4.2 Metal→Sword→Severing line; insight-leaning (the
        // sword path is an Insight engine in the design, and gates Sword Trance).
        { key: "sword",    buyableId: 21, name: "Sword Intent",      element: "metal", requires: ["metal"],
          costs: [250, 800], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
        // Growth (Wood): vitality of the living world — Qi-leaning.
        { key: "growth",   buyableId: 22, name: "Growth",            element: "wood",  requires: ["wood"],
          costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },
        // Flow (Water): the §4.2 Water→Flow→Time line; one half of the Flow/Stillness
        // tension pair (conflicts below). Insight-leaning.
        { key: "flow",     buyableId: 23, name: "Flow",              element: "water", requires: ["water"],
          costs: [250, 800], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
        // Life (Fire): the yang half of Fire's life/death yin-yang pair (§4.2 "walked in
        // tension"). Qi-leaning (life feeds the body's gathering).
        { key: "life",     buyableId: 24, name: "Life",              element: "fire",  requires: ["fire"],
          costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },
        // Mountain (Earth): immovable foundation — Qi-leaning.
        { key: "mountain", buyableId: 25, name: "Mountain",          element: "earth", requires: ["earth"],
          costs: [250, 800], effects: [{ qiMult: 1.04 }, { qiMult: 1.08 }] },

        // --- Ring 2b (ids 31-35, tab row 3): second derived concept per element, the
        // deeper/sharper aspect. Still requires only its root (slice 3 keeps the graph
        // shallow); costs more than ring 2 to gate depth. Edge/Stillness/Death foreshadow
        // the §4.2 tension lines (Severing, Stillness-vs-Flow, the death half of the pair).
        // Edge (Metal): the sharpened sword, toward Severing (§4.2). Insight-leaning.
        { key: "edge",      buyableId: 31, name: "Cutting Edge",     element: "metal", requires: ["metal"],
          costs: [600, 2000], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] },
        // Vitality (Wood): deep life force — Qi-leaning.
        { key: "vitality",  buyableId: 32, name: "Vitality",         element: "wood",  requires: ["wood"],
          costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.10 }] },
        // Stillness (Water): the OTHER half of the Flow/Stillness exclusivity (§4.2);
        // earth-adjacent calm opposed to Water's Flow. Insight-leaning.
        { key: "stillness", buyableId: 33, name: "Stillness",        element: "water", requires: ["water"],
          costs: [600, 2000], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] },
        // Death (Fire): the yin half of Fire's life/death pair (§4.2). Qi-leaning, but the
        // pairing with Life foreshadows the manifestation-tier tension.
        { key: "death",     buyableId: 34, name: "Death",            element: "fire",  requires: ["fire"],
          costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.10 }] },
        // Endurance (Earth): the unbreakable body — Qi-leaning.
        { key: "endurance", buyableId: 35, name: "Endurance",        element: "earth", requires: ["earth"],
          costs: [600, 2000], effects: [{ qiMult: 1.05 }, { qiMult: 1.10 }] }
    ],
    // Exclusivity (§4.2): Flow and Stillness cannot both be MANIFESTED. Declared now so the
    // graph shape is fixed; BINDS at the Manifestation tier in Act II (this slice ships only
    // Glimpse/Seed, where it is inert — schema-now-content-later, Q5 doctrine).
    conflicts: [
        ["flow", "stillness"]
    ]
};
