// js/build/pacing-sim.js — Act I pacing simulation harness (NOT loaded by the
// game; NOT scanned by the linter — it is a Node HARNESS, exempt from the §11
// zero-numeric-literal rule, like the other js/build/*-node.js scripts).
//
// Usage:
//   node js/build/pacing-sim.js            default mode: run all three profiles,
//                                          assert STRUCTURAL facts only (pre-pin).
//   node js/build/pacing-sim.js --report   D1 calibration mode: print a phase-timing
//                                          table for all three profiles, NO assertions.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS (slice 6.5 Phase B → Phase C/D1 — sim revival + actor model)
// ---------------------------------------------------------------------------
// This sim boots the REAL engine headless (js/build/node-boot.js, the same boot
// path the runtime smoke harness uses) and drives competent-player policies against
// the ACTUAL data tables and factory readers, from a fresh life to the First
// Tribulation and the scar heal arc. It does NOT re-implement the economy. Every
// game NUMBER it consumes — Qi/sec, breakthrough gain, grade score, band resolution,
// forge fuel cost, unlock gates, keep rules, the full Qi pipeline product (stances,
// techniques, aspect, scar, tempered, legacy), the tribulation pool/intensity/waves,
// the scar heal — comes from a factory reader or an engine call executed inside the
// booted context, never from a formula copied into this file. This is the rule
// (spec §0.2 "bind, don't duplicate") whose absence crashed the previous sim.
//
// Every realm advance (q/f/c/n/s) goes through the engine's OWN doReset (so keep
// rules, the graded onPrestige hook, and the milestone cascade all apply); the forge
// goes through performForge(Steady); the aspect through clickClickable; the
// tribulation through beginTribulation + the s layer's real update(diff) ticks; the
// scar heal through scarHealTick. The sim holds NO economy state — player/tmp ARE the
// state; the sim's SimState is only the clock + the marks table + a runaway tripwire.
//
// Any unavoidable duplication (a value no headless reader exposes) is tagged with a
// "SIM-DUP:" comment stating WHY. The complete SIM-DUP list (FOUR entries) is below:
//   1. the env-override key map (which data field each sweep var writes — a tuner affordance);
//   2. the gain inverse Qi=reqBase*(gain/gainMult)^(1/gainExp) (the engine exposes getNextAt
//      only for resetGain+1, not an arbitrary target gain — needed for analytic time-stepping);
//   3. the many-small-break realm-climb TIME integral (the engine does one doReset per call and
//      exposes no "advance N breaks over T seconds" surface — needed so the c/n/s climb does not
//      run thousands of doResets and blow the 30s wall budget). All read reqBase/gainExp/
//      gainMult LIVE from the booted layer, and the engine STATE always advances via real doResets;
//   4. the tribulation bank target 10^qiFuelDenominator (inverts the pool's log10(qi)/denominator
//      fuel normalizer to its saturation Qi — no reader exposes the saturation point; the
//      denominator itself is read live from SETPIECE_DATA).
//
// ---------------------------------------------------------------------------
// C4 DISCOVERY — Soul-Aspect reach per profile (REQUIRED, spec §C4; read before pins)
// ---------------------------------------------------------------------------
// The Soul Aspect (REALM_DATA(n).soulAspect.aspects, picked once on first n
// breakthrough) gates each ELEMENT aspect on `requires: { daoElementTier: [el, 2] }`
// — a HELD SEED (tier 2) of a Dao node of that element (verified in layerFactory.js
// meets(): daoElementTier scans LATTICE_DATA.nodes for a node of that element owning
// tier >= 2). Formless alone requires {} — the always-available completability floor.
// Therefore:
//   - SPINE-ONLY (never opens the lattice → owns ZERO Dao nodes → no element Seed):
//     can reach ONLY the FORMLESS aspect. An element aspect is structurally
//     UNREACHABLE with zero Dao nodes. This is the documented C4 answer; the
//     spine-only tribulation assertion is grade-agnostic, so Formless is acceptable.
//   - DILIGENT (opens lattice cheapest-first toward the legacy daoSeeds denominator,
//     8 Seeds): buys element-root Seeds, so it CAN reach an ELEMENT aspect. The
//     diligent policy targets the element of its sect archetype's latticeDiscount
//     (Azure Sword → metal → metalSoul) so the sect discount, the element Seed, and
//     the aspect line up; it falls back to Formless if (under a sweep) no element Seed
//     is held by first n breakthrough. Either way the choice is the highest-credit
//     aspect its state allows (spec §C3 diligent: "highest-credit choice its state allows").
//   - MAX-SCAR runs the diligent policy, so it reaches the same element aspect.
//
// ---------------------------------------------------------------------------
// TIME MODEL (event-stepped, NOT a 1-second tick loop)
// ---------------------------------------------------------------------------
// Between two player decisions the Qi rate is CONSTANT (nothing the player owns
// changes until they buy/break/forge). So instead of ticking one game-second at a
// time, the sim computes the time to the NEXT decision boundary analytically:
//   dt = (targetQi - currentQi) / qiPerSecond
// advances sim-seconds by exactly that, batch-applies the Qi accrual, runs the
// decision, and repeats. The "next boundary" is the cheapest Qi target among the
// policy's currently-wanted actions (next buyable cost, the next breakthrough
// requirement, the forge fuel requirement, the tribulation Qi bank target). This
// keeps a full Act-I-to-tribulation run to a few thousand iterations, well under the
// 30s run-all budget for all three profiles.
//
// The TRIBULATION itself and the SCAR HEAL accrue over real engine ticks, NOT one
// analytic jump (the wave drain is non-linear in elapsed time, the heal converts a
// depth at a bar boundary). Both are driven by BOUNDED fine ticks (a fixed number of
// 1-second engine ticks: durationSeconds + a margin for the trib; a capped loop that
// stops the instant the scar is fully healed). Bounded, so they cost a fixed, tiny
// slice of the wall budget.
//
// SIM TIME IS CONTINUOUS GAME TIME. Offline-time modeling is out of scope
// (spec "Out of scope"); the sim assumes the player is present and gathering. Insight
// and Contribution trickle (dao/sect update) are advanced analytically across each
// idle dt by driving the engine's own per-layer update(diff) — see advanceTime().
//
// ---------------------------------------------------------------------------
// HOW BINDING WORKS (the mechanism)
// ---------------------------------------------------------------------------
// node-boot.bootEngine() returns { context, boot }. `boot(expr)` runs a string of
// engine code inside the vm context (the same player/tmp/layers globals the game
// uses) and returns the result. The sim WRITES state by running engine code
// (player.points = new Decimal(N), setBuyableAmount, buyBuyable, doReset,
// performForge, clickClickable, beginTribulation), REFRESHES derived state with
// updateTemp() after writes, and READS via factory readers. Numbers cross the
// boundary as strings (Decimal.toString) and are parsed to JS floats HERE only for
// the sim's own time arithmetic and reporting — the game-side math stays in Decimal.
//
// ---------------------------------------------------------------------------
// ENV-OVERRIDE SWEEP (does NOT persist — mutates the in-memory sandbox only)
// ---------------------------------------------------------------------------
// The env overrides (F_REQ, F_EXP, Q_EXP, Q_REQ, C_FORGEREQ, BASE_RATE, C_REQ,
// TEMP_RATIO, TEMP_BASE, PRIM_RATIO) let a tuner sweep a value WITHOUT editing
// js/data/* (spec §0.1 forbids data edits). They mutate the booted sandbox's data
// globals (REALM_DATA / BODY_DATA / SETPIECE_DATA) BEFORE the player boot; the files
// on disk are never touched and the mutation vanishes when the process exits.

"use strict";

const nodeBoot = require("./node-boot.js");

// ---------------------------------------------------------------------------
// PACING_BUDGETS — pinned phase-timing bands (spec §0.4). Phase D pins these
// against the --report table under Wes's sign-off; until then `pinned:false`
// and the bands are empty, so the sim measures and reports but asserts nothing
// budget-shaped. These are TEST EXPECTATIONS, never game data (they do not move
// to js/data/). ⟨tune⟩
// ---------------------------------------------------------------------------
const PACING_BUDGETS = {
    pinned: false,
    bands: {}
};

// ---------------------------------------------------------------------------
// ACTOR_POLICY — the policy thresholds the actors' decisions read (spec §0.4 / §C3).
// SIM POLICY, not game data: how a "competent, not perfect" player spends. Every GAME
// number (a cost, a gain, a gate threshold) is read from the booted data tables; only
// the policy KNOBS live here, tagged ⟨tune⟩. The three profiles share one event loop;
// per-profile booleans (joinsSect, opensLattice, usesStance) gate the horizontal
// systems so spine-only can prove Act I is completable without them (spec §C3 / §6.6).
// ---------------------------------------------------------------------------
const ACTOR_POLICY = {
    // --- Body build (the q/f-era knobs, ported from Phase B unchanged) ------------
    temperGateTierKey: "tendon",     // first temper milestone target = the c gate tier
    meridianGateForFoundation: true, // open meridians to f.unlock.meridians first
    qBreakthroughBestMargin: 1.15,   // ⟨tune⟩ unused-margin knob kept for parity
    qBreakthroughMinGain: 1,
    fBreakthroughMinGain: 1,
    // A competent BUDGET actor buys the next body upgrade only while it pays back within
    // this many GAME-SECONDS at the current Qi/sec. Both grade axes wall geometrically on
    // current data, so the actor forges at the resulting (real, not saturated) grade and
    // the shortfall vs a saturated grade is a REPORTED finding (rule 0.1). ⟨tune⟩
    bodyBuyPaybackSeconds: 60 * 60 * 2,

    // --- Realm climb past the forge (c → Core Refined, then n, then s) -------------
    // c is climbed to its Core Refined sub-stage (n's unlock gate) then onward toward
    // its grade-relevant top; n is climbed to Apex (s's unlock gate) then toward
    // Perfected; s is climbed to Great Circle (the tribulation trigger). All TARGETS are
    // data-derived (substageThreshold / the unlock rows) — the policy only names which
    // substage each phase aims at, by its data label.
    cRefinedSubstageLabel: "Core Refined",       // c gate for n unlock
    nApexSubstageLabel: "Apex",                  // n gate for s unlock
    sTriggerSubstageLabel: "Great Circle of Soul Formation", // s gate for the tribulation

    // --- Horizontal systems (the per-profile gates live in PROFILES below) ---------
    // Diligent opens lattice nodes cheapest-first toward the legacy daoSeeds denominator
    // (8 Seeds, read from LEGACY_DATA.actOne.denominators.daoSeeds), buys cheapest
    // affordable techniques to the pool's techniqueDenominator count, and runs Breathing
    // Trance while the lattice is revealed AND the Seed target is unmet AND not in a
    // banking phase. The spec names THREE banking phases (§C3): the f climb pre-Great-
    // Circle, pre-forge fuel banking, and the tribulation Qi bank — the main loop computes
    // all three (bankingFClimb / bankingForgeFuel / bankingTribulation).
    // The Seed/technique TARGETS are data-derived; only the behavioral rule is policy.
    breathingTranceStanceKey: "breathingTrance",

    // --- Realm-climb banking efficiency (the sqrt-gain reality) --------------------
    // A "normal" realm's gain is (Qi/reqBase)^gainExp, and n.points/c.points/s.points
    // ACCUMULATE across breaks (the engine ADDS the gain — verified live). So banking a huge
    // pile for one big break is wasteful when gainExp < 1: gain G in one break costs
    // reqBase*G^(1/gainExp) Qi, while many small breaks of gain g cost far less total. The
    // competent player breaks FREQUENTLY with small gains. realmBreakBankFactor is the per-break
    // bank multiple of reqBase (each break banks reqBase*factor Qi → gain = factor^gainExp); the
    // realm-climb TIME is the integral of those many small breaks (the optimal play), computed
    // analytically per substage band so the sim does not execute thousands of engine doResets
    // (the 30s wall budget). The engine STATE advance still goes through ONE real doReset per
    // band so keep rules / milestones / grade hooks fire. ⟨tune⟩ — a sim policy knob, NOT data.
    realmBreakBankFactor: 1,

    // --- Tribulation banking -------------------------------------------------------
    // The actor banks Qi toward the tribulation before triggering. The pool's qi-fuel
    // term saturates at qiFuelDenominator (log10 normalizer, ~1e12 banked maxes it,
    // read from SETPIECE_DATA.firstTribulation.pool.qiFuelDenominator); the actor banks
    // to 10^(that) so the fuel term is full when it triggers. This is the Qi-bank policy
    // threshold the diligent profile triggers at (spec §C3). ⟨tune⟩
    tribulationBankFuelExponentFactor: 1.0,

    // --- Loop safety (sim bookkeeping, not game values) ----------------------------
    // The tribulation run and the scar heal accrue over BOUNDED fine ticks (spec time
    // model). These caps keep the wall budget fixed; they are sim guards, not pacing.
    tribulationTickMarginSeconds: 5,   // extra 1s ticks past durationSeconds to fully resolve
    scarHealMaxTicks: 20000,           // hard cap on heal ticks (depth-3 heal goal ~1440s)
    eventLoopGuard: 2000000            // per-run iteration ceiling (a runaway tripwire)
};

// ---------------------------------------------------------------------------
// PROFILES (spec §C3). Three deterministic rule sets, no RNG, forge Steady only.
//   diligent   — the budget actor: every horizontal system on; element aspect; banks
//                Qi and faces the tribulation at first readiness with the bank met.
//   spineOnly  — the optionality actor: never joins the sect, never opens the lattice,
//                never uses a stance; Formless aspect (C4); proves Act I is completable
//                on the vertical spine alone.
//   maxScar    — the §6.2 actor: runs diligent, but scar depth is forced to maxDepth at
//                first tribulation eligibility; must still pass, then completes the heal
//                arc from depth 3 (tempered buff > 1 afterward).
// ---------------------------------------------------------------------------
const PROFILES = {
    diligent: {
        key: "diligent",
        label: "diligent",
        joinsSect: true,
        opensLattice: true,
        usesStance: true,
        buysTechniques: true,
        forceMaxScarAtTribulation: false
    },
    spineOnly: {
        key: "spineOnly",
        label: "spine-only",
        joinsSect: false,
        opensLattice: false,
        usesStance: false,
        buysTechniques: false,
        forceMaxScarAtTribulation: false
    },
    maxScar: {
        key: "maxScar",
        label: "max-scar",
        joinsSect: true,
        opensLattice: true,
        usesStance: true,
        buysTechniques: true,
        forceMaxScarAtTribulation: true
    }
};
const PROFILE_ORDER = ["diligent", "spineOnly", "maxScar"];

// ---------------------------------------------------------------------------
// Boot the real engine (the shared shim). The sim drives `boot(expr)`.
// ---------------------------------------------------------------------------
function fail(message) {
    console.error("PACING SIM ERROR: " + message);
    process.exit(1);
}
const booted = nodeBoot.bootEngine({ onFail: fail });
const boot = booted.boot;

// Read a Decimal-valued engine expression as a JS number (for the sim's own time
// arithmetic / reporting only — game math stays in Decimal inside the context).
function numOf(expression) {
    return Number(boot("(" + expression + ").toString()"));
}
// Read a plain (non-Decimal) engine expression.
function valOf(expression) {
    return boot(expression);
}

// ---------------------------------------------------------------------------
// ENV-OVERRIDE SWEEP — mutate the in-memory data globals BEFORE the player boot.
// SIM-DUP 1: the override KEYS (which data field each env var maps to) are named
// here because they are a sim-author affordance, not an engine concept — the engine
// has no "sweep" surface. The VALUES are still read straight back out of the data
// tables after the mutation; nothing about the economy is re-derived. It SWEEPS the
// in-memory sandbox, it never PERSISTS to disk.
// ---------------------------------------------------------------------------
function applyEnvOverride(envName, targetExpr, fieldKey) {
    if (process.env[envName] === undefined) return false;
    var parsed = Number(process.env[envName]);
    boot(targetExpr + "['" + fieldKey + "'] = " + parsed + ";");
    return true;
}
function applyAllEnvOverrides() {
    var swept = false;
    function ov(name, expr, key) { if (applyEnvOverride(name, expr, key)) swept = true; }
    ov("Q_REQ", "REALM_DATA.find(function(r){return r.id==='q';})", "reqBase");
    ov("Q_EXP", "REALM_DATA.find(function(r){return r.id==='q';})", "gainExp");
    ov("F_REQ", "REALM_DATA.find(function(r){return r.id==='f';})", "reqBase");
    ov("F_EXP", "REALM_DATA.find(function(r){return r.id==='f';})", "gainExp");
    ov("C_REQ", "REALM_DATA.find(function(r){return r.id==='c';})", "reqBase");
    // C_FORGEREQ sweeps SETPIECE_DATA.forge.forgeReq (the slice-6 forge home), NOT the
    // removed realms.js c.forge path (the very read that crashed the old sim).
    ov("C_FORGEREQ", "SETPIECE_DATA.forge", "forgeReq");
    ov("BASE_RATE", "BODY_DATA.qi", "baseRate");
    ov("TEMP_RATIO", "BODY_DATA.buyables.find(function(b){return b.key==='temper';})", "costRatio");
    ov("TEMP_BASE", "BODY_DATA.buyables.find(function(b){return b.key==='temper';})", "costBase");
    ov("PRIM_RATIO", "BODY_DATA.buyables.find(function(b){return b.key==='primaryMeridian';})", "costRatio");
    if (swept) boot("updateTemp(); updateTemp();");
}

// ---------------------------------------------------------------------------
// Data-derived constants read ONCE out of the booted tables (binding, not
// duplication: these are reads of the loaded data globals, the values the engine
// itself uses).
// ---------------------------------------------------------------------------
function readDataConstants() {
    return {
        primaryId: valOf("BODY_DATA.buyables.find(function(b){return b.key==='primaryMeridian';}).id"),
        extraId: valOf("BODY_DATA.buyables.find(function(b){return b.key==='extraordinaryMeridian';}).id"),
        temperId: valOf("BODY_DATA.buyables.find(function(b){return b.key==='temper';}).id"),
        primaryLimit: valOf("BODY_DATA.buyables.find(function(b){return b.key==='primaryMeridian';}).limit"),
        extraLimit: valOf("BODY_DATA.buyables.find(function(b){return b.key==='extraordinaryMeridian';}).limit"),
        temperLimit: valOf("BODY_DATA.buyables.find(function(b){return b.key==='temper';}).limit"),
        fUnlockMeridians: valOf("REALM_DATA.find(function(r){return r.id==='f';}).unlock.meridians"),
        temperGateLevel: valOf(
            "BODY_DATA.temperTiers.find(function(t){return t.key==='" +
            ACTOR_POLICY.temperGateTierKey + "';}).fromLevel"),
        temperGradeCap: valOf("REALM_DATA.find(function(r){return r.id==='f';}).grade.temperDenominator"),
        fUnlockQBest: numOf("substageThreshold('q', REALM_DATA.find(function(r){return r.id==='f';}).unlock.realm[1])"),
        fGreatCircle: numOf("substageThreshold('f', 'Great Circle')"),
        extraUnlockQBest: numOf("substageThreshold('q','10th Level')"),
        // Forge fuel requirement — BOUND to coreForgeData() (SETPIECE_DATA.forge reader).
        forgeReq: valOf("coreForgeData().forgeReq"),
        qSubstageAts: valOf("REALM_DATA.find(function(r){return r.id==='q';}).substages.map(function(s){return s.at;})"),
        fSubstageAts: valOf("REALM_DATA.find(function(r){return r.id==='f';}).substages.map(function(s){return s.at;})"),
        cSubstageAts: valOf("REALM_DATA.find(function(r){return r.id==='c';}).substages.map(function(s){return s.at;})"),
        nSubstageAts: valOf("REALM_DATA.find(function(r){return r.id==='n';}).substages.map(function(s){return s.at;})"),
        sSubstageAts: valOf("REALM_DATA.find(function(r){return r.id==='s';}).substages.map(function(s){return s.at;})"),
        // c Core Refined `at` (n's unlock gate), via reader.
        cRefinedAt: numOf("substageThreshold('c','" + ACTOR_POLICY.cRefinedSubstageLabel + "')"),
        // n Apex `at` (s's unlock gate), via reader.
        nApexAt: numOf("substageThreshold('n','" + ACTOR_POLICY.nApexSubstageLabel + "')"),
        // s Great Circle `at` (the tribulation trigger), via reader.
        sTriggerAt: numOf("substageThreshold('s','" + ACTOR_POLICY.sTriggerSubstageLabel + "')"),
        // c / n / s grade-relevant tops (the last substage `at`) — the climb ceilings.
        cTopAt: valOf("(function(){var a=REALM_DATA.find(function(r){return r.id==='c';}).substages;return a[a.length-1].at;})()"),
        nTopAt: valOf("(function(){var a=REALM_DATA.find(function(r){return r.id==='n';}).substages;return a[a.length-1].at;})()"),
        // Legacy daoSeeds denominator (the diligent Seed target, 8) — read from LEGACY_DATA.
        daoSeedTarget: valOf("LEGACY_DATA.actOne.denominators.daoSeeds"),
        // Tribulation pool technique denominator (the diligent technique target).
        techniqueTarget: valOf("SETPIECE_DATA.firstTribulation.pool.techniqueDenominator"),
        // SIM-DUP 4: tribulation bank target Qi = 10^(qiFuelDenominator) inverts the pool's
        // banked-Qi fuel normalizer log10(qi)/qiFuelDenominator (tribulationPreparednessPool)
        // to its saturation Qi. No factory reader exposes the saturation point; the denominator
        // is read live. The factor is a banking POLICY knob (ACTOR_POLICY), not an engine value.
        tribBankTargetQi: Math.pow(10,
            valOf("SETPIECE_DATA.firstTribulation.pool.qiFuelDenominator")
            * ACTOR_POLICY.tribulationBankFuelExponentFactor),
        // The dao layer id and the element-root buyable ids (for diligent Seed buys).
        daoLayerId: valOf("LATTICE_DATA.id"),
        // The scar maxDepth (max-scar profile) — read from SETPIECE_DATA.scar.
        scarMaxDepth: valOf("SETPIECE_DATA.scar.maxDepth"),
        tribDurationSeconds: valOf("SETPIECE_DATA.firstTribulation.durationSeconds")
    };
}

// The next sub-stage `at` above a realm's current best (the breakthrough target),
// or null if best already meets the last sub-stage. Data-derived ladder.
function nextSubstageAbove(ladder, best) {
    for (var i = 0; i < ladder.length; i++) if (ladder[i] > best) return ladder[i];
    return null;
}

// Buyable cost — BOUND, not duplicated (§0.2): calls the layer's own cost(amount)
// function, the exact data-driven cost the engine charges.
function buyableCost(buyableId, ownedAmount) {
    return numOf("layers.b.buyables[" + buyableId + "].cost(new Decimal(" + ownedAmount + "))");
}

// ---------------------------------------------------------------------------
// Live readers against the booted engine. Each is a thin pass-through to a factory
// reader / engine global — no re-implemented economy.
// ---------------------------------------------------------------------------
function qiPerSecond() { return numOf("cultivationQiPerSecond()"); }
function insightPerSecond() { return numOf("insightPerSecond()"); }
function currentQi() { return numOf("player.points"); }
function meridiansOpened() { return numOf("meridiansOpened()"); }
function extraOpened() { return numOf("getBuyableAmount('b'," + DATA.extraId + ")"); }
function temperLevelNow() { return numOf("temperLevel()"); }
function qBest() { return numOf("realmBest('q')"); }
function fBest() { return numOf("realmBest('f')"); }
function cBest() { return numOf("realmBest('c')"); }
function nBest() { return numOf("realmBest('n')"); }
function sBest() { return numOf("realmBest('s')"); }
function fPoints() { return numOf("player.f && player.f.unlocked ? player.f.points : new Decimal(0)"); }
function insightBanked() { return numOf("player.dao && player.dao.unlocked ? player.dao.points : new Decimal(0)"); }
function qUnlocked() { return !!valOf("player.q.unlocked"); }
function fUnlocked() { return !!valOf("player.f.unlocked"); }
function cUnlocked() { return !!valOf("player.c.unlocked"); }
function nUnlocked() { return !!valOf("player.n.unlocked"); }
function sUnlocked() { return !!valOf("player.s.unlocked"); }
function coreIsForged() { return !!valOf("coreIsForged()"); }
function daoIsRevealed() { return !!valOf("daoIsRevealed()"); }
function sectIsRevealed() { return !!valOf("sectIsRevealed()"); }
function sectJoined() { return !!valOf("sectJoined()"); }
function aspectChosen() { return valOf("getSoulAspectKey()") !== ""; }
function heldDaoSeeds() { return numOf("heldDaoSeedCount()"); }
function ownedTechniques() { return numOf("ownedTechniqueCount()"); }
function tribulationReady() { return !!valOf("tribulationIsReady()"); }
function tribulationActive() { return !!valOf("tribulationIsActive()"); }
function tribulationPassed() { return !!valOf("tribulationPassed()"); }
function scarDepthNow() { return numOf("scarDepth()"); }
function scarHealedDepthNow() { return numOf("scarHealedDepth()"); }
function scarIsActiveNow() { return !!valOf("scarIsActive()"); }
function temperedQiMultNow() { return numOf("temperedQiMult()"); }

// meets(condition) — the engine's own uniform unlock evaluator (binding, §0.2).
function meetsFUnlock() { return !!valOf("meets(REALM_DATA.find(function(r){return r.id==='f';}).unlock)"); }
function meetsCUnlock() { return !!valOf("meets(REALM_DATA.find(function(r){return r.id==='c';}).unlock)"); }
function meetsNUnlock() { return !!valOf("meets(REALM_DATA.find(function(r){return r.id==='n';}).unlock)"); }
function meetsSUnlock() { return !!valOf("meets(REALM_DATA.find(function(r){return r.id==='s';}).unlock)"); }
function meetsExtraUnlock() {
    return !!valOf("meets(BODY_DATA.buyables.find(function(b){return b.key==='extraordinaryMeridian';}).unlock)");
}
function temperGateMet() {
    return !!valOf("meets({temperTier:'" + ACTOR_POLICY.temperGateTierKey + "'})");
}

// getResetGain — the engine's own prestige-gain function (binding, §0.2).
function resetGain(layerId) { return numOf("getResetGain('" + layerId + "')"); }

// qiForTargetGain — the Qi a "normal" prestige layer needs for getResetGain to reach
// (at least) targetGain. The analytic inverse of the gain formula, used ONLY to pick
// the time-step boundary; the ACTUAL breakthrough still goes through doReset/getResetGain.
//
// SIM-DUP 2: re-implements Qi = reqBase * (targetGain / gainMult)^(1/gainExp).
// REASON: the engine exposes getNextAt only for resetGain+1 (the very next integer of
// gain), not for an ARBITRARY target gain; the event-stepper needs the Qi for a target
// gain to advance time in one analytic jump. reqBase/gainExp/gainMult are read live from
// the booted layer (tmp), so the inverse tracks any swept data; it is a boundary estimate
// only (q/f/c/n/s are all uniform "normal" layers, gainMult identity except graded f).
function qiForTargetGain(layerId, targetGain) {
    var reqBase = numOf("layers." + layerId + ".requires()");
    var gainExp = numOf("REALM_DATA.find(function(r){return r.id==='" + layerId + "';}).gainExp");
    var gainMult = numOf("tmp." + layerId + ".gainMult");
    if (gainMult <= 0 || gainExp <= 0) return Infinity;
    var qi = reqBase * Math.pow(targetGain / gainMult, 1 / gainExp);
    // A realm CANNOT break below reqBase Qi (the engine's canReset gate is points >= reqBase),
    // so a sub-reqBase analytic boundary (when targetGain/gainMult < 1) is non-physical: clamp
    // to reqBase. Binds to the engine's own canReset floor (layers.<id>.requires()).
    return qi < reqBase ? reqBase : qi;
}

// The Qi to break a realm to (at least) a target best (above its current points). Overshoots
// the analytic gain by one whole unit so the engine's FLOORED getResetGain lands AT or above
// the target substage (a fractional analytic gain of 7.99 floors to 7 and would stall one short
// of an 8-gap substage; banking for gain+1 closes that). The actual gain banked is always the
// engine's getResetGain at the boundary — this only sizes the wait.
function qiForTargetBest(layerId, targetBest) {
    var currentPoints = numOf("player." + layerId + ".points");
    var gainNeeded = Math.max(targetBest - currentPoints + ACTOR_POLICY.qBreakthroughMinGain,
        ACTOR_POLICY.qBreakthroughMinGain);
    return qiForTargetGain(layerId, gainNeeded);
}

// The per-break bank target for a realm climb: reqBase * realmBreakBankFactor (the small,
// frequent break, see realmBreakBankFactor).
function realmBreakBankTarget(layerId) {
    var reqBase = numOf("layers." + layerId + ".requires()");
    return reqBase * ACTOR_POLICY.realmBreakBankFactor;
}

// Read a realm's gain parameters live from the booted layer (binding, §0.2).
function realmGainParams(layerId) {
    return {
        reqBase: numOf("layers." + layerId + ".requires()"),
        gainExp: numOf("REALM_DATA.find(function(r){return r.id==='" + layerId + "';}).gainExp"),
        gainMult: numOf("tmp." + layerId + ".gainMult")
    };
}

// The SIM-TIME to accumulate `pointsToAdd` of a realm's currency via MANY small breaks at the
// current (constant-within-band) Qi/sec, the optimal small-break play (see realmBreakBankFactor).
// Each break banks reqBase*factor Qi and yields gain = (factor)^gainExp * gainMult; breaks needed
// = pointsToAdd / gainPerBreak; time = breaks * (reqBase*factor) / rate.
//
// SIM-DUP 3: re-implements the many-small-break TIME integral (breaks * bankQi / rate), using the
// gain formula gain=(Qi/reqBase)^gainExp*gainMult. REASON: the engine performs ONE doReset per
// call (one sqrt-gain), and exposes no "advance N breaks over T seconds" surface; the event-stepper
// needs the elapsed time for a whole substage band's worth of small breaks in one analytic jump
// (running thousands of real doResets blows the 30s wall budget). reqBase/gainExp/gainMult are read
// LIVE from the booted layer, so the integral tracks any swept data; it is a TIME estimate only —
// the engine STATE advance below still goes through a real doReset (keep rules / milestones fire).
function timeForRealmPoints(layerId, pointsToAdd, rate) {
    if (rate <= 0) return Infinity;
    var params = realmGainParams(layerId);
    var factor = ACTOR_POLICY.realmBreakBankFactor;
    var gainPerBreak = Math.pow(factor, params.gainExp) * params.gainMult;
    if (gainPerBreak <= 0) return Infinity;
    var breaks = pointsToAdd / gainPerBreak;
    var bankQiPerBreak = params.reqBase * factor;
    return breaks * bankQiPerBreak / rate;
}

// Advance a realm's best to a TARGET (one analytic step + one engine doReset). Computes the elapsed
// time for the many small breaks that carry best from current to `target` (timeForRealmPoints, the
// optimal play, SIM-DUP 3), advances the sim clock, then advances the engine STATE with a SINGLE
// real doReset sized to land best at the target (so keep rules, the graded onPrestige hook, and the
// milestone cascade fire through the engine, not a hand-set best). Returns true if it climbed. The
// Qi the engine "spends" on that single big doReset is the one-break-equivalent (quadratically
// larger than the small-break path), but it is only the engine's internal accounting — the sim's
// CLOCK uses the efficient small-break integral, and the resulting best / milestone / grade state is
// identical to the small-break path. (One doReset per call keeps wall-time bounded — the spec's
// large-analytic-jump time model.)
function climbRealmTo(state, layerId, target) {
    var best = numOf("realmBest('" + layerId + "')");
    if (best >= target) return false;
    // The realm must be unlocked (latched, or its meets() gate currently passes) to climb. Do NOT
    // gate on canReset here — canReset wants Qi >= reqBase, but the sim banks analytically and keeps
    // Qi near 0 between bands; the doReset below sets the needed Qi just-in-time.
    var unlocked = valOf("player." + layerId + ".unlocked")
        || valOf("meets(REALM_DATA.find(function(r){return r.id==='" + layerId + "';}).unlock)");
    if (!unlocked) return false;

    var points = numOf("player." + layerId + ".points");
    var pointsToAdd = target - points;
    if (pointsToAdd <= 0) pointsToAdd = ACTOR_POLICY.qBreakthroughMinGain;
    var rate = qiPerSecond();   // natural climbing rate (Qi ~ 0) — the banking rate the integral uses
    if (rate <= 0) return false;

    var dt = timeForRealmPoints(layerId, pointsToAdd, rate);
    if (!isFinite(dt)) return false;

    var oneBreakQi = qiForTargetGain(layerId, pointsToAdd);
    setQi(oneBreakQi);
    refreshTemp();
    if (!valOf("layers." + layerId + ".canReset()")) { setQi(0); refreshTemp(); return false; }
    state.seconds += dt;       // commit the clock only once the state advance will happen
    advanceTrickle(dt);
    prestige(layerId);
    setQi(0);                  // the small-break play consumed the banked Qi as it went; no big pile
    refreshTemp();
    return true;
}

// Climb ONE substage band (the next `at` above current best). Used for n/s where each substage is a
// reported mark (SF peak, etc.); the per-band granularity keeps the marks accurate.
function climbRealmBand(state, layerId, ladder, topAt) {
    var best = numOf("realmBest('" + layerId + "')");
    if (best >= topAt) return false;
    var nextAt = nextSubstageAbove(ladder, best);
    if (nextAt === null) return false;
    return climbRealmTo(state, layerId, Math.min(nextAt, topAt));
}

// ---------------------------------------------------------------------------
// Engine WRITES (all via engine code; tmp refreshed after each). State is never
// hand-zeroed — breakthroughs go through doReset so keep rules apply.
// ---------------------------------------------------------------------------
function setQi(amount) { boot("player.points = new Decimal(" + amount + ");"); }
function refreshTemp() { boot("updateTemp(); updateTemp();"); }
function buyMeridian(buyableId) {
    boot("buyBuyable('b', " + buyableId + ");");
    refreshTemp();
}
function prestige(layerId) {
    boot("doReset('" + layerId + "');");
    boot("updateMilestones('q'); updateMilestones('f'); updateMilestones('c'); updateMilestones('n'); updateMilestones('s');");
    refreshTemp();
}
function forgeSteady() {
    // performForge with the Steady push option — crackChance 0, so Math.random()<0 is
    // never true: deterministic (spec §0.3). Binds to performForge / coreForgeData.
    boot("performForge(coreForgeData().pushOptions[0]);");
    refreshTemp();
}

// Advance the engine's OWN per-layer trickle (Insight, Contribution) across an idle dt.
// The dao layer accrues insightPerSecond()*diff in its update(diff); the sect layer
// accrues contributionPerSecond()*diff. The Body layer's update runs scarHealTick. We
// drive each layer's real update once with the whole dt (the rates are constant across
// the analytic step, exactly as Qi is) — binding to the engine's accrual, not a copy.
function advanceTrickle(dt) {
    if (daoIsRevealed()) boot("if (layers.dao && layers.dao.update) layers.dao.update.call({layer:'dao'}, " + dt + ");");
    if (sectJoined()) {
        boot("if (layers.sect && layers.sect.update) layers.sect.update.call({layer:'sect'}, " + dt + ");");
        // The OTHER_LAYERS sweep keeps sect.best = max(best, points) each tick (game.js);
        // mirror that high-water latch so the contribution milestones (stipend/library/
        // arsenal) earn (bound to the engine's own best-tracking semantics).
        boot("if (player.sect && player.sect.points.gt(player.sect.best)) player.sect.best = player.sect.points;");
        boot("updateMilestones('sect');");
    }
    refreshTemp();
}

const DATA = (function () {
    applyAllEnvOverrides();
    return readDataConstants();
})();

// ---------------------------------------------------------------------------
// SIM STATE / EVENT LOOP / POLICY (clean separation).
//   - SimState: the sim's own bookkeeping (seconds elapsed, marks). The GAME state
//     lives in the engine (player/tmp); this is just the clock + report.
//   - profile-aware decision helpers spend/break/forge whatever is affordable now.
//   - runProfile(profile): the event-stepped loop, fresh life → tribulation → heal.
// ---------------------------------------------------------------------------
function makeSimState() {
    return {
        seconds: 0,
        marks: {},                 // name -> sim-seconds first reached
        // Runaway tripwire (NOT a target): generous enough to clear the observed spine-only
        // ~130h tribulation pass (the slowest profile on current data) but bounded so a genuine
        // runaway (a profile that never terminates) still halts the sim. The observed times are
        // a rule-0.1 finding the --report table surfaces; this cap is a sim guard, not a budget.
        maxSeconds: 60 * 60 * 300,
        forcedScar: false,         // max-scar: whether the maxDepth force has fired
        tribAttempts: 0,
        terminalState: "running"   // set by finishRun: "tribPassed" / "timedOut" / "stuck"
    };
}
function mark(state, name) {
    if (state.marks[name] === undefined) state.marks[name] = state.seconds;
}

// Record marks as the run crosses them. Thresholds are data-derived (DATA.*).
function recordMarks(state) {
    if (temperGateMet()) mark(state, "tendon");
    if (meetsFUnlock()) mark(state, "f_unlock");
    if (fBest() >= DATA.fGreatCircle) mark(state, "f_greatCircle");
    if (meridiansOpened() >= DATA.primaryLimit) mark(state, "primary_max");
    if (daoIsRevealed()) mark(state, "lattice_reveal");
    if (valOf("getFoundationGradeIndex()") >= 0) mark(state, "foundation");
    if (coreIsForged()) mark(state, "forge");
    if (nUnlocked()) mark(state, "ns_unlock");
    if (aspectChosen()) mark(state, "aspect");
    if (sUnlocked()) mark(state, "sf_unlock");
    if (sBest() >= DATA.sTriggerAt) mark(state, "sf_peak");
}

// ---------------------------------------------------------------------------
// BODY BUILD (the q/f-era policy, ported from Phase B; rule-0.1 payback budget).
// ---------------------------------------------------------------------------
function paysBackInBudget(buyableId, owned) {
    var rate = qiPerSecond();
    if (rate <= 0) return true;
    var cost = buyableCost(buyableId, owned);
    return (cost / rate) <= ACTOR_POLICY.bodyBuyPaybackSeconds;
}
function wantNextPrimaryForGrade() {
    var owned = meridiansOpened();
    if (owned >= DATA.primaryLimit) return false;
    return paysBackInBudget(DATA.primaryId, owned);
}
function wantNextTemperForGrade() {
    var owned = temperLevelNow();
    if (owned >= DATA.temperGradeCap || owned >= DATA.temperLimit) return false;
    return paysBackInBudget(DATA.temperId, owned);
}
function bodyBuildIncomplete() {
    if (wantNextTemperForGrade()) return true;
    if (wantNextPrimaryForGrade()) return true;
    return false;
}

// The single buyable the policy most wants to buy next, or null. (Identical to Phase B
// up to the forge; after the forge the body is built so this returns the opportunistic
// fill only.)
function nextWantedBuyable() {
    var primary = meridiansOpened();
    var temper = temperLevelNow();
    var extra = extraOpened();
    if (ACTOR_POLICY.meridianGateForFoundation && primary < DATA.fUnlockMeridians && primary < DATA.primaryLimit) {
        return { id: DATA.primaryId, owned: primary, cost: buyableCost(DATA.primaryId, primary) };
    }
    if (temper < DATA.temperGateLevel && temper < DATA.temperLimit) {
        return { id: DATA.temperId, owned: temper, cost: buyableCost(DATA.temperId, temper) };
    }
    var foundationClimbed = !fUnlocked() || (fBest() >= DATA.fGreatCircle);
    if (foundationClimbed && wantNextPrimaryForGrade()) {
        return { id: DATA.primaryId, owned: primary, cost: buyableCost(DATA.primaryId, primary) };
    }
    if (foundationClimbed && wantNextTemperForGrade()) {
        return { id: DATA.temperId, owned: temper, cost: buyableCost(DATA.temperId, temper) };
    }
    if (primary >= DATA.primaryLimit && extra < DATA.extraLimit && meetsExtraUnlock()) {
        return { id: DATA.extraId, owned: extra, cost: buyableCost(DATA.extraId, extra) };
    }
    return null;
}

function applyBuys() {
    var acted = false;
    var guard = 0;
    while (guard < 200) {
        guard++;
        var want = nextWantedBuyable();
        if (!want) break;
        if (currentQi() < want.cost) break;
        buyMeridian(want.id);
        acted = true;
    }
    return acted;
}

// ---------------------------------------------------------------------------
// HORIZONTAL SYSTEMS (diligent / max-scar; spine-only skips all of these).
// ---------------------------------------------------------------------------

// Join the sect at reveal (archetype = first row; documented choice: SECT_DATA.archetypes[0]
// = Azure Sword, metal element — so the sect lattice discount, the diligent metal Seed buys,
// and the metalSoul aspect all align). Bound to the engine's archetype-pick clickable.
function joinSectIfReady(profile) {
    if (!profile.joinsSect) return false;
    if (sectJoined()) return false;
    if (!sectIsRevealed()) return false;
    boot("clickClickable('sect', 0);");  // archetype index 0 (Azure Sword), via the engine clickable
    refreshTemp();
    return sectJoined();
}

// Diligent element target = the sect archetype's element (metal for Azure Sword). The
// element-root node is the cheapest Seed of that element; buying its Seed (tier 2) both
// reaches the daoElementTier gate for the matching Soul Aspect AND counts toward the
// daoSeeds legacy axis. Read the archetype element from the data (bound, not hardcoded).
function diligentAspectElement() {
    return valOf("(SECT_DATA.archetypes[0] && SECT_DATA.archetypes[0].element) || 'metal'");
}

// The next lattice node the diligent actor wants to buy (cheapest affordable, prioritizing
// element-root Seeds of its aspect element toward the daoSeeds target). Returns {buyableId,
// cost} or null. Cost is the engine's OWN node cost() (folds sectLatticeDiscount, §0.2).
function nextWantedLatticeNode(profile) {
    if (!profile.opensLattice) return null;
    if (!daoIsRevealed()) return null;
    if (heldDaoSeeds() >= DATA.daoSeedTarget) return null;
    // Build the candidate list from the live lattice: each node's next tier (Glimpse then
    // Seed), its cost via the engine's cost(), and whether its requires are met. Prefer the
    // aspect element's root first (so the aspect Seed lands by first n breakthrough), then
    // cheapest-first across all nodes toward the Seed target.
    var element = diligentAspectElement();
    var plan = valOf(
        "(function(el){" +
        "  var out=[];" +
        "  LATTICE_DATA.nodes.forEach(function(node){" +
        "    var owned=getBuyableAmount('" + DATA.daoLayerId + "',node.buyableId).toNumber();" +
        "    if(owned>=node.costs.length) return;" +              // fully owned (Seed held)
        "    var reqMet=node.requires.every(function(k){" +
        "      var rn=LATTICE_DATA.nodes.find(function(n){return n.key===k;});" +
        "      return rn && getBuyableAmount('" + DATA.daoLayerId + "',rn.buyableId).gte(1);" +
        "    });" +
        "    if(!reqMet) return;" +
        "    var cost=layers." + DATA.daoLayerId + ".buyables[node.buyableId].cost(new Decimal(owned)).toNumber();" +
        "    out.push({id:node.buyableId,cost:cost,owned:owned,element:node.element,isRoot:node.requires.length===0});" +
        "  });" +
        "  return out;" +
        "})('" + element + "')");
    if (!plan || plan.length === 0) return null;
    // Priority: the aspect element's root toward its Seed (owned<2), cheapest; then any
    // node cheapest-first toward the Seed target.
    var best = null;
    plan.forEach(function (candidate) {
        var isAspectRootSeed = candidate.isRoot && candidate.element === element && candidate.owned < 2;
        var score = (isAspectRootSeed ? 0 : 1) * 1e18 + candidate.cost;
        if (best === null || score < best.score) {
            best = { id: candidate.id, cost: candidate.cost, score: score };
        }
    });
    return best ? { buyableId: best.id, cost: best.cost } : null;
}

function applyLatticeBuys(profile) {
    if (!profile.opensLattice || !daoIsRevealed()) return false;
    var acted = false;
    var guard = 0;
    while (guard < 100) {
        guard++;
        var want = nextWantedLatticeNode(profile);
        if (!want) break;
        if (insightBanked() < want.cost) break;
        boot("buyBuyable('" + DATA.daoLayerId + "', " + want.buyableId + ");");
        refreshTemp();
        acted = true;
    }
    return acted;
}

// Buy cheapest affordable techniques to the pool's techniqueDenominator count (diligent).
// Contribution is player.sect.points; the engine's buyUpg deducts it. Bound to the engine's
// upgrade purchase path; the visible/affordable set is read from the live techniqueVisible.
function applyTechniqueBuys(profile) {
    if (!profile.buysTechniques || !sectJoined()) return false;
    if (ownedTechniques() >= DATA.techniqueTarget) return false;
    var acted = false;
    var guard = 0;
    while (guard < 20) {
        guard++;
        if (ownedTechniques() >= DATA.techniqueTarget) break;
        // Cheapest visible, unowned, affordable technique index, or -1.
        var pick = valOf(
            "(function(){" +
            "  var bestIndex=-1; var bestCost=Infinity; var bal=player.sect.points;" +
            "  TECHNIQUE_DATA.forEach(function(t,i){" +
            "    if(hasUpgrade('sect',i)) return;" +
            "    if(!techniqueVisible(t)) return;" +
            "    var c=new Decimal(t.cost);" +
            "    if(bal.gte(c) && t.cost<bestCost){bestCost=t.cost;bestIndex=i;}" +
            "  });" +
            "  return bestIndex;" +
            "})()");
        if (pick < 0) break;
        boot("buyUpg('sect', " + pick + ");");
        refreshTemp();
        acted = true;
    }
    return acted;
}

// Breathing Trance ON when: lattice revealed AND Seed target unmet AND not in any of the
// three spec-named banking phases (f pre-Great-Circle, forge fuel, tribulation Qi bank —
// computed by the main loop). Bound to the engine's stance toggle.
function manageStance(profile, banking) {
    if (!profile.usesStance) return;
    if (!daoIsRevealed()) return;
    var wantOn = (heldDaoSeeds() < DATA.daoSeedTarget) && !banking;
    var isOn = valOf("player.dao.activeStance === '" + ACTOR_POLICY.breathingTranceStanceKey + "'");
    if (wantOn && !isOn) {
        // Toggle on via the stance clickable (find Breathing Trance's clickableId from data).
        boot("(function(){var st=STANCE_DATA.stances.find(function(s){return s.key==='" +
            ACTOR_POLICY.breathingTranceStanceKey + "';}); if(st) clickClickable('dao', st.clickableId);})();");
        refreshTemp();
    } else if (!wantOn && isOn) {
        boot("(function(){var st=STANCE_DATA.stances.find(function(s){return s.key==='" +
            ACTOR_POLICY.breathingTranceStanceKey + "';}); if(st) clickClickable('dao', st.clickableId);})();");
        refreshTemp();
    }
}

// Pick the Soul Aspect on first n breakthrough (spec §C3): the highest-credit choice the
// state allows. Element aspect if its daoElementTier gate is met (diligent with the element
// Seed), else Formless (the completability floor — spine-only ALWAYS lands here, C4). Bound
// to the engine's aspect clickables + meets() gate; never a hand-set key.
function pickAspectIfReady() {
    if (aspectChosen()) return false;
    if (!valOf("tmp.n.clickables[0].unlocked")) return false; // aspect clickables not yet shown
    // Find the highest-credit pickable aspect: an element aspect (element != null) whose gate
    // meets() passes is depth-2 (best); Formless is depth-1; pick the deepest available.
    var chosenIndex = valOf(
        "(function(){" +
        "  var realm=REALM_DATA.find(function(r){return r.soulAspect;});" +
        "  var aspects=realm.soulAspect.aspects; var pick=-1; var pickDepth=-1;" +
        "  aspects.forEach(function(a,i){" +
        "    if(!meets(a.requires)) return;" +
        "    var depth=(a.element!==null&&a.element!==undefined)?2:1;" +
        "    if(depth>pickDepth){pickDepth=depth;pick=i;}" +
        "  });" +
        "  return pick;" +
        "})()");
    if (chosenIndex < 0) return false;
    boot("clickClickable('n', " + chosenIndex + ");");
    refreshTemp();
    return aspectChosen();
}

// ---------------------------------------------------------------------------
// REALM CLIMB (uniform: q/f/c/n/s all break through via doReset on Qi). Each phase
// climbs the active realm toward its data-derived target substage. Returns true if a
// breakthrough fired (so the loop re-evaluates the rate).
// ---------------------------------------------------------------------------

// q: climb toward 6th Level to unlock f, then stop (f.points is the Foundation currency).
function applyQBreakthrough() {
    if (!qUnlocked() || fUnlocked()) return false;
    if (ACTOR_POLICY.meridianGateForFoundation && meridiansOpened() < DATA.fUnlockMeridians) return false;
    var targetBest = nextSubstageAbove(DATA.qSubstageAts, qBest());
    if (targetBest === null) return false;
    var gain = resetGain("q");
    if (gain < ACTOR_POLICY.qBreakthroughMinGain) return false;
    var wouldBe = numOf("player.q.points") + gain;
    if (wouldBe < targetBest) return false;
    if (!valOf("layers.q.canReset()")) return false;
    prestige("q");
    return true;
}

// f: PHASE 1 climb to Great Circle (unconditional cheap breaks that lift Qi/sec), PHASE 2
// pause for the body build, PHASE 3 bank fuel toward the forge requirement.
function applyFBreakthrough() {
    if (!fUnlocked()) return false;
    var wantBest = fBest() < DATA.fGreatCircle;
    // Fuel banking is a PRE-FORGE pursuit only (it feeds the one-time forge). Once the core is
    // forged, f.points is spent and never re-banked — post-forge, f is climbed for its realmMult
    // (the best-climb) alone, and only while it pays back: re-climbing f after each higher-realm
    // cascade rebuilds the f realmMult that the cascade wiped. After n-milestone-2 f.best survives
    // n-resets (the keep rule), so this re-climb naturally stops firing.
    var wantFuel = !coreIsForged() && fPoints() < DATA.forgeReq;
    if (!wantBest && !wantFuel) return false;
    if (!wantBest && bodyBuildIncomplete()) return false;
    var gain = resetGain("f");
    if (gain < ACTOR_POLICY.fBreakthroughMinGain) return false;
    var fuelNeeded = Math.max(DATA.forgeReq - fPoints(), 0);
    var nextFAt = nextSubstageAbove(DATA.fSubstageAts, fBest());
    var wouldBeBest = numOf("player.f.points") + gain;
    var meaningful = false;
    if (wantBest && nextFAt !== null && wouldBeBest >= nextFAt) meaningful = true;
    if (!wantBest && wantFuel && gain >= ACTOR_POLICY.fBreakthroughMinGain && fuelNeeded > 0) meaningful = true;
    if (wantBest && wantFuel && gain >= ACTOR_POLICY.fBreakthroughMinGain && nextFAt === null) meaningful = true;
    if (!meaningful) return false;
    if (!valOf("layers.f.canReset()")) return false;
    prestige("f");
    return true;
}

// c: after the forge, climb c straight to its grade-relevant top (Core Tempered), RE-climbed after
// every higher-realm cascade wipes it. This is the competent play, NOT churn: the n/s breaks need
// an enormous accumulated Qi bank, and the c realmMult (Core Tempered 2x) plus the f realmMult
// (~2.7x) multiply the BANKING RATE; re-climbing c+f (cheap) before banking the big pile is far
// faster overall. Straight-to-top (one doReset) — c has no per-substage reported mark, so the
// substage granularity is unnecessary and the single jump keeps wall-time bounded.
function applyCBreakthrough(state) {
    if (!coreIsForged()) return false;          // c is climbed by prestige only after forging
    return climbRealmTo(state, "c", DATA.cTopAt);
}

// n: climb toward Perfected (its top), with Apex as the s-unlock gate. Aspect is picked on the
// FIRST breakthrough (handled by pickAspectIfReady after the first prestige).
// n/s climb ONLY once the rate is restored (f at Great Circle, c at its top) — so the band-climb's
// banking integral runs at the peak rate, not the cascade-cratered rate. The aspect must also be
// chosen first (the first n break exposes it). rateRestored() gates this.
function rateRestored() {
    return coreIsForged()
        && fBest() >= DATA.fGreatCircle
        && cBest() >= DATA.cTopAt;
}
function applyNBreakthrough(state) {
    if (!nUnlocked()) return false;
    // First n break is required to EXPOSE the aspect; allow it even before the rate is restored
    // (best is 0). After that, only climb n once the rate is restored.
    if (nBest() > 0 && !rateRestored()) return false;
    return climbRealmBand(state, "n", DATA.nSubstageAts, DATA.nTopAt);
}

// s: climb toward Great Circle (the tribulation trigger). Stop there — banking + the
// tribulation are handled by the loop's terminal logic.
function applySBreakthrough(state) {
    if (!sUnlocked()) return false;
    if (!rateRestored()) return false;
    return climbRealmBand(state, "s", DATA.sSubstageAts, DATA.sTriggerAt);
}

// ---------------------------------------------------------------------------
// NEXT Qi BOUNDARY — the cheapest Qi target among all currently-wanted actions, so the
// idle accrual jumps exactly to the next decision. All thresholds data-derived. Returns
// +Infinity if the policy has nothing left to wait for (terminal / stuck).
// ---------------------------------------------------------------------------
function nextQiTarget(profile, phase) {
    var targets = [];
    var want = nextWantedBuyable();
    if (want) targets.push(want.cost);

    if (!qUnlocked()) {
        targets.push(numOf("REALM_DATA.find(function(r){return r.id==='q';}).unlock.qi"));
    }
    // q climb toward 6th Level (only while f is still locked).
    if (qUnlocked() && !fUnlocked()
        && !(ACTOR_POLICY.meridianGateForFoundation && meridiansOpened() < DATA.fUnlockMeridians)) {
        var qNext = nextSubstageAbove(DATA.qSubstageAts, qBest());
        if (qNext !== null) targets.push(qiForTargetBest("q", qNext));
    }
    // f climb / fuel. Fuel banking is pre-forge only; post-forge f is climbed for realmMult.
    if (fUnlocked()) {
        var wantBest = fBest() < DATA.fGreatCircle;
        var wantFuel = !coreIsForged() && fPoints() < DATA.forgeReq;
        var nextFAt = nextSubstageAbove(DATA.fSubstageAts, fBest());
        if (wantBest && nextFAt !== null) {
            targets.push(qiForTargetGain("f",
                Math.max(nextFAt - numOf("player.f.points"), ACTOR_POLICY.fBreakthroughMinGain)));
        } else if (!wantBest && wantFuel && !bodyBuildIncomplete()) {
            targets.push(qiForTargetGain("f",
                Math.max(DATA.forgeReq - fPoints(), ACTOR_POLICY.fBreakthroughMinGain)));
        }
    }
    // NOTE: the c/n/s climbs are driven by climbRealmBand (analytic per-substage-band time +
    // one engine doReset), which advances the clock itself — they are NOT idle-step boundaries.
    // Only the pre-forge q/f climb and the body buys use the Qi-boundary idle stepper here.
    // Tribulation Qi bank: once s is at the trigger and the tribulation is ready, bank Qi
    // toward the fuel target so the pool's fuel term is full when we begin.
    if (phase === "bankTribulation") {
        targets.push(DATA.tribBankTargetQi);
    }

    if (targets.length === 0) return Infinity;
    var minTarget = targets[0];
    for (var i = 1; i < targets.length; i++) if (targets[i] < minTarget) minTarget = targets[i];
    return minTarget;
}

// Forge readiness (unchanged from Phase B): c unlocked + body built + fuel banked + not forged.
function forgeReady() {
    if (coreIsForged()) return false;
    if (!cUnlocked()) return false;
    if (bodyBuildIncomplete()) return false;
    return fPoints() >= DATA.forgeReq;
}

// ---------------------------------------------------------------------------
// TRIBULATION + SCAR HEAL — the bounded-fine-tick phases (spec time model).
// ---------------------------------------------------------------------------

// Force the scar to maxDepth (max-scar profile, spec §C3 §6.2). Drives the engine's OWN
// deepenScar() repeatedly — the same transition a Failed run fires — never a hand-set depth.
function forceMaxScar(state) {
    if (state.forcedScar) return;
    // Deepen maxDepth times (deepenScar() self-caps at maxDepth, so this lands exactly at the cap).
    boot("for (var fd = 0; fd < SETPIECE_DATA.scar.maxDepth; fd++) { deepenScar(); }");
    refreshTemp();
    state.forcedScar = true;
}

// Run the tribulation: begin (consumes banked Qi as fuel), then drive the s layer's REAL
// update(diff) for durationSeconds + a margin of 1-second ticks (the same loop the smoke
// harness drives), advancing sim-seconds. Bounded by the data duration. Returns the grade
// index and whether it passed.
function runTribulation(state) {
    state.tribAttempts++;
    boot("var prepPool = tribulationPreparednessPool(); beginTribulation();");
    var ticks = DATA.tribDurationSeconds + ACTOR_POLICY.tribulationTickMarginSeconds;
    for (var t = 0; t < ticks; t++) {
        boot("layers.s.update.call({layer:'s'}, 1);");
        state.seconds += 1;
    }
    refreshTemp();
    return {
        passed: tribulationPassed(),
        gradeIndex: valOf("tribulationGradeIndex()")
    };
}

// Drain the post-Failed retry cooldown by driving the engine's tribulationTick (which counts
// the cooldown down on the diff clock). Bounded; advances sim-seconds. Bound to the engine's
// own cooldown transition.
function drainTribulationCooldown(state) {
    var guard = 0;
    while (numOf("tribulationCooldownUntil()") > 0 && guard < 10000) {
        guard++;
        boot("tribulationTick(1);");
        state.seconds += 1;
    }
    refreshTemp();
}

// Heal the scar fully: drive the engine's OWN scarHealTick(1) until depth === healedDepth
// (the heal arc), bounded by scarHealMaxTicks. Advances sim-seconds. Bound to scarHealTick.
function healScarFully(state) {
    if (!scarIsActiveNow()) return;
    var guard = 0;
    while (scarIsActiveNow() && guard < ACTOR_POLICY.scarHealMaxTicks) {
        guard++;
        boot("scarHealTick(1);");
        state.seconds += 1;
    }
    refreshTemp();
    mark(state, "heal_complete");
}

// ---------------------------------------------------------------------------
// runProfile — the full event-stepped ascent for one actor profile.
// ---------------------------------------------------------------------------
function runProfile(profileKey) {
    var profile = PROFILES[profileKey];
    // Fresh engine state for this run: reset player to start data and rebuild tmp. We do
    // NOT re-run setupTemp() (bootEngine already did, once): a second setupTemp re-wraps the
    // buyable cost closures recursively. updateTemp() recomputes tmp from the fresh player.
    boot("updateLayers(); player = getStartPlayer(); options = getStartOptions ? getStartOptions() : {};");
    boot("needCanvasUpdate = false; updateTemp(); updateTemp();");

    var state = makeSimState();
    var stuckGuard = 0;
    var loopGuard = 0;

    while (state.seconds < state.maxSeconds && loopGuard < ACTOR_POLICY.eventLoopGuard) {
        loopGuard++;

        // 0. Reveal/unlock latch: realms/horizontal layers unlock the instant their gate is
        //    met. game.js latches on the first doReset; the sim reads unlocked to switch
        //    pursuit, so latch on the engine's OWN meets() gate (no duplicated unlock logic).
        if (!qUnlocked() && !!valOf("meets(REALM_DATA.find(function(r){return r.id==='q';}).unlock)")) {
            boot("player.q.unlocked = true;"); refreshTemp();
        }
        if (!fUnlocked() && meetsFUnlock()) { boot("player.f.unlocked = true;"); refreshTemp(); }
        if (!cUnlocked() && meetsCUnlock()) { boot("player.c.unlocked = true;"); refreshTemp(); }
        if (!nUnlocked() && meetsNUnlock()) { boot("player.n.unlocked = true;"); refreshTemp(); }
        if (!sUnlocked() && meetsSUnlock()) { boot("player.s.unlocked = true;"); refreshTemp(); }
        // The dao/sect layers latch revealed inside their update(); reveal them so their
        // trickle accrues. The dao layer reveals at q 4th Level; the sect at q 2nd Level.
        if (profile.opensLattice && !daoIsRevealed()
            && !!valOf("meets(LATTICE_DATA.unlock)")) {
            boot("player.dao.revealed = true;"); refreshTemp();
        }

        recordMarks(state);

        // 1. Horizontal-system actions (diligent / max-scar only; spine-only skips).
        var actedHoriz = false;
        if (joinSectIfReady(profile)) actedHoriz = true;
        if (applyTechniqueBuys(profile)) actedHoriz = true;
        if (applyLatticeBuys(profile)) actedHoriz = true;

        // 2. Vertical body buys + breakthroughs.
        var acted = false;
        if (applyBuys()) acted = true;
        if (applyQBreakthrough()) acted = true;
        if (applyFBreakthrough()) acted = true;

        // 2a. Forge the first core (the slice-6 set-piece) once ready.
        if (forgeReady()) { forgeSteady(); acted = true; }

        // 2b. POST-FORGE rate restore: re-climb f to Great Circle, then c to its top, BEFORE the
        //     n/s climbs — every n/s breakthrough cascade-wipes f/c, and their realmMults (~2.7x f
        //     at Great Circle, 2x c at Core Tempered) multiply the BANKING RATE, so the competent
        //     player restores them before banking the big n/s pile. These are ANALYTIC band-climbs
        //     (climbRealmBand) that advance the clock themselves. f is graded (its gainMult is the
        //     Foundation grade), which the band-climb reads live. q is left to auto-prestige once NS
        //     grants it (AUTOMATION_DATA) — its realmMult is small and re-climbing it manually each
        //     cascade is not worth the sim/play overhead.
        if (coreIsForged() && fBest() < DATA.fGreatCircle) {
            // Straight to Great Circle (one doReset) — f has no per-substage reported mark in the
            // post-forge re-climb, so the single jump restores the realmMult without churn.
            if (climbRealmTo(state, "f", DATA.fGreatCircle)) acted = true;
        }
        // c → top (re-climbed each cascade to restore rate), then aspect on first n break, then
        // n → Perfected, s → trigger. c is climbed before n/s so the rate is restored.
        if (applyCBreakthrough(state)) acted = true;
        // Pick the aspect the moment the first n breakthrough exposes the clickables.
        if (nUnlocked() && pickAspectIfReady()) acted = true;
        if (applyNBreakthrough(state)) acted = true;
        // After an n prestige the aspect clickables may have JUST appeared (first break) —
        // try the pick again so it never slips a frame.
        if (nUnlocked() && pickAspectIfReady()) acted = true;
        if (applySBreakthrough(state)) acted = true;

        // 3. Terminal arc: at the s trigger sub-stage, bank Qi then face the tribulation.
        var atTrigger = sUnlocked() && sBest() >= DATA.sTriggerAt;
        // The three spec-named banking phases (§C3 diligent bullet) during which Breathing
        // Trance is OFF — the actor wants raw Qi speed, not Insight, while a Qi pile is the
        // pursuit: (1) the f climb pre-Great-Circle (incl. the post-cascade re-climbs),
        // (2) pre-forge fuel banking toward forgeReq, (3) the tribulation Qi bank at s-peak.
        var bankingFClimb = fUnlocked() && fBest() < DATA.fGreatCircle;
        var bankingForgeFuel = fUnlocked() && !coreIsForged() && fPoints() < DATA.forgeReq;
        var bankingTribulation = atTrigger && !tribulationPassed();
        var banking = bankingFClimb || bankingForgeFuel || bankingTribulation;
        manageStance(profile, banking);

        if (atTrigger && !tribulationPassed()) {
            // The earliest moment the trigger sub-stage is reached = the first tribulation attempt
            // window (the player can now face it as soon as Qi is banked).
            mark(state, "tribulation_attempt");
            // Max-scar: force the scar to maxDepth at first tribulation eligibility (spec §C3).
            if (profile.forceMaxScarAtTribulation && tribulationReady()) forceMaxScar(state);

            // Bank Qi toward the fuel target, then trigger when ready + banked.
            var banked = currentQi() >= DATA.tribBankTargetQi;
            if (tribulationReady() && banked) {
                var result = runTribulation(state);
                if (result.passed) {
                    recordMarks(state);
                    mark(state, "tribulation_pass");
                    // Max-scar: complete the heal arc from the forced depth (spec §C3).
                    if (profile.forceMaxScarAtTribulation) healScarFully(state);
                    else if (scarIsActiveNow()) healScarFully(state);  // a Scarred pass also leaves a scar
                    return finishRun(profileKey, state, "tribPassed");
                }
                // A Failed run: drain the retry cooldown, then loop to re-bank and retry.
                drainTribulationCooldown(state);
                acted = true;
            }
        }

        if (actedHoriz || acted) { stuckGuard = 0; continue; }

        // 4. Idle: advance time analytically to the next Qi boundary at the current rate,
        //    batch-applying Qi accrual AND the engine's own Insight/Contribution trickle.
        var rate = qiPerSecond();
        var phase = (atTrigger && !tribulationPassed()) ? "bankTribulation" : "climb";
        var target = nextQiTarget(profile, phase);
        if (!isFinite(target) || rate <= 0) {
            stuckGuard++;
            if (stuckGuard > 4) break;
            // Even with no Qi target, horizontal trickle may unlock the next action; nudge.
            advanceTrickle(1);
            state.seconds += 1;
            continue;
        }
        var have = currentQi();
        if (target <= have) {
            stuckGuard++;
            if (stuckGuard > 4) break;
            setQi(have); refreshTemp();
            continue;
        }
        var dt = (target - have) / rate;
        state.seconds += dt;
        setQi(target);
        advanceTrickle(dt);
        stuckGuard = 0;
    }
    return finishRun(profileKey, state, "timedOut");
}

function finishRun(profileKey, state, terminalState) {
    state.terminalState = state.terminalState === "running" ? terminalState : state.terminalState;
    if (state.terminalState === "running") state.terminalState = terminalState;
    var result = {
        profile: profileKey,
        label: PROFILES[profileKey].label,
        seconds: state.seconds,
        marks: state.marks,
        terminalState: terminalState,
        tribAttempts: state.tribAttempts,
        forcedScar: state.forcedScar,
        qBest: qBest(),
        fBest: fBest(),
        cBest: cBest(),
        nBest: nBest(),
        sBest: sBest(),
        primary: meridiansOpened(),
        extra: extraOpened(),
        temper: temperLevelNow(),
        foundationBand: valOf("getFoundationGradeIndex()"),
        coreForged: coreIsForged(),
        coreGradeIndex: valOf("getCoreGradeIndex()"),
        aspectKey: valOf("getSoulAspectKey()"),
        heldSeeds: heldDaoSeeds(),
        ownedTechniques: ownedTechniques(),
        sectJoined: sectJoined(),
        tribPassed: tribulationPassed(),
        tribGradeIndex: valOf("tribulationGradeIndex()"),
        legacyIndex: valOf("actOneLegacyIndex()"),
        scarDepth: scarDepthNow(),
        scarHealedDepth: scarHealedDepthNow(),
        scarActive: scarIsActiveNow(),
        temperedQiMult: temperedQiMultNow(),
        peakQiPerSec: qiPerSecond()
    };
    return result;
}

// ---------------------------------------------------------------------------
// Reporting helpers.
// ---------------------------------------------------------------------------
function minutes(seconds) { return (seconds / 60).toFixed(1); }
function hours(seconds) {
    if (seconds === undefined) return "   —  ";
    return (seconds / 3600).toFixed(2);
}
function foundationTierLabel(bandIndex) {
    return bandIndex >= 0
        ? valOf("REALM_DATA.find(function(r){return r.id==='f';}).grade.bands[" + bandIndex + "].tier")
        : "none";
}
function coreLabel(result) {
    return result.coreForged
        ? valOf("coreGradeLadder().find(function(g){return g.ceilingIndex===" + result.coreGradeIndex + ";}).label")
        : "none";
}
function tribGradeLabel(result) {
    return result.tribGradeIndex >= 0
        ? valOf("SETPIECE_DATA.firstTribulation.grades[" + result.tribGradeIndex + "].label")
        : "—";
}
function legacyBandLabel(result) {
    return result.legacyIndex >= 0
        ? valOf("LEGACY_DATA.actOne.bands[" + result.legacyIndex + "].label")
        : "—";
}
function aspectLabel(result) {
    if (!result.aspectKey) return "none";
    return valOf("(function(){var r=REALM_DATA.find(function(x){return x.soulAspect;});" +
        "var a=r.soulAspect.aspects.find(function(y){return y.key==='" + result.aspectKey + "';});" +
        "return a?a.label:'" + result.aspectKey + "';})()");
}

// ---------------------------------------------------------------------------
// DEFAULT MODE — run all three profiles, assert STRUCTURAL facts only (pre-pin).
// ---------------------------------------------------------------------------
function printRunDefault(result) {
    console.log("[" + result.label + "] terminal=" + result.terminalState +
        "  at " + hours(result.seconds) + "h (" + minutes(result.seconds) + " min)");
    console.log("  q.best=" + result.qBest + " f.best=" + result.fBest + " c.best=" + result.cBest +
        " n.best=" + result.nBest + " s.best=" + result.sBest +
        "  primary=" + result.primary + " temper=" + result.temper);
    console.log("  foundation=" + foundationTierLabel(result.foundationBand) +
        " core=" + coreLabel(result) +
        " aspect=" + aspectLabel(result) +
        " seeds=" + result.heldSeeds + " techniques=" + result.ownedTechniques +
        " sect=" + (result.sectJoined ? "joined" : "no"));
    console.log("  tribulation=" + (result.tribPassed ? "PASSED" : "not passed") +
        " (" + tribGradeLabel(result) + ", attempts=" + result.tribAttempts + ")" +
        "  legacy=" + legacyBandLabel(result) +
        "  scar depth=" + result.scarDepth + "/healed=" + result.scarHealedDepth +
        " tempered=" + result.temperedQiMult.toFixed(3));
    console.log("  marks(min): " + JSON.stringify(
        Object.fromEntries(Object.entries(result.marks).map(function (entry) {
            return [entry[0], minutes(entry[1])];
        }))));
}

// Structural assertions (spec default mode): each profile reaches a terminal state;
// spine-only passes at any grade; max-scar passes from forced maxDepth, completes the heal
// arc from depth 3, temperedQiMult > 1; diligent passes; legacy q/f marks still print.
function assertStructural(results) {
    var failures = [];
    function req(name, condition) { if (!condition) failures.push(name); }

    var byKey = {};
    results.forEach(function (r) { byKey[r.profile] = r; });

    // Legacy q/f-era coverage (spec §B3) — must hold on every profile's climb.
    PROFILE_ORDER.forEach(function (key) {
        var r = byKey[key];
        req(r.label + ": f_unlock mark recorded", r.marks.f_unlock !== undefined);
        req(r.label + ": f_greatCircle mark recorded", r.marks.f_greatCircle !== undefined);
        req(r.label + ": tendon mark recorded", r.marks.tendon !== undefined);
        if (r.marks.f_unlock !== undefined && r.marks.f_greatCircle !== undefined) {
            req(r.label + ": f_unlock precedes f_greatCircle", r.marks.f_unlock <= r.marks.f_greatCircle);
        }
        req(r.label + ": foundation band established", r.foundationBand >= 0);
        req(r.label + ": core forged", r.coreForged);
    });

    // diligent: passes; element aspect reached (C4: diligent CAN reach an element aspect).
    var diligent = byKey.diligent;
    req("diligent: reaches a terminal state", diligent.terminalState !== "timedOut");
    req("diligent: tribulation PASSED", diligent.tribPassed);
    req("diligent: an Act I Legacy Grade was earned", diligent.legacyIndex >= 0);

    // spine-only: passes at ANY grade (grade-agnostic, C4); Formless aspect; no horizontals.
    var spine = byKey.spineOnly;
    req("spine-only: reaches a terminal state", spine.terminalState !== "timedOut");
    req("spine-only: tribulation PASSED (any grade)", spine.tribPassed);
    req("spine-only: Formless aspect (C4: zero Dao nodes → only Formless)",
        spine.aspectKey === "formless");
    req("spine-only: never joined the sect (optionality)", !spine.sectJoined);
    req("spine-only: zero Dao Seeds (optionality)", spine.heldSeeds === 0);

    // max-scar: passes from forced maxDepth; heal arc completes from depth 3; tempered > 1.
    var maxScar = byKey.maxScar;
    req("max-scar: reaches a terminal state", maxScar.terminalState !== "timedOut");
    req("max-scar: scar was forced to maxDepth before the tribulation", maxScar.forcedScar);
    req("max-scar: tribulation PASSED from forced max scar", maxScar.tribPassed);
    req("max-scar: heal arc completed (scar fully healed)", !maxScar.scarActive);
    req("max-scar: heal arc completed from depth 3 (healedDepth === depth)",
        maxScar.scarHealedDepth === maxScar.scarDepth && maxScar.scarDepth === DATA.scarMaxDepth);
    req("max-scar: temperedQiMult > 1 after healing", maxScar.temperedQiMult > 1);

    return failures;
}

function runDefaultMode() {
    var results = PROFILE_ORDER.map(function (key) { return runProfile(key); });

    console.log("=== Act I pacing sim — default mode (structural assertions only) ===");
    console.log("PACING_BUDGETS.pinned = " + PACING_BUDGETS.pinned +
        "  →  TIME-BAND ASSERTIONS INACTIVE pending Gate D sign-off.");
    console.log("");
    results.forEach(function (r) { printRunDefault(r); console.log(""); });

    var failures = assertStructural(results);
    console.log("---");
    if (failures.length > 0) {
        console.log("STRUCTURAL ASSERTIONS FAILED:");
        failures.forEach(function (name) { console.log("  FAIL — " + name); });
        process.exit(1);
    }
    console.log("STRUCTURAL ASSERTIONS: PASS (all three profiles terminal; spine-only passes " +
        "at any grade; max-scar passes from forced depth-" + DATA.scarMaxDepth +
        " and completes the heal arc; legacy q/f marks present).");
}

// ---------------------------------------------------------------------------
// --report MODE (D1) — the human calibration surface. No assertions; print a
// phase-timing table for all three profiles in sim-hours, plus tribulation grade
// and Act I Legacy band.
// ---------------------------------------------------------------------------
function runReportMode() {
    var results = PROFILE_ORDER.map(function (key) { return runProfile(key); });

    console.log("=== Act I pacing sim — --report (D1 calibration; NO assertions) ===");
    console.log("All times in sim-HOURS (continuous game time; no offline modeling).");
    console.log("");

    var phaseRows = [
        ["lattice reveal", "lattice_reveal"],
        ["Foundation",     "foundation"],
        ["forge",          "forge"],
        ["NS breakthrough","ns_unlock"],
        ["aspect chosen",  "aspect"],
        ["SF unlock",      "sf_unlock"],
        ["SF peak",        "sf_peak"],
        ["trib attempt",   "tribulation_attempt"],
        ["trib pass",      "tribulation_pass"],
        ["heal complete",  "heal_complete"]
    ];

    var header = pad("phase", 18);
    PROFILE_ORDER.forEach(function (key) { header += pad(PROFILES[key].label, 12); });
    console.log(header);
    console.log("-".repeat(header.length));

    phaseRows.forEach(function (row) {
        var line = pad(row[0], 18);
        PROFILE_ORDER.forEach(function (key, i) {
            var r = results[i];
            line += pad(hours(r.marks[row[1]]), 12);
        });
        console.log(line);
    });

    console.log("-".repeat(header.length));
    // Summary rows: terminal state, tribulation grade, legacy band, core, aspect, scar.
    function summaryRow(label, fn) {
        var line = pad(label, 18);
        results.forEach(function (r) { line += pad(String(fn(r)), 12); });
        console.log(line);
    }
    summaryRow("terminal", function (r) { return r.terminalState; });
    summaryRow("total (h)", function (r) { return hours(r.seconds); });
    summaryRow("trib grade", function (r) { return tribGradeLabel(r); });
    summaryRow("legacy band", function (r) { return legacyBandLabel(r); });
    summaryRow("core grade", function (r) { return coreLabel(r); });
    summaryRow("aspect", function (r) { return aspectLabel(r); });
    summaryRow("foundation", function (r) { return foundationTierLabel(r.foundationBand); });
    summaryRow("seeds/tech", function (r) { return r.heldSeeds + "/" + r.ownedTechniques; });
    summaryRow("scar d/heal", function (r) { return r.scarDepth + "/" + r.scarHealedDepth; });
    summaryRow("tempered x", function (r) { return r.temperedQiMult.toFixed(3); });
    summaryRow("peak Qi/sec", function (r) { return r.peakQiPerSec.toFixed(1); });

    console.log("");
    console.log("C4 aspect reach: spine-only → Formless only (zero Dao nodes, no element Seed); " +
        "diligent/max-scar → element aspect (" + aspectLabel(results[0]) + ").");
    console.log("Note: bands are NOT pinned (PACING_BUDGETS.pinned=false). This table is the " +
        "Gate-D calibration surface; Wes pins bands at ±25% of observed before they assert.");
}

function pad(text, width) {
    text = String(text);
    if (text.length >= width) return text + " ";
    return text + " ".repeat(width - text.length);
}

// ---------------------------------------------------------------------------
// MAIN.
// ---------------------------------------------------------------------------
function main() {
    var reportMode = process.argv.indexOf("--report") !== -1;
    if (reportMode) runReportMode();
    else runDefaultMode();
}

main();
