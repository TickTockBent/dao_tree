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
    // Display renamed to "Deeds" (slice 5): the gate layer is the CHECKPOINT RECORD — the
    // deeds the world recognizes (Outer/Inner Disciple, tournaments, promotions). The sect
    // IDENTITY (which sect, its techniques, its contribution) now lives on the dedicated
    // `sect` layer (sect.js). The id "gate" and the achievement ids are UNCHANGED — hints,
    // unlock conditions, and the smoke harness reference them by id (§8.5/§5a), so only the
    // human-facing display name moves.
    name: "Deeds",
    symbol: "事",                          // the "deed/affair" glyph
    color: "#9a8fd8",

    achievements: [
        {
            id: 11,
            key: "outerDisciple",
            kind: "checkpoint",
            name: "Outer Disciple",
            // done = JOINED a sect AND reached Foundation (any grade) AND meridians >= 6 AND
            // temper tier >= Flesh (§8). Outer Disciple is a SECT RANK: you cannot hold it
            // without a sect, so it gates on sectJoined (the Inner Disciple precedent, id 12).
            // A no-sect (spineOnly) cultivator never earns this rank or its stipend. "Early
            // Foundation" (at:1) is the any-grade reached marker (named stage label, §5a).
            done: { sectJoined: true, realm: ["f", "Early Foundation"], meridians: 6, temperTier: "Flesh" },
            // +25% Qi/sec sect stipend (§8). Reads nothing it suppresses.
            effect: { qiMult: 1.25 },
            gates: null
        },
        {
            // Inner Disciple (slice 5): the next sect rank as a checkpoint (progression-map §3
            // "sect ranks as checkpoints"). Earned by JOINING a sect, building real standing
            // (contribution high-water), and forging a core. done() combines the new sectJoined
            // meets() key with a contribution-best floor and a realm gate.
            id: 12,
            key: "innerDisciple",
            kind: "checkpoint",
            name: "Inner Disciple",
            // sectJoined: true -> sectJoined() ; contribution best >= 1000 (mid-game standing,
            // past the stipend milestone at 250, below the library at 4000) ; realm c Core Forged.
            // Named stage label, not numeric (§5a). All three combine with AND.
            done: { sectJoined: true, contribution: 1000, realm: ["c", "Core Forged"] },
            // +30% Qi/sec — a permanent boon for the rank, larger than Outer Disciple's +25%
            // (a deeper checkpoint). Folds into gateMult() exactly like Outer Disciple. ⟨tune⟩
            effect: { qiMult: 1.30 },
            gates: null
        }
    ]
};
