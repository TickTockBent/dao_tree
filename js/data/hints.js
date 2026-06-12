// js/data/hints.js — guidance cascade for the hint bar (design doc §1.5)
//
// Plain-JS global, no ES export. Consumed by js/build/hintEngine.js which
// walks the rows top-down and returns the FIRST MATCH. First match wins, so
// later-game states must sit above earlier-game states. The final row MUST be
// unconditional (always: true) to satisfy the lint assertion (§1.5/§8.5).
//
// Row shapes:
//   { key, when: { ... }, text }   — conditional row; "when" keys are ANDed.
//   { key, always: true, text }    — unconditional catch-all; must be last.
//
// "when" grammar:
//   Factory meets() keys (evaluated by the hint engine via meets()):
//     realm: [id, "Stage Label"]   named stage label, NOT a numeric token (§5a)
//     meridians: N                 primary meridians opened >= N
//     temperTier: "name"           temper tier reached
//     qi: N                        Qi gathered >= N
//     primaryMeridiansAll: true    all primary meridians opened
//   Hint-only keys (evaluated by the hint engine directly):
//     layerUnlocked: "id"          player[id].unlocked === true
//     coreForged: true             a core has been forged (stored grade index >= 0)
//     coreBelowCeiling: true       forged core is below its Foundation ceiling
//
// Stage labels must exactly match js/data/realms.js substage labels — a mismatch
// produces a nonsensical condition (the engine falls back to the catch-all) and
// will surface as a lint warning when hint-condition checking is wired in §8.5.

var HINT_DATA = {
    hints: [
        {
            // Row 1: core is forged but hasn't reached its Foundation ceiling yet.
            // Player should be warming it via the refinement loop (§7b).
            key: "warmCore",
            when: { coreForged: true, coreBelowCeiling: true },
            text: "Warm your core — each full bar raises its grade one tier toward the Foundation ceiling."
        },
        {
            // Row 2: core is forged and AT its ceiling. Tease the road beyond.
            key: "coreComplete",
            when: { coreForged: true },
            text: "Your Golden Core is complete. The Nascent Soul awaits on the horizon."
        },
        {
            // Row 3: Core Formation is unlocked — bank Foundation fuel and pick a push.
            // Player has the layer but hasn't forged yet.
            key: "chooseForge",
            when: { layerUnlocked: "c" },
            text: "Bank Foundation fuel and choose your forge push — push harder for a finer core, but risk a crack."
        },
        {
            // Row 4: player is in Foundation. Guide them toward Great Circle and the
            // Tendon temper tier that gates Core Formation (§5b).
            key: "climbFoundation",
            when: { realm: ["f", "Early Foundation"] },
            text: "Climb Foundation toward Great Circle; temper to Tendon — that opens Core Formation."
        },
        {
            // Row 5: player has reached 6th Level (Foundation is now revealed). Guide
            // them to open 4 meridians and break through.
            key: "breakToFoundation",
            when: { realm: ["q", "6th Level"] },
            text: "Open 4 meridians and break through to Foundation Establishment."
        },
        {
            // Row 6: Dao Lattice is revealed at 4th Level (§4.2) and the player
            // has not yet been guided by a more-specific row above. This row sits
            // BELOW breakToFoundation/climbFoundation so it only surfaces in the
            // 4th-Level-to-5th-Level window: breakToFoundation (6th Level) and
            // climbFoundation (Foundation layer) shadow it once those thresholds
            // are met, while rows 1–4 require states (core forged, c/f unlocked)
            // that do not yet exist at 4th Level. The realm gate rather than
            // layerUnlocked:"dao" is used because the "dao" layer is registered by
            // js/data/lattice.js (landing this slice concurrently); relying on the
            // realm threshold is safe and grammar-compatible today (§8.5). There is
            // no OR in the meets() grammar, so no "any node owned" universal signal
            // exists for the enterTrance row — that row is intentionally omitted
            // (see concerns: enterTrance cannot be expressed without contorting data).
            key: "openLattice",
            when: { realm: ["q", "4th Level"] },
            text: "The Dao Lattice has revealed itself — explore it with Insight and claim your first Glimpse."
        },
        {
            // Row 7: Qi Condensation is unlocked but player hasn't hit 4th Level yet
            // (and no higher-priority hint matched).
            key: "climbQi",
            when: { layerUnlocked: "q" },
            text: "Climb the Qi Condensation levels and open your meridians — they never reset."
        },
        {
            // Catch-all — mandatory unconditional last row (§1.5 lint-enforced).
            // Reached only when no prior row matches (fresh save, Qi layer not yet unlocked).
            key: "gatherQi",
            always: true,
            text: "Gather Qi until you can condense it — the first step on the cultivator's road."
        }
    ]
};
