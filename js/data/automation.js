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
//     maturity    object  (action "prestige" only) the MATURITY model that decides WHEN the
//                         bell fires and WHEN it rests (the design's "auto-prestige at
//                         threshold", reworked from a flat gainFraction into a falloff curve).
//                         A realm has a natural "fully formed" point — its top sub-stage
//                         climbed (and, for the forge-funding realm, enough fuel banked). The
//                         bell drives the realm toward that point, then RESTS, so it never
//                         keeps wiping Qi the player is banking for the next breakthrough. As
//                         the realm matures the per-prestige Qi cost rises on a curve, so the
//                         bell tapers off visibly instead of stopping dead. Fields:
//                           baseFraction number  the "worth it" floor (the old gainFraction):
//                                               at zero maturity the bell fires when the pending
//                                               gain is at least this fraction of current
//                                               currency. Prevents zeroing the pool / starving
//                                               Qi sinks early.
//                           costExponent number  shapes the falloff: effective fraction =
//                                               baseFraction x (1 / (1 - completeness))^costExponent.
//                                               Higher = sharper rise near "fully formed".
//                           costCap      number  >= 1. Hard ceiling on that multiplier. WITHOUT it
//                                               the curve asymptotes near completion, so the bell's
//                                               final pre-rest prestige would demand an absurd Qi
//                                               bank (tens of millions) and the foundation would
//                                               never cleanly rest in real play. The cap bounds the
//                                               last bank and guarantees the bell reaches rest.
//                           restEpsilon  number  completeness within this of 1.0 counts as
//                                               fully formed -> the bell rests (and avoids the
//                                               divide-by-zero at the curve's asymptote).
//                           fuelFromForge bool   (optional) also require the forge fuel reserve
//                                               (this layer's currency vs the heaviest forge
//                                               push) before resting — so Foundation banks
//                                               enough fuel to forge, not just climbs sub-stages.
//                         All targets are DATA-DERIVED (top sub-stage from REALM_DATA, fuel from
//                         SETPIECE_DATA.forge), so future upgrades that add sub-stages or cut
//                         fuel cost move the ceiling automatically — content hooks, not rewrites.

var AUTOMATION_DATA = [
    {
        // Auto-prestige Qi Condensation once Nascent Soul is reached (§5). q is the
        // root realm — re-condensing Qi is the most repetitive, decisionless action
        // in the game, exactly what frontier-minus-two automation should erase.
        //
        // MATURITY model (§5 "auto-prestige at threshold", reworked): the bell re-condenses
        // Qi to climb q toward its top sub-stage, then RESTS. baseFraction keeps the early
        // behavior (fire only when the gain is worth >=5% of current q) so it never zeroes the
        // Qi pool and starves the meridian autobuy; costExponent makes the per-prestige cost
        // rise as q matures so it tapers off; restEpsilon parks it once q is fully climbed, so
        // a player banking Qi for Soul Formation is never fought by the q bell. ⟨tune⟩
        key: "nascentQiPrestige",
        grantedBy: { layer: "n", milestone: 0 },      // first NS sub-stage (Early Nascent Soul)
        automates: { layer: "q", action: "prestige", maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5 } }
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
    },
    {
        // The ARSENAL (design §4.3 "arsenal automations", slice 5): the sect's arsenal grants
        // an auto-Foundation-prestige bell once the player reaches the arsenal contribution
        // milestone (SECT_DATA milestone 2, now itself gated on a forged core). Its job is to
        // REBUILD the Foundation after a Nascent Soul breakthrough cascades it away — drive f
        // back to its Great Circle (and bank forge fuel), then REST. The MATURITY model is what
        // makes "rest" work: once the Foundation is fully formed there is nothing left to build,
        // so the bell stops and the player's Qi banks freely toward the next realm. This is the
        // fix for the old softlock where the flat-gainFraction bell wiped Qi below the 250k core
        // gate forever (worse at higher Foundation grades, which only sped the wipe). fuelFromForge
        // also holds the bell until enough Foundation fuel is banked for any forge push, not just
        // until the sub-stages are climbed. The grant resolves through the sect layer's milestone
        // source (SECT_DATA.milestones), which the linter's milestone-source check knows. ⟨tune⟩
        key: "sectFoundationBell",
        grantedBy: { layer: "sect", milestone: 2 },   // arsenal milestone (SECT_DATA.milestones[2])
        automates: { layer: "f", action: "prestige", maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5, fuelFromForge: true } }
    }
];
