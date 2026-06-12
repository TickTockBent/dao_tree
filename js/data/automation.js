// js/data/automation.js — single source of truth for the automation ladder
// (design §1.7 "Automation as climbing reward" / §7.5 "the automation ladder").
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (the
// automationGranted reader + the q autoPrestige wiring + the Body autobuy
// automate() hook). Automation is the #1 retention mechanic in long incrementals
// and the design is emphatic that it must be a REWARD, never a settings toggle
// (§1.7): a grant becomes ACTIVE the moment its milestone is earned and stays on
// forever after — there is no per-automation on/off switch anywhere in the UI.
//
// Tier 1 is granted by the Nascent Soul (expansion §5: "the nascent soul acts
// independently, so NS also grants Automation Tier 1 — auto-meridians, auto-q-
// prestige"). All three rows are gated on the FIRST Nascent Soul sub-stage
// (milestone 0 = "Early Nascent Soul"), so reaching Nascent Soul at all hands the
// player the hands for the two-rows-below content (Qi Condensation prestige + the
// Body meridian buyables) — the frontier-minus-two coverage rule (§1.7/§7.5).
//
// DELIBERATELY NOT AUTOMATED: tempering. Temper is a grade DECISION, not hands
// (§4b) — how far you temper sets your Foundation ceiling, a choice the player
// makes, so it stays MANUAL even at Nascent Soul. Only repetitive, decisionless
// actions (re-prestige a capped realm, re-buy a meridian) are automated here.
//
// AUTOMATION_DATA row shape (consumed by the factory's automationGranted + the
// per-action wiring):
//   key        string  semantic identifier for the grant.
//   grantedBy  object  { layer, milestone } — the TMT milestone whose acquisition
//                      ACTIVATES the automation (hasMilestone). Mirrors KEEP_RULES'
//                      grantedBy: a realm milestone id is a sub-stage index.
//   automates  object  what the grant runs, in the action grammar below:
//     layer       string  the layer the automation drives.
//     action      string  "prestige" — auto-prestige `layer` whenever it canReset
//                         (wired as the layer's tmp.autoPrestige, which game.js's
//                          gameLoop consumes: `if (autoPrestige && canReset) doReset`).
//                       | "buyable" — auto-buy a buyable while affordable, respecting
//                         the buyable's unlocked flag + purchaseLimit (a manual click's
//                         exact guards), driven from the layer's automate() tick hook.
//     buyableKey  string  (action "buyable" only) the BODY_DATA buyable key to auto-buy.

var AUTOMATION_DATA = [
    {
        // Auto-prestige Qi Condensation once Nascent Soul is reached (§5). q is the
        // root realm — re-condensing Qi is the most repetitive, decisionless action
        // in the game, exactly what frontier-minus-two automation should erase.
        //
        // gainFraction is the design's "auto-q-prestige AT THRESHOLD" (§5): the auto-
        // prestige fires only when the pending gain is worth at least this fraction
        // of the realm's current currency. Without it, gameLoop's tree-loop-before-
        // side-loop order would prestige q at bare canReset every tick, zeroing the
        // Qi pool and STARVING every Qi sink (meridian autobuy, manual temper, the
        // player's own banking). The fraction self-scales: as q grows, the implied
        // Qi threshold grows quadratically, leaving ever more headroom below it. ⟨tune⟩
        key: "nascentQiPrestige",
        grantedBy: { layer: "n", milestone: 0 },      // first NS sub-stage (Early Nascent Soul)
        automates: { layer: "q", action: "prestige", gainFraction: 0.05 }
    },
    {
        // Auto-open Primary Meridians once Nascent Soul is reached (§5). Buying
        // meridians is pure repetition (no decision — more is always strictly better
        // up to the cap), so it is hands the soul takes over.
        key: "nascentPrimaryMeridians",
        grantedBy: { layer: "n", milestone: 0 },
        automates: { layer: "b", action: "buyable", buyableKey: "primaryMeridian" }
    },
    {
        // Auto-open Extraordinary Meridians once Nascent Soul is reached (§5). Same
        // decisionless repetition as the primary meridians; respects its own unlock
        // gate (all primaries open + q 10th Level) and cap, just like a manual click.
        key: "nascentExtraordinaryMeridians",
        grantedBy: { layer: "n", milestone: 0 },
        automates: { layer: "b", action: "buyable", buyableKey: "extraordinaryMeridian" }
    }
];
