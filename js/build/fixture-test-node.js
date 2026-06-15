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

const path = require("path");
const vm = require("vm");
const nodeBoot = require("./node-boot.js");

const projectRoot = nodeBoot.projectRoot;
const buildDir = path.join(projectRoot, "js", "build");
const linterFull = path.join(buildDir, "linter.js");

function fail(message) {
    console.error("FIXTURE HARNESS ERROR: " + message);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Sandbox: only FACTORY_NUMERICS must exist BEFORE linter.js loads (the IIFE
// captures ZERO/ONE/HUNDRED at load). The data tables are read on each check
// call, so the fixture reassigns them per case. This stays SYNTHETIC: the
// minimal (console-only) sandbox plus the linter — no real data files load.
// ---------------------------------------------------------------------------
const sandbox = nodeBoot.createMinimalSandbox({ factoryNumerics: true });
const context = vm.createContext(sandbox);

nodeBoot.loadFilesInto(context, [linterFull], {
    optional: false,
    filenameFull: true,
    onFail: fail,
    missingMessage: function (full) { return "missing linter: " + full; }
});

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
            gate: { scope: "life" },
            // The Dao lattice is a life-scoped side layer (design §4.2): now that the fixture
            // applies LATTICE_DATA, registeredLayerIds() lists "dao", so it needs an entry here
            // for the persistence-scope clean cases — matching trees.js's real dao life entry.
            dao: { scope: "life" },
            // Slice-5 side layers (design §4.3/§1.6): the fixture now applies SECT_DATA / JOURNAL_DATA,
            // so registeredLayerIds() lists "sect" (life) and "journal" (eternal). They need entries
            // here for the persistence-scope clean cases — matching trees.js's real sect/journal entries.
            sect: { scope: "life" },
            journal: { scope: "eternal" },
            // Slice-6 eternal Legacy store (design §8.1): the fixture now applies LEGACY_DATA, so
            // registeredLayerIds() lists "legacy" (eternal) for every case — it needs an entry here
            // for the persistence-scope clean cases, matching trees.js's real legacy eternal entry.
            legacy: { scope: "eternal" }
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

// Synthetic CLEAN lattice (design §4.2): one root (no requires) and one ring-2 node that
// requires it — minimally a reachable, acyclic graph with two tiers. Costs strictly ascending
// & positive; effects one per tier, keys in {qiMult,insightMult}, every value >= 1; one valid
// conflict pair; a positive Insight baseRate; a reveal condition the shared oracle accepts.
function cleanLatticeData() {
    return {
        id: "dao",
        name: "Dao Lattice",
        unlock: { realm: ["qa", "1st Level"] },
        insight: { resource: "Insight", baseRate: 0.5 },
        tiers: [
            { key: "glimpse", label: "Glimpse" },
            { key: "seed", label: "Seed" }
        ],
        nodes: [
            { key: "metal", buyableId: 11, name: "Metal Root", element: "metal", requires: [],
              costs: [100, 300], effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
            { key: "sword", buyableId: 21, name: "Sword Intent", element: "metal", requires: ["metal"],
              costs: [250, 800], effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
            { key: "stillness", buyableId: 31, name: "Stillness", element: "metal", requires: ["metal"],
              costs: [600, 2000], effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] }
        ],
        conflicts: [["sword", "stillness"]]
    };
}

// Synthetic CLEAN stances (design §6.1): maxActive 1; one free trade-down/up stance and one
// gated on a real dao node (exercising the extended checkCondition daoNode key). Every stance
// has a modifier < 1 AND a modifier > 1, every modifier > 0.
function cleanStanceData() {
    return {
        maxActive: 1,
        stances: [
            { key: "breathingTrance", clickableId: 41, name: "Breathing Trance",
              unlock: {}, modifiers: { qiMult: 0.7, insightMult: 2.0 } },
            { key: "swordTrance", clickableId: 42, name: "Sword Trance",
              unlock: { daoNode: ["sword", 1] }, modifiers: { qiMult: 0.4, insightMult: 3.5 } }
        ]
    };
}

// Synthetic CLEAN automation ladder (design §1.7/§7.5). The frontier rule needs a TALLER
// single-tree topology than the two-tree clean realm set (whose per-tree depth is only 1, so the
// "more than two rows below the frontier" predicate is vacuous there). automationRealmData() is a
// single act1 tree of four rows (0-3): row 0 (qa) is more than two rows below the row-3 frontier,
// so it MUST have its prestige automated — and the clean automation row does exactly that. The
// matching automationTreeData() registers all four rows + body/gate in the one tree.
function automationRealmData() {
    return [
        { id: "qa", row: 0, substages: [{ label: "1st Level", at: 1 }, { label: "2nd Level", at: 3 }] },
        { id: "fa", row: 1, substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] },
        { id: "ca", row: 2, substages: [{ label: "Forged", at: 1 }, { label: "Refined", at: 2 }] },
        { id: "na", row: 3, substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] }
    ];
}

function automationTreeData() {
    return {
        trees: [{ id: "act1", name: "Act I" }],
        layers: {
            qa: { scope: "tree", tree: "act1" },
            fa: { scope: "tree", tree: "act1" },
            ca: { scope: "tree", tree: "act1" },
            na: { scope: "tree", tree: "act1" },
            b: { scope: "life" },
            gate: { scope: "life" },
            dao: { scope: "life" },
            // Mirror the slice-5 side layers so the automation/soul-aspect cases (which apply
            // SECT_DATA / JOURNAL_DATA via applyGlobals) keep registeredLayerIds() and TREE_DATA
            // in sync — otherwise checkAutomationData's registered-layer guard would false-error.
            sect: { scope: "life" },
            journal: { scope: "eternal" },
            // Mirror the slice-6 eternal Legacy store so the automation/soul-aspect cases keep
            // registeredLayerIds() and TREE_DATA in sync (LEGACY_DATA is applied for every case).
            legacy: { scope: "eternal" }
        }
    };
}

function cleanAutomationData() {
    return [
        // Granted by the row-3 frontier realm's first sub-stage; auto-prestiges the root realm
        // (row 0, three rows below the frontier) — satisfying the frontier rule. The buyable row
        // exercises the action="buyable" + real-buyableKey path.
        { key: "naRootPrestige", grantedBy: { layer: "na", milestone: 0 },
          automates: { layer: "qa", action: "prestige", maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5 } } },
        { key: "naPrimaryMeridians", grantedBy: { layer: "na", milestone: 0 },
          automates: { layer: "b", action: "buyable", buyableKey: "primaryMeridian" } }
    ];
}

// Synthetic CLEAN soul aspect set-piece (expansion §5/§6.3). Mounted on the row-3 realm of the
// automation tree. One unconditional Formless aspect (the completability floor) plus one element
// aspect gated on a real lattice element (metal) via the daoElementTier grammar; every effect >= 1.
function cleanSoulAspect() {
    return {
        aspects: [
            { key: "formless", label: "Formless", element: null, requires: {},
              effect: { qiMult: 1.2, insightMult: 1.2 } },
            { key: "metalSoul", label: "Sword", element: "metal",
              requires: { daoElementTier: ["metal", 2] }, effect: { insightMult: 1.5 } }
        ]
    };
}

// Synthetic CLEAN technique library (design §4.3). Two school techniques (one per archetype's
// school) plus one universal canon technique. Unique keys; school in grammar; libraryTier 1/2;
// ascending positive costs; effect keys in {qiMult,insightMult}, every value >= 1.
function cleanTechniqueData() {
    return [
        { key: "swordForm", name: "Sword Form", school: "sword", libraryTier: 1, cost: 600,
          effect: { qiMult: 1.12 } },
        { key: "swordHeart", name: "Sword Heart", school: "sword", libraryTier: 2, cost: 9000,
          effect: { insightMult: 1.3 } },
        { key: "stoneSkin", name: "Stone Skin", school: "formation", libraryTier: 1, cost: 600,
          effect: { qiMult: 1.12 } },
        { key: "breathCanon", name: "Breath Canon", school: "universal", libraryTier: 1, cost: 1200,
          effect: { qiMult: 1.1 } }
    ];
}

// Synthetic CLEAN sect side-spine (design §4.3). reveal flows through the shared oracle (a realm
// gate over the clean realm set); contribution sub-linear (exponent 0.5); two archetypes with
// unique keys, both on the clean lattice's "metal" element (the element-resolution check only
// needs the element to own SOME node); each lists ONLY its own school + (optionally) universal;
// milestones ascending with recognized rewards.
function cleanSectData() {
    return {
        id: "sect",
        name: "Unaffiliated",
        reveal: { realm: ["qa", "1st Level"] },
        contribution: { resource: "Contribution", rate: 0.5, exponent: 0.5 },
        archetypes: [
            { key: "azureSword", name: "Azure Sword", element: "metal", latticeDiscount: 0.75,
              techniques: ["swordForm", "swordHeart"] },
            { key: "stoneFormation", name: "Stone Formation", element: "metal", latticeDiscount: 0.75,
              techniques: ["stoneSkin"] }
        ],
        milestones: [
            { key: "stipend", at: 250, reward: { qiMult: 1.15 } },
            { key: "library", at: 4000, reward: { libraryTier: 2 } },
            { key: "arsenal", at: 30000, reward: { arsenal: true } }
        ]
    };
}

// Synthetic CLEAN journal (design §1.6). Unique keys; non-empty title + text; every `when` valid
// via the shared oracle (including the achievement / sectJoined extensions); the FIRST entry is
// qi-only so the journal is reachable from a fresh save (never permanently empty).
function cleanJournalData() {
    return {
        id: "journal",
        name: "Journal",
        entries: [
            { key: "firstBreath", when: { qi: 1 }, title: "First Breath", text: "You draw qi." },
            { key: "foundation", when: { realm: ["fa", "Early"] }, title: "Foundation", text: "It holds." },
            { key: "deed", when: { achievement: ["gate", 11] }, title: "A Deed", text: "Seen." },
            { key: "joined", when: { sectJoined: true }, title: "Joined", text: "You belong." }
        ]
    };
}

// Synthetic CLEAN set-piece table (design §8.3/§6.2/§1.3). A forge block carrying the full
// migrated forge shape (forgeReq/fuelBase/pushOptions/grades/crackTierDrop/refinement); a
// firstTribulation block (kind "tribulation") whose trigger gates on a real clean-realm stage,
// non-empty positive-damage waves, positive durationSeconds, positive pool weights/denominators,
// grades with exactly one passes:false at index 0 and strictly-ascending passing floors and a
// scarring grade, a non-negative retryCooldownSeconds; and the scar table (maxDepth >= 1,
// debuffQiMultPerDepth in (0,1), positive heal goal/rate, temperedQiMultPerDepth >= 1). The
// pointers are mounted by setpieceRealmData()'s realms so the orphan pass stays clean.
function cleanSetpieceData() {
    return {
        forge: {
            forgeReq: 25,
            fuelBase: 25,
            pushOptions: [{ key: "steady", fuelMult: 1, offset: 0, crackChance: 0.0 }],
            crackTierDrop: 1,
            refinement: { goal: 100, ratePerSecond: 1, tierStep: 1, barWidth: 360, barHeight: 28 },
            grades: [
                { key: "cracked", label: "Cracked", ceilingIndex: 0, globalMult: 2 },
                { key: "perfect", label: "Perfect", ceilingIndex: 1, globalMult: 8 }
            ]
        },
        firstTribulation: {
            kind: "tribulation",
            name: "The First Tribulation",
            trigger: { realm: ["fb", "Late"] },
            intensity: { base: 1.0, perBest: 0.0005 },
            durationSeconds: 35,
            waves: [
                { key: "gale", name: "Gale", damage: 14 },
                { key: "thunder", name: "Thunder", damage: 28 }
            ],
            pool: {
                weightTemper: 90, temperDenominator: 24,
                weightMeridians: 90, meridianDenominator: 12,
                weightCoreGrade: 130, weightTechniques: 60, techniqueDenominator: 4,
                qiFuelWeight: 90, qiFuelDenominator: 12
            },
            grades: [
                { key: "failed", label: "Failed", passes: false, scars: true },
                { key: "shaken", label: "Shaken", passes: true, scars: false, floor: 0.0 },
                { key: "scarred", label: "Scarred", passes: true, scars: true, floor: 0.35 },
                { key: "flawless", label: "Flawless", passes: true, scars: false, floor: 0.70 }
            ],
            retryCooldownSeconds: 60
        },
        scar: {
            maxDepth: 3,
            debuffQiMultPerDepth: 0.88,
            healGoalPerDepth: 240,
            healRatePerSecond: 1,
            temperedQiMultPerDepth: 1.06
        }
    };
}

// A clean realm set that MOUNTS the set-piece pointers (forge on fb, firstTribulation on a new s
// row), so checkSetpieceData's resolve-and-orphan passes are clean. The firstTribulation trigger
// (cleanSetpieceData) gates on ["fb","Late"], a real stage, so checkCondition stays quiet.
function setpieceRealmData() {
    return [
        { id: "qa", row: 0, substages: [{ label: "1st Level", at: 1 }, { label: "2nd Level", at: 3 }] },
        { id: "fa", row: 1, substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] },
        { id: "qb", row: 2, substages: [{ label: "1st Level", at: 1 }, { label: "2nd Level", at: 3 }] },
        { id: "fb", row: 3, setpiece: "forge", substages: [{ label: "Early", at: 1 }, { label: "Late", at: 4 }] },
        { id: "s", row: 4, setpiece: "firstTribulation",
          substages: [{ label: "Early", at: 1 }, { label: "Great Circle", at: 5 }] }
    ];
}

// Synthetic CLEAN eternal Legacy store (design §8.1/§5). weights sum to 1; positive denominators;
// ascending band floors in [0,1]; every band qiMult >= 1; unique band keys.
function cleanLegacyData() {
    return {
        id: "legacy",
        name: "Legacy",
        actOne: {
            weights: { coreGrade: 0.35, tribulation: 0.25, aspect: 0.15, sectStanding: 0.15, daoSeeds: 0.10 },
            denominators: { coreGrade: 4, aspect: 2, daoSeeds: 8, sectStanding: 2, tribulation: 3 },
            bands: [
                { key: "faint", label: "Faint Legacy", floor: 0.00, qiMult: 1.00 },
                { key: "steady", label: "Steady Legacy", floor: 0.30, qiMult: 1.15 },
                { key: "radiant", label: "Radiant Legacy", floor: 0.55, qiMult: 1.35 },
                { key: "eternal", label: "Eternal Legacy", floor: 0.80, qiMult: 1.60 }
            ]
        }
    };
}

// A realm set carrying the soul aspect on its frontier row, for the soul-aspect cases.
function soulAspectRealmData() {
    const realms = automationRealmData();
    realms[realms.length - 1].soulAspect = cleanSoulAspect();
    return realms;
}

// Apply a complete set of synthetic globals into the sandbox for one case.
function applyGlobals(overrides) {
    sandbox.REALM_DATA = overrides.REALM_DATA || cleanRealmData();
    sandbox.BODY_DATA = overrides.BODY_DATA || cleanBodyData();
    sandbox.GATE_DATA = overrides.GATE_DATA || cleanGateData();
    sandbox.TREE_DATA = overrides.TREE_DATA || cleanTreeData();
    sandbox.KEEP_RULES = overrides.KEEP_RULES || cleanKeepRules();
    sandbox.HINT_DATA = overrides.HINT_DATA || cleanHintData();
    sandbox.LATTICE_DATA = overrides.LATTICE_DATA || cleanLatticeData();
    sandbox.STANCE_DATA = overrides.STANCE_DATA || cleanStanceData();
    sandbox.AUTOMATION_DATA = overrides.AUTOMATION_DATA || cleanAutomationData();
    // Slice-5 globals (design §4.3/§1.6). Always applied so registeredLayerIds() lists sect/journal
    // for every case (matching the TREE_DATA entries mirrored above); overridable per FAIL case.
    sandbox.SECT_DATA = overrides.SECT_DATA || cleanSectData();
    sandbox.TECHNIQUE_DATA = overrides.TECHNIQUE_DATA || cleanTechniqueData();
    sandbox.JOURNAL_DATA = overrides.JOURNAL_DATA || cleanJournalData();
    // Slice-6 globals (design §8.3/§6.2/§8.1/§5). The set-piece + Legacy tables read by
    // checkSetpieceData / checkLegacyData; overridable per FAIL case. The set-piece/legacy cases
    // pair these with setpieceRealmData (which mounts the forge/firstTribulation pointers) so the
    // resolve-and-orphan passes are clean — non-set-piece cases never call those two checks.
    sandbox.SETPIECE_DATA = overrides.SETPIECE_DATA || cleanSetpieceData();
    sandbox.LEGACY_DATA = overrides.LEGACY_DATA || cleanLegacyData();
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
runCase("clean lattice / lattice data", "checkLatticeData", {}, true);
runCase("clean stances / stance data", "checkStanceData", {}, true);
runCase("clean sect / sect data", "checkSectData", {}, true);
runCase("clean techniques / technique data", "checkTechniqueData", {}, true);
runCase("clean journal / journal data", "checkJournalData", {}, true);

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
// FAIL (L1): a requires CYCLE (a -> b -> a). The cycle detector must report it AND
// the reachability walk must be skipped (a cycle has no root), so the only error is
// the cycle itself — naming the offending node.
// ---------------------------------------------------------------------------
(function () {
    const lattice = cleanLatticeData();
    lattice.nodes = [
        { key: "a", buyableId: 11, requires: ["b"], costs: [100, 300],
          effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "b", buyableId: 12, requires: ["a"], costs: [100, 300],
          effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] }
    ];
    lattice.conflicts = [];
    runCase("FAIL(L1) lattice requires cycle a->b->a",
        "checkLatticeData", { LATTICE_DATA: lattice }, false, "cycle");
})();

// ---------------------------------------------------------------------------
// FAIL (L2): an ORPHAN node unreachable from any root. A root-bearing component
// (metal -> sword) coexists with a disjoint pair whose requires loop only among
// themselves (orphanA <-> orphanB), so neither reaches an empty-requires root. In a
// finite graph a rootless region is necessarily cyclic, so this case also trips the
// cycle pass; the reachability walk runs independently and flags the orphans by name.
// ---------------------------------------------------------------------------
(function () {
    const lattice = cleanLatticeData();
    lattice.nodes = [
        { key: "metal", buyableId: 11, requires: [], costs: [100, 300],
          effects: [{ qiMult: 1.03 }, { qiMult: 1.06 }] },
        { key: "sword", buyableId: 21, requires: ["metal"], costs: [250, 800],
          effects: [{ insightMult: 1.03 }, { insightMult: 1.07 }] },
        { key: "orphanA", buyableId: 31, requires: ["orphanB"], costs: [600, 2000],
          effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] },
        { key: "orphanB", buyableId: 32, requires: ["orphanA"], costs: [600, 2000],
          effects: [{ insightMult: 1.04 }, { insightMult: 1.09 }] }
    ];
    lattice.conflicts = [];
    runCase("FAIL(L2) lattice orphan node unreachable from any root",
        "checkLatticeData", { LATTICE_DATA: lattice }, false, "orphan");
})();

// ---------------------------------------------------------------------------
// FAIL (L3): non-ascending tier costs (seed cost not above glimpse cost).
// ---------------------------------------------------------------------------
(function () {
    const lattice = cleanLatticeData();
    lattice.nodes[0].costs = [300, 100]; // descending — must trip the ascending-costs rule
    runCase("FAIL(L3) lattice non-ascending tier costs",
        "checkLatticeData", { LATTICE_DATA: lattice }, false, "ascending");
})();

// ---------------------------------------------------------------------------
// FAIL (L4): a conflict referencing an UNKNOWN node key.
// ---------------------------------------------------------------------------
(function () {
    const lattice = cleanLatticeData();
    lattice.conflicts = [["sword", "phantom"]];
    runCase("FAIL(L4) lattice conflict references an unknown node",
        "checkLatticeData", { LATTICE_DATA: lattice }, false, "phantom");
})();

// ---------------------------------------------------------------------------
// FAIL (L5): a node effect with a value < 1 (nodes are bonuses, every value >= 1).
// ---------------------------------------------------------------------------
(function () {
    const lattice = cleanLatticeData();
    lattice.nodes[0].effects = [{ qiMult: 0.9 }, { qiMult: 1.06 }]; // a penalty, not a bonus
    runCase("FAIL(L5) lattice node effect value below 1",
        "checkLatticeData", { LATTICE_DATA: lattice }, false, "metal");
})();

// ---------------------------------------------------------------------------
// FAIL (S1): a stance with NO cost (all modifiers >= 1) -> the tradeoff rule fires.
// ---------------------------------------------------------------------------
(function () {
    const stances = cleanStanceData();
    stances.stances[0].modifiers = { qiMult: 1.5, insightMult: 2.0 }; // pure free buff
    runCase("FAIL(S1) stance with no cost (all modifiers >= 1)",
        "checkStanceData", { STANCE_DATA: stances }, false, "TRADE");
})();

// ---------------------------------------------------------------------------
// FAIL (S2): a stance unlock daoNode referencing an UNKNOWN node -> the extended
// checkCondition (daoNode grammar) fires through checkStanceData.
// ---------------------------------------------------------------------------
(function () {
    const stances = cleanStanceData();
    stances.stances[1].unlock = { daoNode: ["nonesuch", 1] };
    runCase("FAIL(S2) stance unlock daoNode references an unknown node",
        "checkStanceData", { STANCE_DATA: stances }, false, "nonesuch");
})();

// ---------------------------------------------------------------------------
// PASS: clean automation ladder + clean soul aspect over the taller single-tree
// topology -> zero errors. Both run with automationRealmData/automationTreeData so
// the frontier rule (and the element-resolution) is actually exercised, not vacuous.
// ---------------------------------------------------------------------------
runCase("clean automation / automation data", "checkAutomationData",
    { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
      AUTOMATION_DATA: cleanAutomationData() }, true);
runCase("clean soul aspect / soul aspect data", "checkSoulAspectData",
    { REALM_DATA: soulAspectRealmData(), TREE_DATA: automationTreeData() }, true);

// ---------------------------------------------------------------------------
// FAIL (A1): an automation row granting from a NONEXISTENT milestone (out of range
// for its layer) -> the milestone-range check fires, naming the row.
// ---------------------------------------------------------------------------
(function () {
    const automation = cleanAutomationData();
    automation[0].grantedBy = { layer: "na", milestone: 99 }; // na has 2 sub-stages
    runCase("FAIL(A1) automation grants from a nonexistent milestone",
        "checkAutomationData",
        { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
          AUTOMATION_DATA: automation }, false, "naRootPrestige");
})();

// ---------------------------------------------------------------------------
// FAIL (A2): a buyable action with a PHANTOM buyableKey (no such body buyable) ->
// the phantom-auto-buy check fires, naming the bad key.
// ---------------------------------------------------------------------------
(function () {
    const automation = cleanAutomationData();
    automation[1].automates = { layer: "b", action: "buyable", buyableKey: "ghostMeridian" };
    runCase("FAIL(A2) buyable action with a phantom buyableKey",
        "checkAutomationData",
        { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
          AUTOMATION_DATA: automation }, false, "ghostMeridian");
})();

// ---------------------------------------------------------------------------
// FAIL (A3): the FRONTIER RULE. A 4-row single tree whose row-0 realm (qa) has NO
// prestige automation -> it is more than two rows below the row-3 frontier and
// uncovered, so the frontier check reports it by id.
// ---------------------------------------------------------------------------
(function () {
    const automation = cleanAutomationData();
    automation[0].automates = { layer: "fa", action: "prestige", maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5 } }; // covers fa (row 1), NOT qa (row 0)
    runCase("FAIL(A3) frontier rule: row-0 realm has no prestige automation",
        "checkAutomationData",
        { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
          AUTOMATION_DATA: automation }, false, "qa");
})();

// ---------------------------------------------------------------------------
// FAIL (A4): a prestige automation with NO maturity config — thresholdless auto-
// prestige zeroes the base currency at bare canReset every tick and starves
// every sink below it (design §5 "auto-q-prestige at threshold").
// ---------------------------------------------------------------------------
(function () {
    const automation = cleanAutomationData();
    delete automation[0].automates.maturity;
    runCase("FAIL(A4) prestige automation without a maturity config",
        "checkAutomationData",
        { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
          AUTOMATION_DATA: automation }, false, "maturity");
})();

// ---------------------------------------------------------------------------
// FAIL (P1): a soulAspect with NO unconditional fallback aspect (every aspect gated)
// -> the completability-floor check fires (NS would be aspect-blocked).
// ---------------------------------------------------------------------------
(function () {
    const realms = soulAspectRealmData();
    // Replace the unconditional Formless with a gated aspect, so NO aspect is free.
    realms[realms.length - 1].soulAspect = {
        aspects: [
            { key: "metalSoul", label: "Sword", element: "metal",
              requires: { daoElementTier: ["metal", 2] }, effect: { insightMult: 1.5 } },
            { key: "woodSoul", label: "Verdant", element: "metal",
              requires: { daoElementTier: ["metal", 2] }, effect: { qiMult: 1.45 } }
        ]
    };
    runCase("FAIL(P1) soul aspect has no unconditional fallback aspect",
        "checkSoulAspectData",
        { REALM_DATA: realms, TREE_DATA: automationTreeData() }, false, "fallback");
})();

// ---------------------------------------------------------------------------
// FAIL (P2): an aspect requires daoElementTier with a PHANTOM element (no lattice
// node of that element) -> the shared checkCondition oracle reports the element.
// ---------------------------------------------------------------------------
(function () {
    const realms = soulAspectRealmData();
    realms[realms.length - 1].soulAspect.aspects[1].requires = { daoElementTier: ["plasma", 2] };
    runCase("FAIL(P2) aspect requires daoElementTier with a phantom element",
        "checkSoulAspectData",
        { REALM_DATA: realms, TREE_DATA: automationTreeData() }, false, "plasma");
})();

// ---------------------------------------------------------------------------
// FAIL (P3): an aspect effect value < 1 (a penalty, not an identity) -> the >= 1
// bonus-discipline check fires, naming the offending aspect.
// ---------------------------------------------------------------------------
(function () {
    const realms = soulAspectRealmData();
    realms[realms.length - 1].soulAspect.aspects[0].effect = { qiMult: 0.8, insightMult: 1.2 };
    runCase("FAIL(P3) aspect effect value below 1",
        "checkSoulAspectData",
        { REALM_DATA: realms, TREE_DATA: automationTreeData() }, false, "formless");
})();

// ---------------------------------------------------------------------------
// FAIL (SE1): a sect archetype whose element is on NO lattice node -> the element-
// resolution check fires (its discount region is empty), naming the phantom element.
// ---------------------------------------------------------------------------
(function () {
    const sect = cleanSectData();
    sect.archetypes[0].element = "plasma"; // no lattice node carries "plasma"
    runCase("FAIL(SE1) sect archetype element not on any lattice node",
        "checkSectData", { SECT_DATA: sect }, false, "plasma");
})();

// ---------------------------------------------------------------------------
// FAIL (SE2): a sect archetype latticeDiscount > 1 (a penalty, not a discount) ->
// the (0,1] discount-range check fires, naming the offending archetype.
// ---------------------------------------------------------------------------
(function () {
    const sect = cleanSectData();
    sect.archetypes[1].latticeDiscount = 1.5; // > 1 is a price PENALTY, not a discount
    runCase("FAIL(SE2) sect archetype latticeDiscount greater than 1",
        "checkSectData", { SECT_DATA: sect }, false, "stoneFormation");
})();

// ---------------------------------------------------------------------------
// FAIL (SE3): a sect archetype referencing a PHANTOM technique key (no TECHNIQUE_DATA
// row) -> the technique-resolution check fires, naming the phantom key.
// ---------------------------------------------------------------------------
(function () {
    const sect = cleanSectData();
    sect.archetypes[0].techniques = ["swordForm", "ghostStrike"]; // ghostStrike is no row
    runCase("FAIL(SE3) sect archetype references a phantom technique key",
        "checkSectData", { SECT_DATA: sect }, false, "ghostStrike");
})();

// ---------------------------------------------------------------------------
// FAIL (T1): a SCHOOL technique no archetype offers -> the offered-coverage check
// fires (unreachable dead content), naming the orphaned technique.
// ---------------------------------------------------------------------------
(function () {
    const techniques = cleanTechniqueData();
    techniques.push({ key: "orphanArt", name: "Orphan Art", school: "sword", libraryTier: 1,
        cost: 500, effect: { qiMult: 1.1 } }); // sword school, listed by no archetype
    runCase("FAIL(T1) school technique offered by no archetype",
        "checkTechniqueData", { TECHNIQUE_DATA: techniques }, false, "orphanArt");
})();

// ---------------------------------------------------------------------------
// FAIL (J1): a journal entry whose `when` uses an INVALID condition key (an unknown
// realm/stage) -> the shared checkCondition oracle reports it through checkJournalData.
// ---------------------------------------------------------------------------
(function () {
    const journal = cleanJournalData();
    journal.entries[1].when = { realm: ["fa", "NoSuchStage"] }; // unknown stage label
    runCase("FAIL(J1) journal entry with an invalid condition",
        "checkJournalData", { JOURNAL_DATA: journal }, false, "NoSuchStage");
})();

// ---------------------------------------------------------------------------
// FAIL (J2): a journal with NO fresh-save-reachable entry (every `when` gated past a
// fresh save) -> the never-permanently-empty check fires.
// ---------------------------------------------------------------------------
(function () {
    const journal = cleanJournalData();
    // Replace the qi-only first entry with a gated one, so NO entry is fresh-save reachable.
    journal.entries[0].when = { realm: ["fa", "Late"] };
    runCase("FAIL(J2) journal with no fresh-save-reachable entry",
        "checkJournalData", { JOURNAL_DATA: journal }, false, "fresh save");
})();

// ---------------------------------------------------------------------------
// FAIL (AU1): an automation granted by a SECT milestone OUT OF RANGE (the slice-5
// sect milestone source) -> checkAutomationData's milestone-range check fires, naming
// the row. The clean sect has 3 milestones (0..2); milestone 99 is unreachable.
// ---------------------------------------------------------------------------
(function () {
    const automation = cleanAutomationData();
    automation.push({ key: "sectBell", grantedBy: { layer: "sect", milestone: 99 },
        automates: { layer: "fa", action: "prestige", maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5 } } });
    runCase("FAIL(AU1) automation granted by an out-of-range sect milestone",
        "checkAutomationData",
        { REALM_DATA: automationRealmData(), TREE_DATA: automationTreeData(),
          AUTOMATION_DATA: automation }, false, "sectBell");
})();

// ---------------------------------------------------------------------------
// FAIL (C1): an UNKNOWN condition key. meets() silently ignores keys it does not
// recognize, turning the clause always-true — checkCondition's unknown-key
// rejection must catch the typo. Routed through checkJournalData (any
// checkCondition caller works).
// ---------------------------------------------------------------------------
(function () {
    const journal = cleanJournalData();
    journal.entries[0].when = { qiTypo: 5 };
    runCase("FAIL(C1) condition with an unknown grammar key",
        "checkJournalData", { JOURNAL_DATA: journal }, false, "qiTypo");
})();

// ---------------------------------------------------------------------------
// PASS: clean set-piece + clean Legacy over the set-piece-mounting realm set -> zero errors.
// setpieceRealmData mounts forge (fb) + firstTribulation (s) so the resolve/orphan passes clear;
// the firstTribulation trigger gates on a real clean stage so checkCondition stays quiet.
// ---------------------------------------------------------------------------
runCase("clean set-piece / setpiece data", "checkSetpieceData",
    { REALM_DATA: setpieceRealmData() }, true);
runCase("clean legacy / legacy data", "checkLegacyData", {}, true);

// ---------------------------------------------------------------------------
// FAIL (SP1): a realm setpiece pointer to a PHANTOM key (no SETPIECE_DATA entry) -> the
// resolve pass fires, naming the phantom pointer.
// ---------------------------------------------------------------------------
(function () {
    const realms = setpieceRealmData();
    realms[realms.length - 1].setpiece = "secondTribulation"; // no such SETPIECE_DATA key
    runCase("FAIL(SP1) realm setpiece pointer to a phantom key",
        "checkSetpieceData", { REALM_DATA: realms }, false, "secondTribulation");
})();

// ---------------------------------------------------------------------------
// FAIL (SP2): a tribulation with NO passes:false grade -> the single-failing-grade check fires.
// ---------------------------------------------------------------------------
(function () {
    const setpieces = cleanSetpieceData();
    setpieces.firstTribulation.grades[0].passes = true; // remove the only failing grade
    runCase("FAIL(SP2) tribulation with no failing grade",
        "checkSetpieceData",
        { REALM_DATA: setpieceRealmData(), SETPIECE_DATA: setpieces }, false, "passes:false");
})();

// ---------------------------------------------------------------------------
// FAIL (SP3): passing-grade floors NOT ascending (scarred floor below shaken) -> the
// strictly-ascending passing-floors check fires.
// ---------------------------------------------------------------------------
(function () {
    const setpieces = cleanSetpieceData();
    setpieces.firstTribulation.grades[1].floor = 0.5;  // shaken
    setpieces.firstTribulation.grades[2].floor = 0.35; // scarred — now BELOW shaken
    runCase("FAIL(SP3) tribulation passing floors not ascending",
        "checkSetpieceData",
        { REALM_DATA: setpieceRealmData(), SETPIECE_DATA: setpieces }, false, "strictly ascend");
})();

// ---------------------------------------------------------------------------
// FAIL (SP4): scar debuffQiMultPerDepth >= 1 (a "debuff" that BUFFS) -> the (0,1) range check fires.
// ---------------------------------------------------------------------------
(function () {
    const setpieces = cleanSetpieceData();
    setpieces.scar.debuffQiMultPerDepth = 1.1; // > 1 is a buff masquerading as a debuff
    runCase("FAIL(SP4) scar debuffQiMultPerDepth >= 1 (a debuff that buffs)",
        "checkSetpieceData",
        { REALM_DATA: setpieceRealmData(), SETPIECE_DATA: setpieces }, false, "debuffQiMultPerDepth");
})();

// ---------------------------------------------------------------------------
// FAIL (SP5): the FORGE block missing a required migrated field (the migration-rot case) ->
// the full-forge-shape check fires, naming the dropped field.
// ---------------------------------------------------------------------------
(function () {
    const setpieces = cleanSetpieceData();
    delete setpieces.forge.refinement; // a migration that dropped the refinement loop
    runCase("FAIL(SP5) forge block missing a migrated field",
        "checkSetpieceData",
        { REALM_DATA: setpieceRealmData(), SETPIECE_DATA: setpieces }, false, "refinement");
})();

// ---------------------------------------------------------------------------
// FAIL (L1): legacy weights NOT summing to 1 -> the weight-sum check fires.
// ---------------------------------------------------------------------------
(function () {
    const legacy = cleanLegacyData();
    legacy.actOne.weights.coreGrade = 0.6; // sum now 1.25, off by 0.25 (past the 0.01 tolerance)
    runCase("FAIL(L1) legacy weights not summing to 1",
        "checkLegacyData", { LEGACY_DATA: legacy }, false, "expected 1");
})();

// ---------------------------------------------------------------------------
// FAIL (L2): a legacy band qiMult < 1 (a dead grade) -> the live-consumer (>=1) check fires.
// ---------------------------------------------------------------------------
(function () {
    const legacy = cleanLegacyData();
    legacy.actOne.bands[1].qiMult = 0.9; // a band that PENALIZES — a dead/negative grade
    runCase("FAIL(L2) legacy band qiMult below 1",
        "checkLegacyData", { LEGACY_DATA: legacy }, false, "steady");
})();

// ---------------------------------------------------------------------------
// Dead-mult / cost-fold NEGATIVES (slice-5 review): checkNoDeadMultipliers takes
// (errors, factorySource) — drive it directly with synthetic factory sources so a
// future refactor dropping a consumer or the discount fold is regression-caught.
// In this sandbox no live factory functions exist, so consumerReferences falls
// back to the factorySource scan — exactly the path under test.
// ---------------------------------------------------------------------------
function runDeadMultCase(caseName, factorySource, expectedToken) {
    applyGlobals({});
    const errors = [];
    sandbox.cultivationLintChecks.checkNoDeadMultipliers(errors, factorySource);
    const named = errors.some(function (e) { return e.indexOf(expectedToken) !== -1; });
    const ok = errors.length >= 1 && named;
    if (!ok) anyFailed = true;
    console.log((ok ? "PASS" : "FAIL") + " — " + caseName
        + (ok ? " (error names '" + expectedToken + "')"
              : " (no error naming '" + expectedToken + "': " + errors.join(" | ") + ")"));
}

// FAIL (D1): stipend consumer missing from the factory source -> dead stipend mult.
// The source carries the cost fold (so D1 isolates the consumer) but no sectStipendQiMult.
runDeadMultCase("FAIL(D1) sect stipend qiMult with no consumer",
    "function makeDaoNodeBuyable() { return cost.times(sectLatticeDiscount(node.element)); }",
    "sectStipendQiMult");

// FAIL (D2): the lattice-discount COST FOLD dropped from the dao node cost() while
// SECT_DATA still declares latticeDiscount -> the discount region is dead.
runDeadMultCase("FAIL(D2) declared latticeDiscount with no cost fold",
    "function sectStipendQiMult() { return qiMult; } "
    + "function techniqueQiMult() { return qiMult; } "
    + "function techniqueInsightMult() { return insightMult; } "
    + "function makeDaoNodeBuyable() { return cost; }",
    "sectLatticeDiscount");

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("FIXTURE FAIL — at least one case misbehaved.");
    process.exit(1);
}
console.log("FIXTURE PASS — all two-tree lint cases behaved as expected.");
process.exit(0);
