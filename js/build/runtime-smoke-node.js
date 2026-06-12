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
    "js/data/automation.js",
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
// Slice 4 — Nascent Soul: n layer, Soul Aspect, Automation, Endgame, Hints.
// Appended after the existing 47 assertions (blocks 1-13). State entering this
// block is documented at the top of the slice-3 section and confirmed by the
// setup in block 13:
//   player.b.coreGrade  = BODY_DATA.grades.coreGrade.startIndex (-1, not forged)
//   player.b.foundationGrade = 3 (Heaven-grade band)
//   player.b.soulAspect = "" (unchosen)
//   player.c.unlocked   = false
//   player.f.best       = 0
//   player.q.best       = substageThreshold('q','4th Level') (20)
//   player.q.unlocked   = true
//   player.n.unlocked   = false, n.best = 0
//   player.dao.revealed = true, dao.points = 1650 (post-glimpse/f-prestige balance)
//   dao 11 (metal) = 1, dao 21 (sword) = 1   (from blocks 10-11)
//   b buyable 11 (primary meridians) = 4      (from blocks 4-5, not reset by c)
// ---------------------------------------------------------------------------

// 14. n registration and tree-scope. Verifies:
//     a. the n realm was actually registered by the factory (it is present in layers)
//     b. TREE_DATA says it is tree-scoped, in act1
//     c. it carries a compiled doReset (tree-scoped layers always do)
//     d. the automation.js data file was loaded into this vm context (the pre-authorized
//        engine-file addition from the boot block already lists it at line 91)
check("slice-4 boot: n registered in layers",
    "!!layers.n");
check("slice-4 boot: n is tree-scoped in act1",
    "TREE_DATA.layers.n.scope === 'tree' && TREE_DATA.layers.n.tree === 'act1'");
check("slice-4 boot: n carries a compiled doReset (tree-scoped)",
    "typeof layers.n.doReset === 'function'");
check("slice-4 boot: AUTOMATION_DATA loaded with exactly 3 rows",
    "Array.isArray(AUTOMATION_DATA) && AUTOMATION_DATA.length === 3");

// 15. n prestige cascade and carried-artifact core. Set up all prerequisites:
//     forged core (b.coreGrade = 0, the first ladder index), c.best >= 2 (Core Refined,
//     the n unlock gate per REALM_DATA n.unlock), and enough Qi to break through.
//     Then drive the prestige and verify:
//     a. c / f / q reset (standard cascade: n row 3 > c row 2 > f row 1 > q row 0)
//     b. the Core GRADE on the Body layer SURVIVES (life-scoped carried artifact, §5)
//     c. coreIsForged() still reports true after the wipe of c's realm state
//     d. forgeIsAvailable() is false (coreIsForged() guards it — never re-forge)
//
//     NOTE: isEndgame() must be false throughout. n.best will be 1 after this prestige.
boot("player.b.coreGrade = 0;");
boot("player.c.unlocked = true; player.c.best = new Decimal(2); player.c.points = new Decimal(2);");
boot("player.f.unlocked = true; player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(substageThreshold('q', '6th Level')); updateMilestones('q');");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='n';}).reqBase); updateTemp(); updateTemp();");
check("slice-4 cascade: before n prestige, isEndgame() false",
    "!isEndgame()");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-4 cascade: n.best = 1 after first breakthrough",
    "player.n.best.eq(1)");
check("slice-4 cascade: c resets on n prestige (c.points = 0)",
    "player.c.points.eq(0)");
check("slice-4 cascade: f resets on n prestige (f.points = 0)",
    "player.f.points.eq(0)");
check("slice-4 cascade: q resets on n prestige (q.points = 0)",
    "player.q.points.eq(0)");
check("slice-4 cascade: core GRADE survives n prestige (life-scoped carried artifact)",
    "player.b.coreGrade === 0");
check("slice-4 cascade: coreIsForged() true after n prestige (grade on b, not c)",
    "coreIsForged() === true");
check("slice-4 cascade: forgeIsAvailable() false after n prestige (never re-forge)",
    "forgeIsAvailable() === false");
check("slice-4 cascade: dao buyables untouched by n prestige (life-scoped)",
    "getBuyableAmount('dao', 11).eq(1) && getBuyableAmount('dao', 21).eq(1)");

// 16. Keep rule: foundationSurvivesNascentSoul. n milestone 2 is "Late Nascent Soul"
//     (KEEP_RULES row, grantedBy { layer:'n', milestone:2 }), earned when n.best >= 12.
//     Without it a second n prestige wipes f.best; with it, f.best survives.
//
//     Phase A — no keep rule yet (n.best = 1 from block 15):
boot("player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.c.best = new Decimal(2); player.c.points = new Decimal(2);");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='n';}).reqBase); updateTemp(); updateTemp();");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-4 keep rule: f.best WIPES on n prestige without the keep rule (n.best < 12)",
    "player.f.best.eq(0)");
//     Phase B — earn n milestone 2 by setting n.best >= 12, then prestige again:
boot("player.n.best = new Decimal(12); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 keep rule: n milestone 2 earned (Late Nascent Soul)",
    "hasMilestone('n', 2)");
boot("player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.c.best = new Decimal(2); player.c.points = new Decimal(2);");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='n';}).reqBase); updateTemp(); updateTemp();");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-4 keep rule: f.best SURVIVES n prestige once n milestone 2 is earned",
    "player.f.best.eq(22)");
check("slice-4 keep rule: f.points still resets (only best is kept)",
    "player.f.points.eq(0)");

// 17. Soul Aspect pick semantics. State entering this sub-block:
//     n.best = whatever the last prestige left (>= 1 from block 15 onward); soulAspect = "".
//     The clickables are VISIBLE only after the first n breakthrough AND while unchosen.
//     Formless (clickable index 0) is always clickable; a metal-element aspect
//     (clickable index 1) needs a held Seed (tier 2) of a metal Dao node.
//
//     (a) Before first n prestige (reset n.best to 0) — no clickable should be actionable.
//         n.best was set to 12 in block 16 phase B; reset it so the clickables vanish.
boot("player.b.soulAspect = ''; player.n.best = new Decimal(0); player.n.unlocked = false;");
boot("updateMilestones('n'); updateTemp(); updateTemp();");
// Before the first n breakthrough: all aspect clickables are hidden (unlocked=false).
// clickClickable() guards on unlocked; a hidden clickable cannot be activated regardless
// of canClick. Verify the Formless clickable (index 0) is NOT unlocked = not actionable.
check("slice-4 aspect: clickable 0 (Formless) NOT unlocked before first n prestige",
    "tmp.n.clickables[0].unlocked === false");
// Clicking a not-unlocked clickable must not store the aspect (verify no side-effect).
// clickClickable checks unlocked before calling onClick; so player.b.soulAspect stays "".
boot("clickClickable('n', 0);");
check("slice-4 aspect: clicking Formless while not-unlocked does NOT store the aspect",
    "player.b.soulAspect === ''");
//     (b) After first breakthrough: Formless unlocked+clickable; metalSoul needs a metal Seed.
boot("player.n.unlocked = true; player.n.best = new Decimal(1); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 aspect: clickable 0 (Formless) unlocked after first n prestige",
    "tmp.n.clickables[0].unlocked === true");
check("slice-4 aspect: clickable 0 (Formless) always clickable (requires {} met)",
    "tmp.n.clickables[0].canClick === true");
check("slice-4 aspect: clickable 1 (metalSoul) unlocked but NOT clickable (no metal Seed yet)",
    "tmp.n.clickables[1].unlocked === true && tmp.n.clickables[1].canClick === false");
//     (c) After buying the metal root SEED (tier 2): the metalSoul clickable becomes clickable.
//         dao.points is sufficient for one more buy (Seed cost = 300; current balance from block 10
//         after the Glimpse buy was ~1650; subsequent blocks didn't spend much from dao).
//         Force-set dao.points to a safe amount if needed.
boot("player.dao.points = new Decimal(1000); updateTemp(); updateTemp();");
boot("buyBuyable('dao', 11); updateTemp(); updateTemp();");
check("slice-4 aspect: metal root at tier 2 (Seed) after second buy",
    "getBuyableAmount('dao', 11).eq(2)");
check("slice-4 aspect: meets daoElementTier metal 2 after Seed purchase",
    "meets({daoElementTier: ['metal', 2]}) === true");
check("slice-4 aspect: clickable 1 (metalSoul) NOW clickable (metal Seed held)",
    "tmp.n.clickables[1].canClick === true");
//     (d) Pick Formless (clickable 0): stores key, multipliers move off identity.
boot("clickClickable('n', 0); updateTemp(); updateTemp();");
check("slice-4 aspect: picking Formless stores 'formless' in player.b.soulAspect",
    "player.b.soulAspect === 'formless'");
check("slice-4 aspect: soulAspectRow() resolves to the formless row",
    "soulAspectRow() !== null && soulAspectRow().key === 'formless'");
check("slice-4 aspect: soulAspectQiMult() moves off identity after picking Formless",
    "soulAspectQiMult().gt(1)");
check("slice-4 aspect: soulAspectInsightMult() moves off identity after picking Formless",
    "soulAspectInsightMult().gt(1)");
check("slice-4 aspect: cultivationQiPerSecond() includes the aspect qi multiplier",
    "cultivationQiPerSecond().gte(qiBaseRate().times(soulAspectQiMult()))");
check("slice-4 aspect: insightPerSecond() includes the aspect insight multiplier",
    "insightPerSecond().gte(new Decimal(LATTICE_DATA.insight.baseRate).times(soulAspectInsightMult()))");
//     (e) Once chosen, all aspect clickables vanish (unlocked = false) — no respec.
check("slice-4 aspect: clickable 0 unlocked = false once aspect chosen (once per life)",
    "tmp.n.clickables[0].unlocked === false");
check("slice-4 aspect: clickable 1 unlocked = false once aspect chosen",
    "tmp.n.clickables[1].unlocked === false");
//     (f) Aspect SURVIVES an n/c/f/q prestige (life-scoped on b, never reset).
boot("player.c.best = new Decimal(2); player.c.points = new Decimal(2);");
boot("player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='n';}).reqBase); updateTemp(); updateTemp();");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-4 aspect: soulAspect SURVIVES n prestige (life-scoped on b)",
    "player.b.soulAspect === 'formless'");
check("slice-4 aspect: soulAspectQiMult() still > 1 after n prestige",
    "soulAspectQiMult().gt(1)");

// 18. Automation Tier 1. State: n.best >= 1 from the prestige above (hasMilestone n 0 = true).
//
//     (a) Verify tmp.q.autoPrestige is driven by layerPrestigeAutomated('q'):
//         n milestone 0 is earned, so automationGranted(AUTOMATION_DATA[0]) must be true.
//         The "at threshold" gate (gainFraction) is trivially met at q.points = 0.
boot("player.q.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-4 auto: tmp.q.autoPrestige true once n milestone 0 is held",
    "tmp.q.autoPrestige === true");
check("slice-4 auto: automationGranted returns true for the nascentQiPrestige row",
    "automationGranted(AUTOMATION_DATA[0]) === true");
check("slice-4 auto: automationGranted returns true for nascentPrimaryMeridians",
    "automationGranted(AUTOMATION_DATA[1]) === true");
//     (b) Before n milestone 0 was earned (reset n to factory state):
//         tmp.q.autoPrestige must be false and meridian auto-buy must not fire.
boot("player.n.best = new Decimal(0); player.n.unlocked = false; updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 auto: tmp.q.autoPrestige FALSE before n milestone 0",
    "tmp.q.autoPrestige === false");
check("slice-4 auto: automationGranted false for nascentQiPrestige before milestone 0",
    "automationGranted(AUTOMATION_DATA[0]) === false");
boot("setBuyableAmount('b', 11, new Decimal(0)); player.points = new Decimal(10000); updateTemp(); updateTemp();");
boot("layers.b.automate();");
check("slice-4 auto: meridian auto-buy does NOT fire before n milestone 0",
    "getBuyableAmount('b', 11).eq(0)");
//     (c) Restore n milestone 0: auto-buy fires when affordable.
boot("player.n.unlocked = true; player.n.best = new Decimal(1); updateMilestones('n'); updateTemp(); updateTemp();");
boot("setBuyableAmount('b', 11, new Decimal(0)); player.points = new Decimal(10000); updateTemp(); updateTemp();");
boot("layers.b.automate();");
check("slice-4 auto: meridian auto-buy fires after n milestone 0 (some bought from 10k Qi pool)",
    "getBuyableAmount('b', 11).gt(0)");
//     (d) q auto-prestige fires through the gameLoop path when canReset.
//         Give q enough Qi to canReset; the tmp.q.autoPrestige flag is read by gameLoop,
//         which calls doReset(q). Drive one update tick then one loop pass. q.points
//         is zeroed first so the gainFraction threshold is trivially satisfied.
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(0);");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='q';}).reqBase * 2); updateTemp(); updateTemp();");
check("slice-4 auto: tmp.q.canReset true before gameLoop tick",
    "tmp.q.canReset === true");
check("slice-4 auto: tmp.q.autoPrestige true before gameLoop tick",
    "tmp.q.autoPrestige === true");
boot("gameLoop(0.001); updateTemp(); updateTemp();");
check("slice-4 auto: q auto-prestiges when canReset (q.points > 0 after gameLoop)",
    "player.q.points.gt(0)");
//     (e) purchaseLimit respected: meridians at cap (12) must not overflow.
boot("setBuyableAmount('b', 11, new Decimal(BODY_DATA.buyables[0].limit)); player.points = new Decimal(100000); updateTemp(); updateTemp();");
boot("layers.b.automate();");
check("slice-4 auto: auto-buy respects purchaseLimit (meridians stay at cap)",
    "getBuyableAmount('b', 11).eq(BODY_DATA.buyables[0].limit)");
//     (f) END-TO-END: the buyable automation must fire through the ENGINE's own loop
//         (game.js OTHER_LAYERS sweep invoking layers.b.automate()), not only when the
//         harness calls the hook directly — proving the side-layer automate path runs.
//         q.points is set HUGE so the gainFraction threshold parks q auto-prestige
//         (which runs in the tree loop BEFORE the side loop and would otherwise zero
//         the Qi the autobuy needs — the starvation bug this threshold exists to stop).
boot("player.q.points = new Decimal(1e9); setBuyableAmount('b', 11, new Decimal(4)); player.points = new Decimal(10000); updateTemp(); updateTemp();");
boot("gameLoop(0.001); updateTemp(); updateTemp();");
check("slice-4 auto: meridian auto-buy fires through a real gameLoop tick (engine automate sweep)",
    "getBuyableAmount('b', 11).gt(4)");
//     (g) The "at threshold" semantics (design §5): with q.points huge, the pending
//         gain is far below gainFraction x current, so auto-prestige must hold OFF
//         even though canReset is true; with q.points back at zero it fires again.
check("slice-4 auto: auto-prestige holds off below the gainFraction threshold",
    "tmp.q.autoPrestige === false && tmp.q.canReset === true");
boot("player.q.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-4 auto: auto-prestige resumes once the gain clears the threshold",
    "tmp.q.autoPrestige === true");

// 19. Endgame sentinel. cultivationEndgameReached() and isEndgame() must be false
//     through all prior blocks and only flip true once n.best reaches the LAST substage.
//     Read the threshold from the data table — never a literal.
check("slice-4 endgame: isEndgame() false while n.best < last substage threshold",
    "!isEndgame() && !cultivationEndgameReached()");
boot("var nLastSubstage = REALM_DATA.find(function(r){return r.id==='n';}).substages; var nLastAt = nLastSubstage[nLastSubstage.length-1].at; player.n.best = new Decimal(nLastAt - 1); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 endgame: isEndgame() still false one below the last threshold",
    "!isEndgame()");
boot("var nLastSubstage2 = REALM_DATA.find(function(r){return r.id==='n';}).substages; var nLastAt2 = nLastSubstage2[nLastSubstage2.length-1].at; player.n.best = new Decimal(nLastAt2); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 endgame: cultivationEndgameReached() true once n.best >= last substage threshold",
    "cultivationEndgameReached() === true");
check("slice-4 endgame: isEndgame() true at last n substage (mod.js delegates to factory)",
    "isEndgame() === true");

// 20. Hint cascade. Three windows exercised:
//     (a) chooseAspect: n unlocked + soulAspect unchosen. Reset soulAspect first;
//         n.best is still >= last substage from block 19, so climbNascent would also match
//         but chooseAspect sits higher in the cascade (row 1 vs row 2) and wins.
boot("player.b.soulAspect = ''; updateTemp(); updateTemp();");
check("slice-4 hints: chooseAspect fires when n unlocked and aspect unchosen",
    "cultivationCurrentHint().key === 'chooseAspect'");
//     (b) climbNascent: aspect is chosen (row 1 no longer matches); n is at Early NS
//         (n.best >= 1). Row 2 (climbNascent: realm ['n','Early Nascent Soul']) should match.
boot("player.b.soulAspect = 'formless'; updateTemp(); updateTemp();");
check("slice-4 hints: climbNascent fires after aspect chosen (row 2, below chooseAspect)",
    "cultivationCurrentHint().key === 'climbNascent'");
//     (c) enterTrance: any dao node owned at Glimpse tier AND q.best < 4th Level threshold
//         so openLattice (row 8) does not shadow it. Also need: no coreForged (warmCore/
//         coreComplete rows), no foundation (climbFoundation), no c unlocked (chooseForge),
//         no n unlocked (chooseAspect/climbNascent). The dao reveal flag stays latched so
//         Insight persisted. q.best is set just BELOW 4th Level (openLattice fires at 4th Level).
//         Metal root Glimpse (dao 11 = 1 from block 17 buying) is still owned. Verify.
boot("player.n.unlocked = false; player.n.best = new Decimal(0);");
boot("player.b.coreGrade = BODY_DATA.grades.coreGrade.startIndex;");
boot("player.c.unlocked = false; player.f.best = new Decimal(0);");
boot("player.b.soulAspect = '';");
boot("player.q.best = new Decimal(substageThreshold('q', '4th Level') - 1); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 hints: metal root Glimpse still owned (dao 11 >= 1)",
    "getBuyableAmount('dao', 11).gte(1)");
check("slice-4 hints: enterTrance fires in first-Glimpse window (q below 4th Level)",
    "cultivationCurrentHint().key === 'enterTrance'");

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("RUNTIME SMOKE FAIL — at least one engine behavior diverged.");
    process.exit(1);
}
console.log("RUNTIME SMOKE PASS — real-engine reset cascade, keep rule, and hint cascade all behave.");
process.exit(0);
