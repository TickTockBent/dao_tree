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
//     realm: [id, "Stage Label"]         named stage label, NOT a numeric token (§5a)
//     meridians: N                       primary meridians opened >= N
//     temperTier: "name"                 temper tier reached
//     qi: N                              Qi gathered >= N
//     primaryMeridiansAll: true          all primary meridians opened
//     anyDaoNode: N                      ANY lattice node owned at tier >= N (slice 4)
//     daoElementTier: [element, N]       ANY node of named element owned at tier >= N (slice 4)
//   Hint-only keys (evaluated by the hint engine directly):
//     layerUnlocked: "id"                player[id].unlocked === true
//     coreForged: true                   a core has been forged (stored grade index >= 0)
//     coreBelowCeiling: true             forged core is below its Foundation ceiling
//     aspectUnchosen: true               n layer unlocked AND player.b.soulAspect === ""
//                                        (evaluated via soulAspectRow() factory accessor)
//     sectUnjoined: true                 sect layer revealed AND archetype not chosen
//                                        (evaluated via !sectJoined() factory accessor; slice 5)
//
// Stage labels must exactly match js/data/realms.js substage labels — a mismatch
// produces a nonsensical condition (the engine falls back to the catch-all) and
// will surface as a lint warning when hint-condition checking is wired in §8.5.

var HINT_DATA = {
    hints: [
        {
            // Row 2 (slice 4): NS layer is unlocked but the Soul Aspect has not yet been
            // chosen. Fires immediately after the first NS prestige and persists until the
            // player picks an aspect (the choice is once-per-life, §5 table NS row). Sits
            // ABOVE all core rows because NS states are later-game than core states; once
            // the aspect is chosen this row no longer matches and the normal cascade resumes.
            key: "chooseAspect",
            when: { layerUnlocked: "n", aspectUnchosen: true },
            text: "Your nascent soul stirs within the Golden Core, formless and eager — choose its aspect and give it a face."
        },
        {
            // Row 3 (slice 4): player has reached the first NS substage (Early Nascent Soul,
            // n.best >= 1) but aspect is already chosen (or this fires after chooseAspect
            // is cleared). Guides the player deeper into the NS arc toward Soul Formation.
            // Sits directly below chooseAspect; shadows coreComplete once NS progression
            // begins (the coreForged condition in coreComplete is no longer the frontier
            // at this stage). The label "Early Nascent Soul" must exactly match the first
            // substage of REALM_DATA n.substages (pinned schema, §11 slice 4 contract).
            key: "climbNascent",
            when: { realm: ["n", "Early Nascent Soul"] },
            text: "Deepen the soul — each sub-stage of the Nascent Soul refines it toward the Soul Formation gate at the mountain's edge."
        },
        {
            // Row 3: core is forged but hasn't reached its Foundation ceiling yet.
            // Player should be warming it via the refinement loop (§7b).
            key: "warmCore",
            when: { coreForged: true, coreBelowCeiling: true },
            text: "Warm your core — each full bar raises its grade one tier toward the Foundation ceiling."
        },
        {
            // Row 4: core is forged and AT its ceiling — the player's Golden Core is as
            // good as their Foundation allows. Tease the next horizon.
            //
            // Window analysis / handoff: this row matches when coreForged && !coreBelowCeiling.
            // n is REVEALED at c.best >= 1 ("Core Forged" substage, pinned reveal gate in
            // realms.js n row), and UNLOCKED at c.best >= 2 ("Core Refined"). So this row
            // fires only in the window before n is unlocked and the player has made their
            // first NS prestige: once n.best >= 1 (Early Nascent Soul), the climbNascent row
            // above matches first and shadows this one cleanly. The text remains accurate as
            // a tease because n IS on the horizon during the Core Formation stretch — the
            // wording does not contradict the NS rows because those rows only fire later.
            key: "coreComplete",
            when: { coreForged: true },
            text: "Your Golden Core is complete — refine Core Formation toward Core Refined to unlock the Nascent Soul."
        },
        {
            // Row 5: Core Formation is unlocked — bank Foundation fuel and pick a push.
            // Player has the layer but hasn't forged yet.
            key: "chooseForge",
            when: { layerUnlocked: "c" },
            text: "Bank Foundation fuel and choose your forge push — push harder for a finer core, but risk a crack."
        },
        {
            // Row 6: player is in Foundation. Guide them toward Great Circle and the
            // Tendon temper tier that gates Core Formation (§5b).
            key: "climbFoundation",
            when: { realm: ["f", "Early Foundation"] },
            text: "Climb Foundation toward Great Circle; temper to Tendon — that opens Core Formation."
        },
        {
            // Row 7: player has reached 6th Level (Foundation is now revealed). Guide
            // them to open 4 meridians and break through.
            key: "breakToFoundation",
            when: { realm: ["q", "6th Level"] },
            text: "Open 4 meridians and break through to Foundation Establishment."
        },
        {
            // Row 8: Dao Lattice is revealed at 4th Level (§4.2) and the player has not
            // yet been guided by a more-specific row above. This row surfaces in the
            // 4th-Level-to-5th-Level window: breakToFoundation (6th Level) and
            // climbFoundation (Foundation layer) shadow it once those thresholds are met,
            // while rows 1-5 require states (NS unlocked, core forged, c/f unlocked) that
            // do not exist at 4th Level. The realm gate rather than layerUnlocked:"dao" is
            // used because the lattice's reveal latch in the factory is the authoritative
            // state — the realm threshold proxy is safe and grammar-compatible (§8.5).
            key: "openLattice",
            when: { realm: ["q", "4th Level"] },
            text: "The Dao Lattice has revealed itself — explore it with Insight and claim your first Glimpse."
        },
        {
            // Row 9 (slice 4): the anyDaoNode:1 condition fires once the player owns at
            // least one lattice node at Glimpse tier. This nudges them toward Breathing
            // Trance (qi down, Insight up) so they discover the stance grammar early.
            // Visibility window: this row is live from first Glimpse onward; it is shadowed
            // by openLattice (fires from 4th Level before any Glimpse) and by the Foundation/
            // Core rows (fire once f is unlocked / core is forged), so its actual visible
            // window is: first Glimpse acquired while still in Qi Condensation below 6th
            // Level and before Core Formation is unlocked. It resurfaces transiently in any
            // later state where all higher-priority hints are inactive (e.g. a very early
            // NS run where the core has been forgotten).
            key: "enterTrance",
            when: { anyDaoNode: 1 },
            text: "Enter Breathing Trance to trade some Qi speed for faster Insight — the lattice grows quicker in stillness."
        },
        {
            // Slice 5: sect revealed (q 2nd Level) but no archetype chosen. Joining is
            // OPTIONAL, so this row must never pin the cascade: it sits near the BOTTOM,
            // above only climbQi/gatherQi, so it surfaces in the early window (q 2nd ->
            // 4th Level) where nothing later matches, then openLattice / breakToFoundation
            // / the core and NS rows shadow it for a player who chooses not to join.
            // The grammar has no negation, so the hint-only key sectUnjoined (hintEngine:
            // sectIsRevealed() && !sectJoined()) carries the "revealed but unjoined" state.
            key: "joinSect",
            when: { sectUnjoined: true },
            text: "A sect has taken notice of your progress — visit the Sect tab and choose your path. The choice shapes your techniques and your Dao."
        },
        {
            // Row 10: Qi Condensation is unlocked but player hasn't hit 4th Level yet
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
