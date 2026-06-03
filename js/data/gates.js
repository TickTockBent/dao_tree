// js/data/gates.js — single source of truth for story gates (spec §8)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js. Story
// gates are TMT ACHIEVEMENTS (fire-once, read live cross-layer state, grant a
// permanent global buff, reset NOTHING) — never reset-based challenges (§8/§9.1).
// Each carries kind:"checkpoint" so the linter and we distinguish narrative
// gates from optional buffs. Gates live on a row:"side" layer so they never reset.
//
// GATE_DATA shape (consumed by makeGateLayer):
//   id            string  TMT layer id for the gate-achievements layer ("gate")
//   name/symbol/color  display fields
//   achievements  array   achievement rows, each:
//     id          number  TMT achievement id (11, 12 ...)
//     key         string  semantic key
//     kind        string  "checkpoint" (narrative gate) — data category, §8
//     name        string  achievement title
//     done        object  live-state condition (meets()-style, evaluated by the
//                         factory against current player state):
//                           { realm:[id, atOrStage] }  realm reached
//                           { meridians:N }             primary meridians >= N
//                           { temperTier:"name" }       temper tier reached
//                         keys combine with AND.
//     effect      object  permanent global buff granted while held:
//                           { qiMult:N }  multiply Qi/sec by N (§8, +25% = 1.25)
//     gates       object|null  optional hard wall: a later layer's unlock reads
//                         hasAchievement(...) of this gate. null = optional buff
//                         only (no wall). For v0.1 Outer Disciple is a buff, not
//                         a wall (completability §9.3 — gate never suppresses the
//                         resource it requires).

var GATE_DATA = {
    id: "gate",
    name: "Sect Standing",
    symbol: "Sect",
    color: "#9a8fd8",

    achievements: [
        {
            id: 11,
            key: "outerDisciple",
            kind: "checkpoint",
            name: "Outer Disciple",
            // done = reached Foundation (any grade) AND meridians >= 6 AND temper tier >= Flesh (§8).
            done: { realm: ["f", 1], meridians: 6, temperTier: "Flesh" },
            // +25% Qi/sec sect stipend (§8). Reads nothing it suppresses.
            effect: { qiMult: 1.25 },
            gates: null
        }
    ]
};
