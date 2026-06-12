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
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("RUNTIME SMOKE FAIL — at least one engine behavior diverged.");
    process.exit(1);
}
console.log("RUNTIME SMOKE PASS — real-engine reset cascade, keep rule, and hint cascade all behave.");
process.exit(0);
