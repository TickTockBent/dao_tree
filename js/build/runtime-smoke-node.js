// js/build/runtime-smoke-node.js — headless runtime smoke test over the REAL engine.
//
// Usage:  node js/build/runtime-smoke-node.js
//
// This is a HARNESS, not generated/factory code: NOT subject to the §11
// zero-numeric-literal rule and NOT added to scannedBuildFiles. Unlike the
// pacing sim (which re-implements the economy) and the fixture test (which
// checks the linter over synthetic data), this loads the ACTUAL game files —
// break_eternity, layerSupport, the data tables, linter, factory, hint engine,
// mod, temp, game.js — with only Vue/DOM/localStorage stubbed, and drives the
// real doReset() cascade. It exists to prove the compiled tree-scope doReset
// (design §8.1/§8.2) behaves identically to TMT's default cascade in the real
// reset machinery, keep rules included, and that the hint cascade (§1.5)
// tracks live player state.
//
// Asserted behaviors:
//   1. Boot: all layers register; tree-scoped layers carry a compiled doReset,
//      life-scoped layers (b, gate) carry none.
//   2. Fresh save: the hint engine returns the catch-all row.
//   3. q prestige works and resets nothing below it.
//   4. f prestige WITHOUT Peak Foundation: q fully resets (best wiped),
//      Body buyables and gate achievements untouched.
//   5. f prestige WITH Peak Foundation earned: q.best survives (the keep rule),
//      everything else still resets.
//   6. Forced c reset cascades over f and q but never b or gate.
//   7. Hint cascade advances with state (climbQi -> warmCore -> coreComplete).

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");

function fail(message) {
    console.error("RUNTIME SMOKE ERROR: " + message);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Sandbox with the minimal browser surface the engine touches at load/run time.
// ---------------------------------------------------------------------------
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.console = console;
sandbox.setInterval = function () { return 0; };
sandbox.clearInterval = function () {};
sandbox.setTimeout = function () { return 0; };
sandbox.navigator = { userAgent: "node-smoke" };
sandbox.document = {
    getElementById: function () { return null; },
    createElement: function () { return { style: {} }; },
    body: { appendChild: function () {}, removeChild: function () {} },
    title: ""
};
sandbox.localStorage = {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
};
sandbox.Vue = {
    set: function (target, key, value) { target[key] = value; },
    delete: function (target, key) { delete target[key]; }
};
sandbox.confirm = function () { return true; };
sandbox.prompt = function () { return null; };
sandbox.alert = function () {};
sandbox.doPopup = function () {};
// Render-side functions referenced by the engine (canvas.js / Vue app are not loaded).
sandbox.updateWidth = function () {};
sandbox.resizeCanvas = function () {};
sandbox.drawTree = function () {};
const context = vm.createContext(sandbox);

// Load order mirrors index.html, skipping render-only files (Vue app, loader,
// canvas, components, displays, particles, themes).
const engineFiles = [
    "js/technical/break_eternity.js",
    "js/technical/layerSupport.js",
    "js/data/constants.js",
    "js/data/realms.js",
    "js/data/body.js",
    "js/data/gates.js",
    "js/data/trees.js",
    "js/data/keep-rules.js",
    "js/data/lattice.js",
    "js/data/stances.js",
    "js/data/hints.js",
    "js/build/linter.js",
    "js/build/layerFactory.js",
    "js/build/hintEngine.js",
    "js/mod.js",
    "js/layers.js",
    "js/tree.js",
    "js/technical/temp.js",
    "js/game.js",
    "js/utils.js",
    "js/utils/easyAccess.js",
    "js/utils/NumberFormating.js",
    "js/utils/options.js",
    "js/utils/save.js"
];

engineFiles.forEach(function (relative) {
    const full = path.join(projectRoot, relative);
    if (!fs.existsSync(full)) fail("missing engine file: " + full);
    try {
        vm.runInContext(fs.readFileSync(full, "utf8"), context, { filename: relative });
    } catch (loadError) {
        fail("loading " + relative + " threw: " + loadError.stack);
    }
});

// ---------------------------------------------------------------------------
// Boot the player the way loader.js would, minus DOM.
// ---------------------------------------------------------------------------
function boot(expression) {
    try {
        return vm.runInContext(expression, context);
    } catch (runError) {
        fail("evaluating `" + expression + "` threw: " + runError.stack);
    }
}

// Mirror save.js load(): back-reference pass, fresh player, temp build.
boot("updateLayers()");
boot("player = getStartPlayer()");
boot("options = getStartOptions ? getStartOptions() : {}");
boot("needCanvasUpdate = false");
boot("setupTemp(); updateTemp(); updateTemp();");

// ---------------------------------------------------------------------------
// Assertions.
// ---------------------------------------------------------------------------
let anyFailed = false;
function check(name, expression) {
    const ok = !!boot(expression);
    if (!ok) anyFailed = true;
    console.log((ok ? "PASS" : "FAIL") + " — " + name + (ok ? "" : "  [" + expression + "]"));
}

// 1. Boot + doReset topology.
check("boot: q/f/c/b/gate all registered",
    "layers.q && layers.f && layers.c && layers.b && layers.gate");
check("boot: tree-scoped layers carry a compiled doReset",
    "typeof layers.q.doReset === 'function' && typeof layers.f.doReset === 'function' && typeof layers.c.doReset === 'function'");
check("boot: life-scoped layers carry NO doReset (topological immunity)",
    "layers.b.doReset === undefined && layers.gate.doReset === undefined");

// 2. Fresh-save hint = catch-all.
check("hint: fresh save shows the catch-all (gatherQi)",
    "cultivationCurrentHint().key === 'gatherQi'");

// 3. q prestige.
boot("player.points = new Decimal(200); updateTemp(); updateTemp();");
boot("doReset('q')");
check("q prestige: q gains points and Qi resets",
    "player.q.points.gt(0) && player.points.eq(0) && player.q.unlocked === true");
check("hint: q unlocked shows climbQi", "cultivationCurrentHint().key === 'climbQi'");

// 4. f prestige WITHOUT the Peak Foundation milestone.
// Reach f's unlock live: q 6th Level (best >= 90) + 4 primary meridians (buyable 11
// on b), then bank f's requirement in Qi.
boot("player.q.best = new Decimal(90); player.q.points = new Decimal(90);");
boot("setBuyableAmount('b', 11, new Decimal(4))");
boot("updateTemp(); updateTemp(); updateMilestones('q');");
boot("player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
boot("doReset('f')");
check("f prestige (no keep rule earned): f gains", "player.f.points.gt(0) && player.f.unlocked === true");
check("f prestige (no keep rule earned): q fully resets (best wiped)",
    "player.q.points.eq(0) && player.q.best.eq(0)");
check("f prestige: Body buyables untouched (meridians still 4)",
    "getBuyableAmount('b', 11).eq(4)");
check("f prestige: gate layer untouched",
    "player.gate && player.gate.unlocked === true");

// 5. f prestige WITH Peak Foundation earned: q.best survives via the keep rule.
boot("player.f.best = new Decimal(22); updateTemp(); updateMilestones('f');");
check("setup: Peak Foundation milestone earned", "hasMilestone('f', 3)");
boot("player.q.best = new Decimal(90); player.q.points = new Decimal(90); updateMilestones('q');");
boot("player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
boot("doReset('f')");
check("f prestige (keep rule earned): q.best SURVIVES the reset",
    "player.q.best.eq(90)");
check("f prestige (keep rule earned): q.points still reset",
    "player.q.points.eq(0)");

// 6. Forced c reset cascades f and q but never b/gate.
boot("player.f.points = new Decimal(50); player.q.best = new Decimal(90);");
boot("updateTemp(); updateTemp();");
boot("doReset('c', true)");
check("forced c reset: f resets", "player.f.points.eq(0)");
check("forced c reset: Body buyables still untouched", "getBuyableAmount('b', 11).eq(4)");
check("forced c reset: gate layer still untouched", "player.gate.unlocked === true");

// 7. Hint cascade tracks forged-core states. Foundation band 3 (Heaven-grade,
// ceiling Perfect): a Cracked core sits below ceiling -> warmCore; a Perfect
// core sits AT ceiling -> coreComplete.
boot("player.b.foundationGrade = 3; player.b.coreGrade = 0; player.c.unlocked = true; updateTemp();");
check("hint: forged core below ceiling shows warmCore",
    "cultivationCurrentHint().key === 'warmCore'");
boot("player.b.coreGrade = 4; updateTemp();");
check("hint: core at its ceiling shows coreComplete",
    "cultivationCurrentHint().key === 'coreComplete'");

// ---------------------------------------------------------------------------
// Slice 3 — Dao lattice, stances, and hint. Appended after the existing 18
// assertions; the first two lines of each numbered block call boot() to set
// up the minimal state that block exercises. The 4th Level threshold and the
// coreGrade/foundationGrade sentinel indices are read from the loaded data
// tables (no literals). The existing 18 assertions must not be disturbed.
// ---------------------------------------------------------------------------

// State entering this block (from block 7):
//   player.q.unlocked = true,  player.q.best = 0
//   player.f.unlocked = true,  player.f.best = 0
//   player.c.unlocked = true   (set by block 7 setup)
//   player.b.coreGrade = 4,    player.b.foundationGrade = 3
//   player.dao: fresh (revealed false, points 0, activeStance "")
//   player.b.buyables[11] = 4 (meridians set in block 4 and not reset by c)

// 8. Dao layer registered, life-scoped, and carries the correct start-data
//    shape. Life-scoped layers must NOT carry a doReset (topological immunity,
//    same rule block 1 asserts for b and gate). player.dao is seeded at boot.
check("dao: registered and life-scoped",
    "!!layers.dao && TREE_DATA.layers.dao.scope === 'life'");
check("dao: carries NO doReset (life-scope topological immunity)",
    "layers.dao.doReset === undefined");
check("dao: player.dao has Insight points and activeStance in startData",
    "player.dao.points !== undefined && player.dao.activeStance !== undefined");

// 9. Reveal gating: the dao layer must be HIDDEN (tmp.dao.layerShown false)
//    and insightPerSecond() zero until q reaches the 4th Level threshold (at:20,
//    read from REALM_DATA via substageThreshold — no hardcoded number). After
//    setting q.best to that threshold and calling the dao layer's update(),
//    the revealed flag latches and Insight starts accruing.
//
//    The q layer is already unlocked (block 3), so realmBest("q") reads live.
check("dao reveal: hidden and insightPerSecond zero before 4th Level",
    "tmp.dao.layerShown === false && insightPerSecond().eq(0)");
boot("player.q.best = new Decimal(substageThreshold('q', '4th Level')); updateTemp(); updateTemp();");
check("dao reveal: layerShown true once q.best reaches 4th Level threshold",
    "tmp.dao.layerShown === true");
boot("layers.dao.update.call({layer: 'dao'}, 1);");
check("dao reveal: revealed flag latches after first update() tick",
    "player.dao.revealed === true");
check("dao reveal: insightPerSecond() accrues once revealed (baseRate > 0)",
    "insightPerSecond().gt(0)");
check("dao reveal: player.dao.points gained after 1-second update tick",
    "player.dao.points.gt(0)");

// 10. Node purchase. Grant Insight, buy the metal root Glimpse (buyableId 11,
//     cost 100, qiMult 1.03). Before the purchase the ring-2 sword node
//     (buyableId 21, requires: ["metal"]) must be locked; after it is open.
//     The daoNodeQiMult()/daoNodeInsightMult() readers must reflect the tier.
boot("player.dao.points = new Decimal(2000); updateTemp(); updateTemp();");
check("dao nodes: ring-2 sword locked until metal root Glimpse exists",
    "tmp.dao.buyables[21].unlocked === false");
boot("buyBuyable('dao', 11); updateTemp(); updateTemp();");
check("dao nodes: metal root Glimpse bought (buyable amount 1)",
    "getBuyableAmount('dao', 11).eq(1)");
check("dao nodes: Insight deducted by the root Glimpse cost (100)",
    "player.dao.points.lt(2000)");
check("dao nodes: daoNodeQiMult() reflects Glimpse effect (> 1 after purchase)",
    "daoNodeQiMult().gt(1)");
check("dao nodes: ring-2 sword unlocked after metal root Glimpse",
    "tmp.dao.buyables[21].unlocked === true");
boot("buyBuyable('dao', 21); updateTemp(); updateTemp();");
check("dao nodes: sword Glimpse bought (buyable amount 1)",
    "getBuyableAmount('dao', 21).eq(1)");
check("dao nodes: daoNodeInsightMult() reflects sword Glimpse insightMult (> 1)",
    "daoNodeInsightMult().gt(1)");

// 11. Stance toggling. The sword Glimpse just bought unlocks Sword Trance via
//     meets({daoNode:["sword",1]}) — that also proves the meets() daoNode extension.
//     Breathing Trance (clickableId 41) is always available.
//     Semantics (pinned §6.1):
//       - Clicking inactive stance -> activates it; stanceQiMult < 1, insightMult > 1.
//       - Clicking a second stance -> activates it, deactivates the first (maxActive 1).
//       - Clicking the active stance -> deactivates it; multipliers return to identity (1).
check("stances: meets daoNode extension confirms sword Glimpse unlocks Sword Trance",
    "meets({daoNode: ['sword', 1]}) === true && tmp.dao.clickables[42].unlocked === true");
boot("clickClickable('dao', 41);");
check("stances: Breathing Trance active after clicking clickable 41",
    "player.dao.activeStance === 'breathingTrance'");
check("stances: stanceQiMult() < 1 while Breathing Trance active (qi trade-down)",
    "stanceQiMult().lt(1)");
check("stances: stanceInsightMult() > 1 while Breathing Trance active (insight trade-up)",
    "stanceInsightMult().gt(1)");
check("stances: insightPerSecond() rises while Breathing Trance active",
    "insightPerSecond().gt(new Decimal(LATTICE_DATA.insight.baseRate))");
boot("clickClickable('dao', 42);");
check("stances: Sword Trance activates and Breathing Trance deactivates (maxActive 1)",
    "player.dao.activeStance === 'swordTrance'");
boot("clickClickable('dao', 42);");
check("stances: clicking active Sword Trance deactivates it (activeStance returns to none)",
    "player.dao.activeStance === ''");
check("stances: stanceQiMult() identity (1) when no stance active",
    "stanceQiMult().eq(1)");
check("stances: stanceInsightMult() identity (1) when no stance active",
    "stanceInsightMult().eq(1)");

// 12. Persistence. With nodes and a stance active, trigger an f prestige
//     (doReset('f')) and verify player.dao is completely untouched — its node
//     tiers, Insight balance, and activeStance all survive. f is already unlocked
//     (from blocks 4-5); re-establish the f prestige conditions (q 6th Level + 4
//     meridians) from the live state to avoid a second getStartPlayer() call.
boot("clickClickable('dao', 41);"); // Re-activate Breathing Trance before persistence test.
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(substageThreshold('q', '6th Level')); updateTemp(); updateMilestones('q');");
boot("player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
boot("doReset('f'); updateTemp(); updateTemp();");
check("persistence: doReset('f') leaves dao node tiers intact",
    "getBuyableAmount('dao', 11).eq(1) && getBuyableAmount('dao', 21).eq(1)");
check("persistence: doReset('f') leaves dao Insight balance intact",
    "player.dao.points.gt(0)");
check("persistence: doReset('f') leaves dao activeStance intact",
    "player.dao.activeStance === 'breathingTrance'");
check("persistence: doReset('f') leaves dao revealed flag intact",
    "player.dao.revealed === true");

// 13. Hint: openLattice fires in the 4th-Level window. The coreComplete /
//     chooseForge hints from block 7 and the climbFoundation hint triggered by
//     the persistence-test f prestige all shadow openLattice in later game; reset
//     those guards here so the intended 4th-Level window is actually exercised.
//     coreGrade and c.unlocked are restored to their pre-forge sentinels (data
//     values, no literals); f.best is zeroed so climbFoundation (fires at
//     "Early Foundation" at:1) does not shadow; q.best is set below 6th Level
//     so breakToFoundation does not shadow.
boot("player.b.coreGrade = BODY_DATA.grades.coreGrade.startIndex; player.c.unlocked = false; player.f.best = new Decimal(0); updateTemp();");
boot("player.q.best = new Decimal(substageThreshold('q', '4th Level')); updateTemp(); updateTemp();");
check("hint: openLattice fires in the 4th-Level window (no higher-priority hint matches)",
    "cultivationCurrentHint().key === 'openLattice'");

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("RUNTIME SMOKE FAIL — at least one engine behavior diverged.");
    process.exit(1);
}
console.log("RUNTIME SMOKE PASS — real-engine reset cascade, keep rule, and hint cascade all behave.");
process.exit(0);
