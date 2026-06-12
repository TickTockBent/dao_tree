// js/data/techniques.js — the permanent arts library (design §4.3, LIFE scope)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (the technique
// UPGRADES on the sect layer + the techniqueQiMult / techniqueInsightMult readers).
// Techniques are the reference's best reward loop, kept in spirit (§4.3): a permanent
// arts library bought with Contribution. They are TMT UPGRADES on the sect layer, so an
// owned technique persists in player.sect.upgrades — LIFE-scoped, never reset this slice.
//
// SCHOOL + TIER GATING (design §4.3 "each offers a different technique library"):
//   - school "sword"     — visible/buyable ONLY while joined to the Azure Sword Sect.
//   - school "formation" — visible/buyable ONLY while joined to the Stone Formation Sect.
//   - school "universal" — available to BOTH archetypes (the shared sect canon).
//   - libraryTier 1 — buyable as soon as the technique's school is available (joined).
//   - libraryTier 2 — additionally gated on the sect LIBRARY milestone (SECT_DATA
//                     milestone "library", reward { libraryTier: 2 }) — the deeper arts.
//
// TECHNIQUE_DATA row shape (consumed by makeSectTechniqueUpgrades + the mult readers):
//   key         string  semantic key; the TMT upgrade id is its array index (positional).
//   name        string  display name.
//   school      string  "sword" | "formation" | "universal".
//   libraryTier number  1 | 2 (tier 2 needs the library milestone).
//   cost        number  Contribution cost (ascending WITHIN a school so the school reads
//                       as a ladder; deducted from player.sect.points by the upgrade buy).
//   effect      object  ONLY { qiMult } | { insightMult }, every value >= 1 (a permanent
//                       arts bonus, never a penalty — same bonus discipline as lattice
//                       nodes §4.2 / soul aspects §5). qiMult folds into cultivationQiPerSecond
//                       via techniqueQiMult(); insightMult into insightPerSecond via
//                       techniqueInsightMult() — both products over OWNED techniques (no dead
//                       mult §9.2). Effects are MODEST (~1.10-1.30) and stack multiplicatively.
//   flavor      string  one genre-honest line.
//
// PACING INTENT (§4.3 / §11 slice 5): the cheapest tier-1 technique (cost 600) lands
// ~10-15 min after joining on the SECT_DATA contribution trickle (rate 0.5 x sqrt(qi/sec)).
// Tier-1 costs (600 / 1200 / 1800 within a school) are an early-Foundation arc; tier-2 costs
// (5000 / 9000) sit past the library milestone (at 4000 Contribution), a mid-game sink.

var TECHNIQUE_DATA = [
    // --- Sword school (Azure Sword Sect, element metal). The §4.2 sword line is an Insight
    // engine, so the sword school leans insightMult — pairing with Sword Trance + Sword Soul.
    { key: "azureForm",   name: "Azure Sword Form",   school: "sword", libraryTier: 1, cost: 600,
      effect: { qiMult: 1.12 }, flavor: "The first form: a straight cut, endlessly drilled." },
    { key: "severingArc", name: "Severing Arc",       school: "sword", libraryTier: 1, cost: 1800,
      effect: { insightMult: 1.20 }, flavor: "Intent sharpens until the blade cuts the idea of resistance." },
    { key: "swordHeart",  name: "Sword Heart Sutra",  school: "sword", libraryTier: 2, cost: 9000,
      effect: { insightMult: 1.30 }, flavor: "A heart that is a blade comprehends the Dao of severance." },

    // --- Formation school (Stone Formation Sect, element earth). The earth/mountain line
    // feeds the body's gathering, so the formation school leans qiMult.
    { key: "stoneSkin",     name: "Stone Skin Array",   school: "formation", libraryTier: 1, cost: 600,
      effect: { qiMult: 1.12 }, flavor: "A novice's ward: stone drawn close until the flesh forgets it is soft." },
    { key: "wardLattice",   name: "Warding Lattice",    school: "formation", libraryTier: 1, cost: 1800,
      effect: { qiMult: 1.20 }, flavor: "Spirit-stones set in a quiet grid drink ambient Qi and return it tenfold." },
    { key: "mountainHeart", name: "Mountain Heart Seal", school: "formation", libraryTier: 2, cost: 9000,
      effect: { qiMult: 1.30 }, flavor: "The formation and the formationmaster become one immovable peak." },

    // --- Universal (the shared sect canon, available to BOTH archetypes). Breath-work and
    // meditation arts every disciple learns regardless of school. A modest qiMult and a
    // modest insightMult so each archetype gets one of each grammar from the shared library.
    { key: "breathCanon", name: "Eight Breaths Canon",   school: "universal", libraryTier: 1, cost: 1200,
      effect: { qiMult: 1.10 }, flavor: "Eight measured breaths the sect teaches every outer disciple." },
    { key: "stillMind",   name: "Still-Mind Meditation", school: "universal", libraryTier: 2, cost: 5000,
      effect: { insightMult: 1.15 }, flavor: "A mind made still hears the Dao that a loud one drowns out." }
];
