// js/build/fixture-test-node.js — synthetic two-tree lint fixture (design §8.1/§8.2/§8.5,
// build-order slice 2).
//
// Usage:  node js/build/fixture-test-node.js
//
// This is a HARNESS, not generated/factory code: it is NOT subject to the §11
// zero-numeric-literal rule and is NOT added to scannedBuildFiles. It exists so the
// cross-tree-leak / keep-rule / hint / achievement-scope checks are exercised from
// day one (slice 2) with a REAL two-tree topology, instead of running vacuously over
// the single-tree v0.1 data until Act II ships (slice 9, §11).
//
// It builds SYNTHETIC data globals in a vm sandbox — two trees (act1 rows 0-1, act2
// rows 2-3, minimal REALM_DATA-shaped rows; stub BODY_DATA / GATE_DATA / HINT_DATA /
// KEEP_RULES sufficient for the checks under test) — loads the REAL js/build/linter.js,
// and runs the individually-exposed root.cultivationLintChecks against the synthetic
// globals. The linter reads the data tables as free globals at call time, so each
// case reassigns the globals and re-runs a single check (no factory / Decimal / player
// needed for these data-table checks). Prints one PASS/FAIL line per case and exits
// non-zero if any case misbehaves.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");
const buildDir = path.join(projectRoot, "js", "build");
const linterFull = path.join(buildDir, "linter.js");

function fail(message) {
    console.error("FIXTURE HARNESS ERROR: " + message);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Sandbox: only FACTORY_NUMERICS must exist BEFORE linter.js loads (the IIFE
// captures ZERO/ONE/HUNDRED at load). The data tables are read on each check
// call, so the fixture reassigns them per case.
// ---------------------------------------------------------------------------
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.FACTORY_NUMERICS = { zero: 0, one: 1, hundred: 100 };
const context = vm.createContext(sandbox);

if (!fs.existsSync(linterFull)) fail("missing linter: " + linterFull);
vm.runInContext(fs.readFileSync(linterFull, "utf8"), context, { filename: linterFull });

if (!sandbox.cultivationLintChecks) {
    fail("linter.js did not expose root.cultivationLintChecks");
}

// ---------------------------------------------------------------------------
// Synthetic CLEAN two-tree config. act1 = rows 0-1 (qa, fa), act2 = rows 2-3
// (qb, fb). Body + gate are life-scoped, members of no tree. The realm rows carry
// only the fields the four checks read: id, row, substages (labels + at), forge?.
// ---------------------------------------------------------------------------
function cleanRealmData() {
    return [
        { id: "qa", row: 0, substages: [{ label: "1st Level", at: 1 }, { label: "2nd Level", at: 3 }] },
        { id: "fa", row: 1, substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] },
        { id: "qb", row: 2, substages: [{ label: "1st Level", at: 1 }, { label: "2nd Level", at: 3 }] },
        { id: "fb", row: 3, forge: true, substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] }
    ];
}

function cleanBodyData() {
    return {
        id: "b",
        buyables: [
            { key: "primaryMeridian", limit: 12 },
            { key: "temper", limit: 24 }
        ],
        temperTiers: [
            { key: "skin", label: "Skin", fromLevel: 1 },
            { key: "flesh", label: "Flesh", fromLevel: 5 }
        ]
    };
}

function cleanGateData() {
    return {
        id: "gate",
        achievements: [
            { id: 11, key: "outerDisciple", kind: "checkpoint", gates: null }
        ]
    };
}

function cleanTreeData() {
    return {
        trees: [
            { id: "act1", name: "Act I" },
            { id: "act2", name: "Act II" }
        ],
        layers: {
            qa: { scope: "tree", tree: "act1" },
            fa: { scope: "tree", tree: "act1" },
            qb: { scope: "tree", tree: "act2" },
            fb: { scope: "tree", tree: "act2" },
            b: { scope: "life" },
            gate: { scope: "life" }
        }
    };
}

function cleanKeepRules() {
    return [
        {
            key: "qaSurvivesFa",
            grantedBy: { layer: "fa", milestone: 1 },
            onResetOf: "fa",
            target: "qa",
            keep: ["best"]
        }
    ];
}

function cleanHintData() {
    return {
        hints: [
            { key: "climbFa", when: { realm: ["fa", "Early"] }, text: "climb" },
            { key: "unlockQa", when: { layerUnlocked: "qa" }, text: "unlock" },
            { key: "catchAll", always: true, text: "gather" }
        ]
    };
}

// Apply a complete set of synthetic globals into the sandbox for one case.
function applyGlobals(overrides) {
    sandbox.REALM_DATA = overrides.REALM_DATA || cleanRealmData();
    sandbox.BODY_DATA = overrides.BODY_DATA || cleanBodyData();
    sandbox.GATE_DATA = overrides.GATE_DATA || cleanGateData();
    sandbox.TREE_DATA = overrides.TREE_DATA || cleanTreeData();
    sandbox.KEEP_RULES = overrides.KEEP_RULES || cleanKeepRules();
    sandbox.HINT_DATA = overrides.HINT_DATA || cleanHintData();
}

// Run a single exposed check by name against the currently-applied globals and
// return its collected errors array.
function runCheck(checkName) {
    const errors = [];
    sandbox.cultivationLintChecks[checkName](errors);
    return errors;
}

// ---------------------------------------------------------------------------
// Case runner. expectClean=true asserts zero errors; otherwise asserts at least
// one error AND that some error names the expected token (the offending layer /
// rule / row), so a check can't pass by erroring for the wrong reason.
// ---------------------------------------------------------------------------
let anyFailed = false;

function runCase(caseName, checkName, overrides, expectClean, expectedToken) {
    applyGlobals(overrides);
    const errors = runCheck(checkName);
    let ok;
    let detail;
    if (expectClean) {
        ok = errors.length === 0;
        detail = ok ? "zero errors" : ("expected clean, got: " + errors.join(" | "));
    } else {
        const named = errors.some(function (e) { return e.indexOf(expectedToken) !== -1; });
        ok = errors.length >= 1 && named;
        if (errors.length < 1) {
            detail = "expected >=1 error naming '" + expectedToken + "', got none";
        } else if (!named) {
            detail = "errored but none named '" + expectedToken + "': " + errors.join(" | ");
        } else {
            detail = "error names '" + expectedToken + "'";
        }
    }
    if (!ok) anyFailed = true;
    console.log((ok ? "PASS" : "FAIL") + " — " + caseName + " (" + detail + ")");
}

// ---------------------------------------------------------------------------
// PASS case: a clean two-tree config -> zero errors from all four new checks.
// ---------------------------------------------------------------------------
runCase("clean two-tree / persistence scopes", "checkPersistenceScopes", {}, true);
runCase("clean two-tree / keep rules", "checkKeepRules", {}, true);
runCase("clean two-tree / hint data", "checkHintData", {}, true);
runCase("clean two-tree / achievement scope", "checkAchievementScopeDiscipline", {}, true);

// ---------------------------------------------------------------------------
// FAIL (1): a registered layer (fb) missing from TREE_DATA.layers.
// ---------------------------------------------------------------------------
(function () {
    const tree = cleanTreeData();
    delete tree.layers.fb;
    runCase("FAIL(1) registered layer missing from TREE_DATA.layers",
        "checkPersistenceScopes", { TREE_DATA: tree }, false, "fb");
})();

// ---------------------------------------------------------------------------
// FAIL (2): a layer (qb) claiming an undeclared tree id.
// ---------------------------------------------------------------------------
(function () {
    const tree = cleanTreeData();
    tree.layers.qb = { scope: "tree", tree: "act99" };
    runCase("FAIL(2) layer claims an undeclared tree id",
        "checkPersistenceScopes", { TREE_DATA: tree }, false, "act99");
})();

// ---------------------------------------------------------------------------
// FAIL (3): a stale TREE_DATA.layers entry for an unregistered layer.
// ---------------------------------------------------------------------------
(function () {
    const tree = cleanTreeData();
    tree.layers.ghost = { scope: "tree", tree: "act1" };
    runCase("FAIL(3) stale TREE_DATA.layers entry for an unregistered layer",
        "checkPersistenceScopes", { TREE_DATA: tree }, false, "ghost");
})();

// ---------------------------------------------------------------------------
// FAIL (3b): cross-tree leak — fb (act2, row 3) given the SAME act1 tree as the
// lower act1 rows, so its reset closure swallows act1 layers. Exercises the
// isolation walk the fixture exists to prove (otherwise vacuous in v0.1).
// ---------------------------------------------------------------------------
(function () {
    const tree = cleanTreeData();
    tree.layers.fb = { scope: "tree", tree: "act1" }; // act2 row pulled into act1's closure
    runCase("FAIL(3c) cross-tree leak in a resetter's reset closure",
        "checkPersistenceScopes", { TREE_DATA: tree }, false, "leak");
})();

// ---------------------------------------------------------------------------
// FAIL (3d): cross-SCOPE leak — a life-scoped layer ("relic") registered with a
// REALM_DATA row INSIDE act1's [0,1] band. Covers checkPersistenceScopes' second
// isolation branch (life/eternal interleaving a tree's band), which FAIL(3c)'s
// cross-TREE branch does not reach — without this case that branch could silently
// become a no-op.
// ---------------------------------------------------------------------------
(function () {
    const realms = cleanRealmData();
    realms.push({ id: "relic", row: 1, substages: [{ label: "Early", at: 1 }] });
    const tree = cleanTreeData();
    tree.layers.relic = { scope: "life" };
    runCase("FAIL(3d) cross-scope leak: life-scoped layer inside a tree's row band",
        "checkPersistenceScopes", { REALM_DATA: realms, TREE_DATA: tree }, false, "relic");
})();

// ---------------------------------------------------------------------------
// FAIL (4): a KEEP_RULES row whose target is in a different tree than onResetOf.
// onResetOf fa (act1) but target qb (act2).
// ---------------------------------------------------------------------------
(function () {
    const rules = cleanKeepRules();
    rules[0] = {
        key: "crossTreeKeep",
        grantedBy: { layer: "fa", milestone: 1 },
        onResetOf: "fa",
        target: "qb",
        keep: ["best"]
    };
    runCase("FAIL(4) keep rule target in a different tree than onResetOf",
        "checkKeepRules", { KEEP_RULES: rules }, false, "crossTreeKeep");
})();

// ---------------------------------------------------------------------------
// FAIL (5): a KEEP_RULES row keeping a key absent from the target's start-data shape.
// qa start-data is unlocked/points/best/total; "meridians" is not a realm key.
// ---------------------------------------------------------------------------
(function () {
    const rules = cleanKeepRules();
    rules[0].keep = ["meridians"];
    runCase("FAIL(5) keep rule keeps a key absent from target start-data shape",
        "checkKeepRules", { KEEP_RULES: rules }, false, "meridians");
})();

// ---------------------------------------------------------------------------
// FAIL (6a): HINT_DATA with the catch-all missing entirely.
// ---------------------------------------------------------------------------
(function () {
    const hints = {
        hints: [
            { key: "climbFa", when: { realm: ["fa", "Early"] }, text: "climb" }
        ]
    };
    runCase("FAIL(6a) hint cascade missing the catch-all row",
        "checkHintData", { HINT_DATA: hints }, false, "catch-all");
})();

// ---------------------------------------------------------------------------
// FAIL (6b): catch-all present but NOT last.
// ---------------------------------------------------------------------------
(function () {
    const hints = {
        hints: [
            { key: "catchAll", always: true, text: "gather" },
            { key: "climbFa", when: { realm: ["fa", "Early"] }, text: "climb" }
        ]
    };
    runCase("FAIL(6b) hint catch-all is not the last row",
        "checkHintData", { HINT_DATA: hints }, false, "catchAll");
})();

// ---------------------------------------------------------------------------
// FAIL (7): an effective-eternal achievement (kind "meta" on the gate layer)
// gating a tree-scoped layer (qa). Effective scope: kind "meta" -> eternal, which
// may gate nothing tree- or life-scoped (§8.1).
// ---------------------------------------------------------------------------
(function () {
    const gate = cleanGateData();
    gate.achievements[0] = {
        id: 11, key: "samsaraMilestone", kind: "meta", gates: { layer: "qa" }
    };
    runCase("FAIL(7) eternal achievement gates a tree-scoped layer",
        "checkAchievementScopeDiscipline", { GATE_DATA: gate }, false, "samsaraMilestone");
})();

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("FIXTURE FAIL — at least one case misbehaved.");
    process.exit(1);
}
console.log("FIXTURE PASS — all two-tree lint cases behaved as expected.");
process.exit(0);
