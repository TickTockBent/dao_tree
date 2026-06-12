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
            // Row 6: Qi Condensation is unlocked but player hasn't hit 6th Level yet.
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
