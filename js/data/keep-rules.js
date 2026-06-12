// js/data/keep-rules.js — declarative keep-acquisition table (design §1.2, §8.2)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (the compiled
// doReset reads these rows to decide which player[target] keys survive a prestige)
// and by js/build/linter.js (proves every rule's milestone is reachable and every
// kept key exists). The reference hand-rolls keep acquisition with per-reset guard
// code; here it is data the factory compiles (design §1.2). Keep-rule acquisition
// is the long-tail reward class — "your Qi progress now survives Foundation
// breakthrough" is felt progress with zero new content cost.
//
// A keep rule is ACTIVE only once the player has EARNED its milestone (TMT
// hasMilestone). Until then the cascade reset is byte-for-byte the default.
//
// Earned keep rules are UNCONDITIONAL by design: they apply on every reset of
// onResetOf, including the forced resetRow ("I WANT TO RESET THIS") path — kept
// progress is earned permanence, like meridians, and TMT's reset machinery does
// not thread a force signal into layer doReset anyway. Only a hard save wipe
// clears it.
//
// KEEP_RULES row shape (consumed by the factory's compiled doReset + the linter):
//   key        string  semantic identifier for the rule.
//   grantedBy  object  { layer, milestone } — the TMT milestone whose acquisition
//                      ACTIVATES the rule. milestone ids are the data-derived
//                      milestone keys for that layer (realm milestone ids are
//                      sub-stage indices; e.g. f milestone 3 = "Peak Foundation").
//   onResetOf  string  layer id — the rule fires when THIS layer prestiges.
//   target     string  layer id — the layer whose keys are preserved.
//   keep       array   player[target] key names to preserve through the reset
//                      (passed straight to layerDataReset's keep array).

var KEEP_RULES = [
    {
        key: "qiInsightSurvivesFoundation",
        // Active once the player has EARNED this milestone (TMT hasMilestone).
        // f milestone ids are substage indices; 3 = "Peak Foundation" (f.best >= 22). ⟨tune⟩
        grantedBy: { layer: "f", milestone: 3 },
        onResetOf: "f",     // when f prestiges...
        target: "q",        // ...the q layer keeps:
        keep: ["best"]      // q.best survives, so q sub-stage milestones recompute as kept
    }
];
