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
//                      (passed straight to layerDataReset's keep array). Keep BOTH
//                      "best" AND "milestones": best preserves the high-water (and
//                      the sub-stage Qi multipliers, which read best), and milestones
//                      preserves the earned sub-stage list so the kept milestones do
//                      NOT re-fire their unlock notification on every reset (the array
//                      would otherwise reset to [] and re-complete all at once next
//                      tick — a notification flood). Both are needed to keep the
//                      progress AND keep it quiet.

var KEEP_RULES = [
    {
        key: "qiInsightSurvivesFoundation",
        // Active once the player has EARNED this milestone (TMT hasMilestone).
        // f milestone ids are substage indices; 3 = "Peak Foundation" (f.best >= 22). ⟨tune⟩
        grantedBy: { layer: "f", milestone: 3 },
        onResetOf: "f",     // when f prestiges...
        target: "q",        // ...the q layer keeps:
        keep: ["best", "milestones"]   // q.best + earned sub-stages survive (no re-notify)
    },
    {
        // Nascent Soul carries the Foundation forward (expansion §5 / §11 slice 4):
        // once the soul matures, a NS breakthrough no longer wipes the Foundation
        // climb below it. n milestone ids are NS sub-stage indices; 2 = "Late Nascent
        // Soul" (n.best >= 12), a mid sub-stage — felt permanence earned partway up
        // the realm, the keep-rule reward class (long-tail, zero new content). ⟨tune⟩
        key: "foundationSurvivesNascentSoul",
        grantedBy: { layer: "n", milestone: 2 },
        onResetOf: "n",     // when Nascent Soul prestiges...
        target: "f",        // ...the Foundation layer keeps:
        keep: ["best", "milestones"]   // f.best + earned sub-stages survive (no re-notify)
    },
    {
        // Soul Formation carries the Nascent Soul climb forward (design §5 capstone / slice 6):
        // once the formed soul matures partway up Soul Formation, an s breakthrough no longer
        // wipes the NS climb below it — the soul spares the mountain it just ascended. s milestone
        // ids are s sub-stage indices; 2 = "Late Soul Formation" (s.best >= 16), a mid sub-stage —
        // felt permanence earned partway up the capstone realm, the keep-rule reward class
        // (long-tail, zero new content). ⟨tune⟩
        key: "soulCarriesTheClimb",
        grantedBy: { layer: "s", milestone: 2 },
        onResetOf: "s",     // when Soul Formation prestiges...
        target: "n",        // ...the Nascent Soul layer keeps:
        keep: ["best", "milestones"]   // n.best + earned sub-stages survive (no re-notify)
    }
];
