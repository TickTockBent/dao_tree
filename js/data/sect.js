// js/data/sect.js — single source of truth for the Sect side-spine (design §4.3)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (makeSectLayer,
// the sect* readers) and js/build/linter.js (sect milestone-source resolution) exactly
// the way REALM_DATA / BODY_DATA / LATTICE_DATA are. The sect is the game's THIRD
// grammar (design §4.3 "horizontal standing"): not a vertical prestige and not the Dao
// lattice's comprehension, but a side-spine of CONTRIBUTION that buys stipends, a
// technique library, and arsenal automations. It is LIFE-scoped (trees.js sect entry) —
// a member of no tree, untouched by any realm breakthrough cascade. (Reincarnation /
// world-rank re-pricing of the arsenal, §4.3, is a FUTURE slice; life-scope is enough now.)
//
// ARCHETYPE PICK (design §4.3 "Sect archetypes matter"): joining a sect is a one-time,
// no-cost identity pick — the player chooses ONE archetype, ONCE per life (the Soul Aspect
// precedent, §5). Each archetype offers a different TECHNIQUE library (techniques.js) and a
// Dao-lattice DISCOUNT region (its element's lattice node costs are cut). Contribution
// accrues ONLY after joining; before the pick the layer shows the two archetypes to choose.
//
// SECT_DATA shape (consumed by makeSectLayer + the sect* readers):
//   id/name/symbol/color  display fields; id is the TMT layer id ("sect"). `name` is the
//                       UNJOINED display; once joined the chosen archetype's name shows.
//   reveal     object   meets()-style reveal condition (§5a grammar). Sects recruit
//                       promising mortals EARLY — revealed at Qi Condensation 2nd Level.
//   contribution object the passive accrual law while JOINED:
//                         resource  string  the currency name ("Contribution")
//                         rate      number  multiplier on the (qi/sec)^exponent term
//                         exponent  number  < 1 — SUB-LINEAR in Qi/sec, so late-game Qi
//                                           (hundreds → thousands/sec) does not trivialize
//                                           the sect economy (§4.3). contribution/sec =
//                                           rate x (qi/sec)^exponent.
//   archetypes array    EXACTLY two rows (slice 5: Azure Sword + Stone Formation), each:
//                         key             string  semantic key; stored as player.sect.archetype.
//                         name            string  the joined sect's display name.
//                         element         string  one of the five lattice elements; its
//                                                 lattice nodes get latticeDiscount.
//                         latticeDiscount number  (0,1] — metal/earth element lattice node
//                                                 costs x this while joined to this sect
//                                                 (§4.3 "Dao-lattice discount region").
//                         techniques      array   technique keys (techniques.js) this
//                                                 archetype's school unlocks. (Display only;
//                                                 the technique upgrades resolve school
//                                                 membership from TECHNIQUE_DATA.school.)
//   milestones array    contribution high-water milestones (TMT milestones on the sect
//                       layer, ids = array index, done() reads the contribution best):
//                         key    string  semantic key.
//                         at     number  Contribution high-water that earns it.
//                         reward object  { qiMult } stipend | { libraryTier } | { arsenal }.
//
// PACING INTENT (§4.3 / §11 slice 5, stated here because the numbers live here):
//   - reveal at q 2nd Level (best>=3): the sect node appears a few minutes into a fresh run
//     (sects recruit promising mortals early). The pick + accrual open the moment it reveals.
//   - rate 0.5, exponent 0.5: contribution/sec = 0.5 x sqrt(qi/sec). Early (qi/sec ~2-10)
//     this trickles ~0.7-1.6 Contribution/sec; the cheapest tier-1 technique (cost 600) then
//     lands ~10-15 min after joining (the pinned "first technique ~10-15 min" target). The
//     sub-linear sqrt means at qi/sec ~2500 (post-core) the trickle is only ~25/sec, so the
//     library/arsenal milestones stay a meaningful multi-hour arc rather than instant.
//   - stipend 250 / library 4000 / arsenal 30000: spaced so the arsenal (auto-f) milestone
//     lands around the Nascent Soul push (post-core, qi/sec in the thousands) — the design's
//     "arsenal arrives around the Nascent Soul push" target. Stipend is an early reward
//     (~a few min of trickle); the library gates tier-2 techniques mid-Foundation.

var SECT_DATA = {
    id: "sect",
    name: "Unaffiliated",                 // display before the pick; becomes the archetype name once joined
    symbol: "宗",                          // the "sect" glyph; the implementer's chosen display symbol
    color: "#5aa0c9",                      // jade-blue — distinct from realm gold / soul amethyst / dao violet

    // §5a reveal grammar (named stage label, never a numeric token — the realms.js
    // standard): sects recruit promising mortals EARLY, at Qi Condensation 2nd Level (§4.3).
    reveal: { realm: ["q", "2nd Level"] },

    // Passive accrual law while JOINED (design §4.3). Sub-linear in Qi/sec so late-game
    // Qi does not trivialize the sect economy: contribution/sec = rate x (qi/sec)^exponent.
    contribution: {
        resource: "Contribution",
        rate: 0.5,
        exponent: 0.5                      // sqrt — sub-linear, < 1 (linter-enforced)
    },

    // The two slice-5 archetypes (design §4.3). Sword school leans the metal/Insight line;
    // formation school leans the earth/Qi line — each discounts its OWN element's lattice
    // nodes (§4.3 "Dao-lattice discount region"), making sect choice a build decision.
    archetypes: [
        {
            key: "azureSword",
            name: "Azure Sword Sect",
            element: "metal",
            // Metal-element lattice nodes cost x0.75 while joined here (a 25% discount on the
            // sword/edge line that feeds Sword Trance + the Sword Soul aspect). ⟨tune⟩
            latticeDiscount: 0.75,
            techniques: ["azureForm", "severingArc", "swordHeart"]
        },
        {
            key: "stoneFormation",
            name: "Stone Formation Sect",
            element: "earth",
            // Earth-element lattice nodes cost x0.75 while joined here (the mountain/endurance
            // line that feeds the Mountain Soul aspect). Same shape as Azure Sword. ⟨tune⟩
            latticeDiscount: 0.75,
            techniques: ["stoneSkin", "wardLattice", "mountainHeart"]
        }
    ],

    // Contribution high-water milestones (TMT milestones; ids = array index). done() reads
    // the contribution best (player.sect.best), so they latch once earned and never un-earn.
    milestones: [
        // Sect stipend (§4.3 / §8 stipend precedent): a permanent +15% Qi/sec for standing
        // in the sect. Folds into cultivationQiPerSecond via sectStipendQiMult(). ⟨tune⟩
        { key: "stipend",  at: 250,   reward: { qiMult: 1.15 } },
        // Library access (§4.3): unlocks the tier-2 technique rows (the deeper arts). The
        // technique upgrades gate their tier-2 rows on this milestone (libraryTier 2). ⟨tune⟩
        { key: "library",  at: 4000,  reward: { libraryTier: 2 } },
        // Arsenal (§4.3 "arsenal automations"): grants the sectFoundationBell automation row
        // (automation.js) — auto-prestige Foundation at threshold. Lands ~the Nascent Soul push. ⟨tune⟩
        { key: "arsenal",  at: 30000, reward: { arsenal: true } }
    ]
};
