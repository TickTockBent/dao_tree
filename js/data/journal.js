// js/data/journal.js — the narrative journal (design §1.6, ETERNAL scope).
//
// Plain-JS global, no ES export. The journal is the game's story-gate flavor
// channel (design §1.6 "journal + roadmap as anticipation engines"). It is the
// first ETERNAL-scoped side layer: entries latch into player.journal.unlocked
// (array of keys) once their `when` condition is met and NEVER re-lock, even
// across reincarnations (§8.1 — journals and achievements are eternal).
//
// JOURNAL_DATA shape (consumed by the journal layer in layerFactory.js when
// the sect slice's factory extension lands):
//   id/name/symbol/color  display fields; id is the TMT layer id ("journal")
//   entries  array        ordered rows, each:
//     key    string       semantic key; stored in player.journal.unlocked
//     when   object       meets()-style condition that latches this entry. Supported
//                         grammar: all standard meets() keys (realm, meridians,
//                         temperTier, qi, anyDaoNode, daoElementTier, daoNode,
//                         primaryMeridiansAll) plus the two new meets() extensions:
//                           achievement: [layerId, achievementId]  hasAchievement
//                           sectJoined: true                       sectJoined()
//                         Entries are evaluated top-down each tick; once `when` is
//                         met the key is pushed to player.journal.unlocked and stays
//                         there (latch — never evaluated again once in).
//     title  string       short title shown in the journal tab
//     text   string       1-3 sentences. Second person, restrained, genre-honest.
//                         No purple overload. The journal is quiet witness, not narrator.
//     bonus  object       OPTIONAL reflection reward (SCAFFOLD; none defined yet). grantJournalBonus
//                         (layerFactory.js) delivers it ONCE, the first time the entry is reflected
//                         on (the Reflect clickable). Supported shape:
//                           { qi: N }                 grant N Qi
//                           { achievement: [id, n] }  grant achievement n on layer id; this is also
//                                                     how an entry "unlocks a gate" (gates are
//                                                     achievements on the "gate" layer)
//                         New bonus types register in BOTH grantJournalBonus (layerFactory.js) AND
//                         checkJournalBonus (linter.js).
//
// STAGE STAMP (scaffold): when an entry latches, the factory records the cultivation stage at that
// moment in player.journal.stage[key] = { realm, substage } (the journal tab shows it, and future
// stage-relative mechanics read it). This is automatic; no per-entry data field.
//
// Ordering: chronological by when a player would unlock them, earliest first.
// The linter (§8.5) validates `when` keys via the shared checkCondition oracle;
// the `achievement` and `sectJoined` keys are hint-engine passthrough additions
// (design §FACTORY SURFACE / §5 slice 5) — handled in hintEngine.js's strip list
// and meets() extension in layerFactory.js when those land.
//
// This is the slice-5 "narrative voice debut" (design §11 slice 5 / §1.6).

var JOURNAL_DATA = {
    id: "journal",
    name: "Journal",
    symbol: "卷",
    color: "#8ab87a",

    entries: [
        {
            // Entry 1: first Qi gathered. The player's very first act on the road.
            // Fires as soon as Qi Condensation opens (q unlocked), which is the
            // earliest possible narrative beat — you have gathered enough qi to
            // condense it the first time.
            key: "firstBreath",
            when: { layerUnlocked: "q" },
            title: "First Breath",
            text: "You draw in the ambient qi and feel it, for the first time, listen. "
                + "It is thin and reluctant, but it moves. That is enough.",
            bonus: { qi: 100 }
        },
        {
            // Entry 2: first meridian opened. A concrete physical milestone.
            key: "firstMeridian",
            when: { meridians: 1 },
            title: "A Channel Opens",
            text: "The first meridian yields after long persistence. "
                + "A cold brightness runs the length of your arm, then settles. "
                + "The body remembers what the mind barely grasps.",
            bonus: { qi: 100 }
        },
        {
            // Entry 3: foundation is reached (any grade). The player has broken
            // through the mortal ceiling for the first time.
            key: "foundationReached",
            when: { realm: ["f", "Early Foundation"] },
            title: "Foundation Laid",
            text: "The Foundation is the first honest reckoning "
                + "with what you are made of. "
                + "What you built these past weeks either holds now, or it doesn't."
        },
        {
            // Entry 4: Outer Disciple earned (gate achievement 11). That gate now itself requires
            // sectJoined (gates.js), so this rank entry only fires for a cultivator who has
            // actually joined a sect, matching the prose (a sect elder recognizing you). Keying
            // off the achievement alone is enough; the sect requirement lives at the gate.
            key: "outerDisciple",
            when: { achievement: ["gate", 11] },
            title: "Outer Disciple",
            text: "A sect elder looks you over, says nothing for a long moment, then nods. "
                + "You are Outer Disciple now, the lowest rung and the first foothold. "
                + "You have been seen."
        },
        {
            // Entry 5: Dao Lattice revealed (4th Level of Qi Condensation).
            // The player glimpses the conceptual framework underlying cultivation.
            key: "firstGlimpse",
            when: { realm: ["q", "4th Level"] },
            title: "A Shape in the Dark",
            text: "Between breaths, in the space where qi thins to nothing, "
                + "something vast and nameless holds still just long enough to be noticed. "
                + "You do not understand what you saw. You know you will look again."
        },
        {
            // Entry 6: core forged. The Golden Core is a permanent carried artifact.
            // Fires when the Core Formation layer is unlocked (c unlocked = first time
            // the forge is accessible; coreForged hint-key is not in meets(), but
            // layerUnlocked:"c" is the earliest reliable proxy for this milestone
            // since the layer unlocks only after Great Circle + Tendon temper tier).
            // We use realm ["c", "Core Forged"] for the latch: fires the first time the
            // player actually completes a forge (c.best >= 1 = Core Forged substage).
            key: "coreForged",
            when: { realm: ["c", "Core Forged"] },
            title: "The Core Holds",
            text: "The furnace-light fades. In your dantian, something crystalline and permanent settles into place. "
                + "The Golden Core is yours alone, the weight of every meridian you opened and every impurity you burned away. "
                + "This is the thing that will outlast the rest."
        },
        {
            // Entry 7: sect joined. Fires after the archetype pick (sectJoined: true).
            // Uses the new sectJoined meets() key.
            key: "sectJoined",
            when: { sectJoined: true },
            title: "You Belong Somewhere Now",
            text: "The formalities are brief: a token, a bow, a name written in a ledger. "
                + "What lingers is the weight of it. You have chosen a path among paths, "
                + "and the sect has chosen you back."
        },
        {
            // Entry 8: Nascent Soul first breakthrough (Early Nascent Soul).
            // The soul becomes something more than a mechanism.
            key: "nascentSoul",
            when: { realm: ["n", "Early Nascent Soul"] },
            title: "The Soul Stirs",
            text: "You expected a wall. Instead there is a door, and on the other side of it "
                + "something looks back at you. Not a stranger, but a version of yourself you have not yet earned. "
                + "The nascent soul has awakened. It is waiting."
        },
        {
            // Entry 9: Soul Aspect chosen. The soul takes a permanent form.
            // A Dao Seed of any element suggests the player has been studying the lattice.
            // We fire this slightly after NS by gating on anyDaoNode:1 (any Glimpse owned)
            // AND the Early Nascent Soul realm, so it fires in the window where the
            // player is most likely to have just chosen an aspect. This is a proxy — the
            // true trigger (soulAspect key) is a hint-only key, not a meets() key; but
            // anyDaoNode:1 + NS realm together form a tight enough window without contortion.
            // If the player chose Formless (no Dao Seed needed), the anyDaoNode gate is a
            // mild delay — they will have a Glimpse soon regardless. ⟨tune: adjust if needed⟩
            key: "aspectChosen",
            when: { realm: ["n", "Early Nascent Soul"], anyDaoNode: 1 },
            title: "A Form in the Formless",
            text: "The soul does not announce what it has become. "
                + "You simply notice, one morning, that your qi moves differently, "
                + "shaped now by something that has always been you but was never spoken aloud."
        },
        {
            // Entry 10: Nascent Soul deepens — Late Nascent Soul. The climb continues.
            key: "lateNascentSoul",
            when: { realm: ["n", "Late Nascent Soul"] },
            title: "The Long Interior",
            text: "The soul matures in silence. "
                + "You have stopped counting the breakthroughs; what matters now is the quality of attention you bring to each one. "
                + "The mountain has not gotten smaller. You have gotten larger."
        },
        {
            // Entry 11: All primary meridians opened. A completion milestone in the body path.
            key: "allMeridians",
            when: { primaryMeridiansAll: true },
            title: "The Twelve Channels",
            text: "The last primary meridian opens with less drama than you expected, "
                + "a quiet unlocking, like remembering a word you always knew. "
                + "The body is as ready as it can make itself. The rest is up to the soul."
        },
        {
            // Entry 12: Soul Formation realm approached (Apex of Nascent Soul). The beginning of
            // the Act I capstone arc. Latches on the exact state: the s (Soul Formation)
            // layer unlocked — the first SF breakthrough.
            key: "soulFormationEntered",
            when: { layerUnlocked: "s" },
            title: "The Shape of the Final Step",
            text: "The soul does not complete its formation by climbing. It completes it by enduring. "
                + "You have reached the Apex of the Nascent Soul. What waits beyond is not a wall but a question: "
                + "what are you made of, when heaven itself decides to find out?"
        },
        {
            // Entry 13: the First Tribulation resolved with a passing grade — the exact
            // latch via the tribulationPassed hint-only key (tribulationPassed() reader),
            // so the prose fires at the moment it is written for, never before.
            key: "tribulationPassed",
            when: { tribulationPassed: true },
            title: "Through the Storm",
            text: "The final wave broke and the pool held. Not without cost. Your qi ran thin, "
                + "your soul bent in ways it had never bent. "
                + "But it held. The tribulation is behind you, and something it left in you will not leave."
        },
        {
            // Entry 14: a scar is ACTIVE — the tribulation failed or resolved Scarred and
            // the failure-scar slot carries unhealed depth. Exact latch via scarActive
            // (scarIsActive() reader): only a player who actually took the scar reads this.
            key: "scarTaken",
            when: { scarActive: true },
            title: "The Mark It Left",
            text: "The wound is not visible from the outside. "
                + "You know it by the way your qi moves differently now, heavier in one place, "
                + "thinner where it was not thin before. The scar is real. So is the path through it."
        },
        {
            // Entry 15: at least one scar depth HEALED — the §1.3 heal arc completed and
            // converted into the Tempered by Ruin buff. Exact latch via the scarHealed
            // hint-only key (scarHealedDepth() > 0).
            key: "scarHealed",
            when: { scarHealed: true },
            title: "Tempered by Ruin",
            text: "The weight is gone. Not just the wound. Something settled where the wound was. "
                + "What the tribulation scarred, cultivation healed into something harder, "
                + "and what is harder now will not crack the same way again."
        },
        {
            // Entry 16: Act I complete — the Legacy Grade is computed and stored by
            // computeAndStoreActOneLegacy at the moment of the first tribulation pass, so
            // tribulationPassed IS the exact "legacy recorded" latch (no separate key needed).
            key: "actOneLegacy",
            when: { tribulationPassed: true },
            title: "What the Road Records",
            text: "The road does not forget what you did on it. "
                + "The core you forged, the aspect your soul chose, the tribulation you survived: "
                + "all of it written now in the eternal record. "
                + "This is the first line of your legacy. There will be more."
        }
    ]
};
