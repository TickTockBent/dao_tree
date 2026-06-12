// js/data/legacy.js — the eternal Legacy store (design §8.1 "Legacy Grades are eternal";
// §5 Act I table "Act I Legacy Grade = f(core grade, aspect depth, Dao Seeds, sect rank,
// tribulation grade) ⟨tune weights⟩, stored eternal-scope"; build-order slice 6).
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (the eternal Legacy
// layer + computeAndStoreActOneLegacy + legacyQiMult). The Legacy Grade is the FRACTAL TOP of
// the "graded consequence at every scale" pillar (design §3.1): minor stages feed realm grades,
// realm grades feed the ACT Legacy Grade, and Legacy Grades will feed the Samsara meta loop
// (slice 10). It is the FIRST eternal-scoped layer that STORES a grade (the journal is eternal
// but narrative): the Act I Legacy Grade is computed ONCE, on the first tribulation PASS, from a
// weighted blend of everything Act I built, stored on player.legacy.actOneGrade, and NEVER
// downgraded (a later weaker life can only raise it — eternal permanence, §8.1).
//
// Samsara (slice 10) EXTENDS this: it adds more weight inputs (karma, past lives) and a second
// act's grade, and reads stored grades to seed the next life ⟨design §7.2⟩ — commented here, the
// schema is fixed now so the store survives reincarnation untouched.
//
// LEGACY_DATA shape (consumed by the Legacy layer + the legacy readers):
//   id/name/symbol/color  display fields; id is the TMT layer id ("legacy").
//   actOne   object  the Act I Legacy Grade config:
//     weights      object  per-input weight (coreGrade, aspect, daoSeeds, sectStanding,
//                          tribulation); SUM TO 1 (linter-checkable shape, the gradeScore
//                          precedent §6). Each input is normalized to [0,1] by its denominator,
//                          weighted, summed, clamped, and mapped to a band.
//     denominators object  the saturation point each input divides by (so each term tops out at
//                          its weight): coreGrade = the ladder top index; aspect = 2 (none 0 /
//                          formless 1 / element 2); daoSeeds = a held-Seed count target; sectStanding
//                          = the deeds checkpoint count; tribulation = 3 (the tribulation gradeIndex top).
//     bands        array   ascending floors over the [0,1] score, each { key, label, floor, qiMult }.
//                          The qiMult is the LIVE consumer (a grade that grants nothing is a dead
//                          stat, §9.2) — folded into cultivationQiPerSecond via legacyQiMult().
//                          Samsara adds more weight to the grade later; the qiMult is the v1 payoff.

var LEGACY_DATA = {
    id: "legacy",
    name: "Legacy",
    symbol: "魂",                          // the "soul" glyph — a life's legacy is the soul's record
    color: "#d9c25a",                      // pale gold — the eternal hue, distinct from realm gold / soul amethyst

    // The Act I Legacy Grade (design §5 Soul Formation row). A weighted blend of the five Act I
    // axes; weights sum to 1.0. ⟨tune weights⟩: core grade is the heaviest (the carried artifact
    // is the spine of Act I), the tribulation grade next (the capstone performance), then aspect /
    // sect standing / Dao Seeds as the side-grammar contributions. A player who did EVERYTHING
    // (Upper+ core, an element aspect, several Seeds, Inner Disciple, a Flawless tribulation)
    // lands the top band; a rushed Shaken pass with a Cracked core and Formless soul lands low.
    actOne: {
        weights: {
            coreGrade: 0.35,       // the carried Golden Core — the heaviest single axis
            tribulation: 0.25,     // the capstone tribulation performance grade
            aspect: 0.15,          // the soul's chosen form (none/formless/element)
            sectStanding: 0.15,    // horizontal standing (the deeds checkpoints earned)
            daoSeeds: 0.10         // comprehension depth (held Dao Seeds)
        },
        denominators: {
            coreGrade: 4,          // top ceilingIndex of the core ladder (Perfect = index 4)
            aspect: 2,             // none = 0, formless = 1, element = 2
            daoSeeds: 8,           // ~eight held Seeds is "deeply comprehended" for Act I ⟨tune⟩
            sectStanding: 2,       // the deeds checkpoint count (Outer + Inner Disciple)
            tribulation: 3         // the tribulation gradeIndex top (Flawless = index 3)
        },
        // Ascending bands over the [0,1] weighted score. Evocative labels (design §5 "evocative
        // labels"); each qiMult >= 1 is the LIVE eternal payoff folded into Qi/sec. The bands are
        // spaced so a typical first clear lands Steady/Radiant and a near-perfect run lands Eternal.
        bands: [
            { key: "faint",   label: "Faint Legacy",   floor: 0.00, qiMult: 1.00 },  // a life barely remembered
            { key: "steady",  label: "Steady Legacy",  floor: 0.30, qiMult: 1.15 },
            { key: "radiant", label: "Radiant Legacy", floor: 0.55, qiMult: 1.35 },
            { key: "eternal", label: "Eternal Legacy", floor: 0.80, qiMult: 1.60 }   // a life that echoes
        ]
    }
};
