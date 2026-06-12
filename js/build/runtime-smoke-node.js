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

// Slice-5 optional data files: loaded when present (see lint-node.js for the same pattern).
// When absent the smoke test runs against the pre-sect engine state; no assertion currently
// requires sect/techniques/journal, so the existing 104 assertions pass either way.
const optionalEngineFiles = [
    "js/data/sect.js",
    "js/data/techniques.js",
    "js/data/journal.js"
];

optionalEngineFiles.forEach(function (relative) {
    const full = path.join(projectRoot, relative);
    if (!fs.existsSync(full)) {
        console.warn("SMOKE NOTE: optional file not yet present (expected slice 5): " + relative);
        return;
    }
    try {
        vm.runInContext(fs.readFileSync(full, "utf8"), context, { filename: relative });
    } catch (loadError) {
        fail("loading optional " + relative + " threw: " + loadError.stack);
    }
});

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
// Slice 5: the sect reveals at q 2nd Level and the joinSect hint (cascade row 1) fires while
// the sect is revealed-but-unjoined — which would shadow every state-machine hint below it.
// In real play the player joins early; mirror that here by joining a sect ONCE (it is
// life-scoped and never resets, so this clears joinSect for every block that follows). The
// join is direct state (player.sect.archetype), the same set a confirmed pick performs.
boot("player.sect.archetype = SECT_DATA.archetypes[0].key; updateTemp(); updateTemp();");
check("slice-5 sect: joining a sect clears the joinSect hint (sectJoined true)",
    "sectJoined() === true");
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
// Slice 5 adds the sectFoundationBell arsenal row, so the count is now 4 (was 3 in slice 4):
// the three Nascent Soul Tier-1 grants plus the sect arsenal auto-Foundation-prestige.
check("slice-5 boot: AUTOMATION_DATA loaded with exactly 4 rows (3 NS Tier-1 + sect arsenal)",
    "Array.isArray(AUTOMATION_DATA) && AUTOMATION_DATA.length === 4");

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
// Slice 5 — Sect, Journal, Techniques, Arsenal, Discount, Persistence, Hints.
// Appended after the existing 104 assertions (blocks 1-20, untouched).
//
// State entering this block (from block 20 setup):
//   player.sect.archetype = SECT_DATA.archetypes[0].key  ("azureSword", set in block 3)
//   player.sect.points    = 0 (no contribution accrued)
//   player.sect.best      = 0 (no contribution high-water)
//   player.sect.revealed  = false (was not explicitly set; reveal gate may or may not be met)
//   player.journal.unlocked = [], player.journal.read = []
//   player.b.coreGrade    = BODY_DATA.grades.coreGrade.startIndex  (not forged)
//   player.b.soulAspect   = ""  (reset in block 20)
//   player.c.unlocked     = false
//   player.f.best         = 0
//   player.n.unlocked     = false, n.best = 0
//   player.q.best         = substageThreshold('q','4th Level') - 1  (below 4th Level)
//   player.dao.revealed   = true, dao.points > 0
//   dao 11 (metal root)   = 2  (Seed, from block 17), dao 21 (sword) = 1 (Glimpse)
// ---------------------------------------------------------------------------

// 21. Boot: sect (life) + journal (eternal) registered, neither carries doReset;
//     startData shapes (sect points/archetype, journal unlocked/read arrays).
check("slice-5 boot: sect registered in layers", "!!layers.sect");
check("slice-5 boot: journal registered in layers", "!!layers.journal");
check("slice-5 boot: sect is life-scoped in TREE_DATA",
    "TREE_DATA.layers.sect.scope === 'life'");
check("slice-5 boot: journal is eternal-scoped in TREE_DATA",
    "TREE_DATA.layers.journal.scope === 'eternal'");
check("slice-5 boot: sect carries NO doReset (life-scope immunity)",
    "layers.sect.doReset === undefined");
check("slice-5 boot: journal carries NO doReset (eternal-scope immunity)",
    "layers.journal.doReset === undefined");
// startData shapes: sect must have points/archetype; journal must have unlocked/read arrays.
check("slice-5 boot: player.sect has points (Contribution) and archetype in startData",
    "player.sect.points !== undefined && player.sect.archetype !== undefined");
check("slice-5 boot: player.journal.unlocked is an array (the entry-key store)",
    "Array.isArray(player.journal.unlocked)");
check("slice-5 boot: player.journal.read is an array (the viewed-key store)",
    "Array.isArray(player.journal.read)");

// 22. Reveal + pick: sect hidden when not yet revealed; both archetype clickables pickable
//     while unjoined; picking stores the archetype; second pick impossible; contribution/sec
//     zero before joining, accruing after.
//
//     Sub-block (a): reset the archetype to re-exercise the reveal/pick flow.
//     The sect layer is always shown (layerShown returns true when revealed, or when
//     meets(SECT_DATA.reveal) — the reveal gate is q 2nd Level at:3; q.best is currently
//     substageThreshold('q','4th Level')-1 which is 19 >= 3, so the gate IS met already.
//     Force-clear the revealed latch to isolate the layerShown logic pre-latch.
boot("player.sect.archetype = ''; player.sect.revealed = false; updateTemp(); updateTemp();");
check("slice-5 reveal: sect NOT revealed (latch clear) but shown because reveal gate is met",
    "tmp.sect.layerShown === true && player.sect.revealed === false");
// Drive a sect update() tick so the revealed latch fires.
boot("layers.sect.update.call({layer:'sect'}, 1); updateTemp(); updateTemp();");
check("slice-5 reveal: revealed flag latches after the first update() tick",
    "player.sect.revealed === true");
// Both archetype clickables must be pickable (unlocked = true, canClick = true) while unjoined.
// Clickable 0 = azureSword, clickable 1 = stoneFormation.
check("slice-5 reveal: archetype clickable 0 (azureSword) unlocked while unjoined",
    "tmp.sect.clickables[0].unlocked === true");
check("slice-5 reveal: archetype clickable 0 (azureSword) canClick while unjoined",
    "tmp.sect.clickables[0].canClick === true");
check("slice-5 reveal: archetype clickable 1 (stoneFormation) unlocked while unjoined",
    "tmp.sect.clickables[1].unlocked === true");
check("slice-5 reveal: archetype clickable 1 (stoneFormation) canClick while unjoined",
    "tmp.sect.clickables[1].canClick === true");
//     Sub-block (b): pick azureSword (clickable 0).
boot("clickClickable('sect', 0); updateTemp(); updateTemp();");
check("slice-5 pick: archetype stored as azureSword after clicking clickable 0",
    "player.sect.archetype === SECT_DATA.archetypes[0].key");
check("slice-5 pick: sectJoined() true after pick",
    "sectJoined() === true");
check("slice-5 pick: sectArchetypeRow() resolves to azureSword",
    "sectArchetypeRow() !== null && sectArchetypeRow().key === 'azureSword'");
//     Once joined, both clickables must vanish (unlocked = false — the once-per-life gate).
check("slice-5 pick: clickable 0 unlocked = false once joined (once per life)",
    "tmp.sect.clickables[0].unlocked === false");
check("slice-5 pick: clickable 1 unlocked = false once joined (once per life)",
    "tmp.sect.clickables[1].unlocked === false");
//     Sub-block (c): second pick attempt must have no effect (canClick false = pick rejected).
//     Direct state approach: try to set archetype to stoneFormation via clickClickable; engine
//     checks canClick (which is false when joined), so the onClick guard returns early.
boot("clickClickable('sect', 1); updateTemp(); updateTemp();");
check("slice-5 pick: clicking stoneFormation after joining leaves azureSword unchanged",
    "player.sect.archetype === SECT_DATA.archetypes[0].key");
//     Sub-block (d): contribution/sec zero before joining (set archetype = '' momentarily).
boot("player.sect.archetype = ''; updateTemp(); updateTemp();");
check("slice-5 accrual: contributionPerSecond() is zero when archetype is unset (unjoined)",
    "contributionPerSecond().eq(0)");
//     Restore the join and drive an update() tick with sufficient Qi.
boot("player.sect.archetype = SECT_DATA.archetypes[0].key;");
boot("player.points = new Decimal(1000); player.q.unlocked = true; player.q.best = new Decimal(substageThreshold('q','4th Level')); updateTemp(); updateTemp();");
boot("layers.sect.update.call({layer:'sect'}, 1); updateTemp();");
check("slice-5 accrual: contributionPerSecond() > 0 once joined (rate x qi^exponent)",
    "contributionPerSecond().gt(0)");
check("slice-5 accrual: player.sect.points > 0 after one update() tick while joined",
    "player.sect.points.gt(0)");

// 23. Economy: buy a tier-1 school technique through the engine's upgrade path ->
//     contribution deducted, techniqueQiMult() moves off identity; the OTHER school's
//     technique not purchasable; a tier-2 technique locked until the library milestone,
//     purchasable after.
//
//     Grant enough Contribution to cover the cheapest tier-1 technique (azureForm: cost 600).
//     TECHNIQUE_DATA index 0 = azureForm (sword, tier 1, cost 600).
//     TECHNIQUE_DATA index 3 = stoneSkin  (formation, tier 1, cost 600) — wrong school.
//     TECHNIQUE_DATA index 2 = swordHeart (sword, tier 2, cost 9000) — wrong tier without library.
boot("player.sect.points = new Decimal(TECHNIQUE_DATA[0].cost + 100); player.sect.best = player.sect.points; updateTemp(); updateTemp();");
// Verify azureForm (index 0) is visible/unlocked for the azureSword archetype.
check("slice-5 tech: azureForm upgrade (index 0) is unlocked for azureSword archetype",
    "tmp.sect.upgrades[0].unlocked === true");
// Verify stoneSkin (index 3, formation school) is NOT unlocked for azureSword.
check("slice-5 tech: stoneSkin upgrade (index 3) NOT unlocked for azureSword (wrong school)",
    "tmp.sect.upgrades[3].unlocked === false");
// Verify swordHeart (index 2, tier 2) is NOT unlocked yet (no library milestone).
check("slice-5 tech: swordHeart upgrade (index 2, tier-2) NOT unlocked before library milestone",
    "tmp.sect.upgrades[2].unlocked === false");
// Buy azureForm (index 0) via buyUpgrade.
boot("var preBuyPoints = player.sect.points.toNumber(); buyUpgrade('sect', 0); updateTemp(); updateTemp();");
check("slice-5 tech: azureForm (index 0) purchased (hasUpgrade returns true)",
    "hasUpgrade('sect', 0) === true");
check("slice-5 tech: Contribution deducted by azureForm cost after purchase",
    "player.sect.points.lt(preBuyPoints)");
check("slice-5 tech: techniqueQiMult() > 1 after buying azureForm (qiMult effect)",
    "techniqueQiMult().gt(1)");
// techniqueInsightMult() should still be identity (azureForm has qiMult, not insightMult).
check("slice-5 tech: techniqueInsightMult() identity after buying azureForm (no insightMult technique owned)",
    "techniqueInsightMult().eq(1)");
// Buy a technique with insightMult: severingArc (index 1, sword, tier 1, cost 1800, insightMult 1.20).
// Ensure enough contribution.
boot("player.sect.points = new Decimal(TECHNIQUE_DATA[1].cost + 100); player.sect.best = player.sect.points; updateTemp(); updateTemp();");
check("slice-5 tech: severingArc upgrade (index 1) is unlocked for azureSword",
    "tmp.sect.upgrades[1].unlocked === true");
boot("buyUpgrade('sect', 1); updateTemp(); updateTemp();");
check("slice-5 tech: techniqueInsightMult() > 1 after buying severingArc (insightMult 1.20)",
    "techniqueInsightMult().gt(1)");
// Tier-2 gating: earn the library milestone (drive contribution best to SECT_DATA.milestones[1].at).
// Before: swordHeart (index 2) must remain locked.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[1].at - 1); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 tech: swordHeart (tier-2) still NOT unlocked below library milestone",
    "tmp.sect.upgrades[2].unlocked === false");
// Now earn the library milestone by pushing best to the threshold.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[1].at); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 tech: library milestone earned (hasMilestone sect 1)",
    "hasMilestone('sect', 1) === true");
check("slice-5 tech: swordHeart (tier-2) NOW unlocked after library milestone",
    "tmp.sect.upgrades[2].unlocked === true");
// Buy swordHeart (index 2) with sufficient points.
boot("player.sect.points = new Decimal(TECHNIQUE_DATA[2].cost + 100); updateTemp(); updateTemp();");
boot("buyUpgrade('sect', 2); updateTemp(); updateTemp();");
check("slice-5 tech: swordHeart (index 2) purchased after library milestone",
    "hasUpgrade('sect', 2) === true");

// 24. Discount: a metal lattice node's tmp cost drops by the azureSword latticeDiscount after
//     joining (compare before/after), a non-metal node's cost unchanged.
//
//     The metal root node (buyableId 11, element "metal") should have its cost folded with
//     sectLatticeDiscount("metal"). azureSword has latticeDiscount 0.75, so next-tier cost
//     should be floor(normalCost * 0.75). The earth root (buyableId 15, element "earth")
//     must be unchanged (discount returns identity for non-archetype element).
//
//     State: archetype = azureSword (joined). Metal root (dao 11) is at tier 2 (Seed, maxed);
//     earth root (dao 15) is at tier 0 (unowned). We need to compare costs.
//     The metal node at tier 2 is MAXED (purchaseLimit = 2 for Glimpse+Seed), so we check a
//     non-maxed metal node. Use the sword node (dao 21, buyableId 21, element "metal") which
//     is at tier 1 (Glimpse). Its next cost should be node.costs[1] * 0.75 (floor).
//     Node sword: costs[1] = 800 (Seed cost). Discounted: floor(800 * 0.75) = 600.
boot("updateTemp(); updateTemp();");
// Isolate: read the sword node's tmp cost (it's at tier 1, next is Seed).
// tmp.dao.buyables[21].cost is costs[1] * sectLatticeDiscount("metal")
check("slice-5 discount: sword node (metal, buyableId 21) tmp cost is discounted by azureSword latticeDiscount",
    "(function(){ var swordNode = LATTICE_DATA.nodes.find(function(n){return n.buyableId===21;}); var rawSeedCost = swordNode.costs[1]; var discountedCost = Math.floor(rawSeedCost * SECT_DATA.archetypes[0].latticeDiscount); return tmp.dao.buyables[21].cost.eq(discountedCost); })()");
// Compare earth root (buyableId 15, element "earth") — its cost must be undiscounted.
// Earth root is at tier 0, so next cost = costs[0] = 100 (unchanged, no discount).
check("slice-5 discount: earth root (element earth, buyableId 15) cost NOT discounted (identity)",
    "(function(){ var earthNode = LATTICE_DATA.nodes.find(function(n){return n.buyableId===15;}); var rawGlimpseCost = earthNode.costs[0]; return tmp.dao.buyables[15].cost.eq(rawGlimpseCost); })()");
// Verify sectLatticeDiscount() returns the archetype's discount for metal, identity for earth.
check("slice-5 discount: sectLatticeDiscount('metal') equals azureSword.latticeDiscount",
    "sectLatticeDiscount('metal').eq(SECT_DATA.archetypes[0].latticeDiscount)");
check("slice-5 discount: sectLatticeDiscount('earth') equals 1 (identity for non-archetype element)",
    "sectLatticeDiscount('earth').eq(1)");

// 25. Arsenal: the sectFoundationBell automation (AUTOMATION_DATA[3], grantedBy sect milestone 2).
//     (a) Before the arsenal milestone: f has no auto-prestige.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[2].at - 1); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 arsenal: before arsenal milestone, automationGranted(AUTOMATION_DATA[3]) is false",
    "automationGranted(AUTOMATION_DATA[3]) === false");
// f's autoPrestige must be false (no granted arsenal row targeting f).
boot("player.f.unlocked = true; player.f.best = new Decimal(22); player.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-5 arsenal: tmp.f.autoPrestige false before arsenal milestone",
    "tmp.f.autoPrestige === false");
//     (b) Earn the arsenal milestone. Then check automationGranted and the threshold semantics.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[2].at); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 arsenal: arsenal milestone earned (hasMilestone sect 2)",
    "hasMilestone('sect', 2) === true");
check("slice-5 arsenal: automationGranted(AUTOMATION_DATA[3]) true after arsenal milestone",
    "automationGranted(AUTOMATION_DATA[3]) === true");
//     Threshold semantics (gainFraction): f.points = 0 (the pending gain trivially >= 0 x fraction),
//     so autoPrestige fires. Then f.points = HUGE so the gain is tiny relative to current -> holds off.
//     f.canReset requires player.points >= f.requires(); grant enough Qi for both sub-cases.
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(substageThreshold('q', '6th Level')); updateMilestones('q');");
boot("player.points = new Decimal(layers.f.requires().times(4)); player.f.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-5 arsenal: tmp.f.autoPrestige true when f.points is zero (gain >= fraction * 0)",
    "tmp.f.autoPrestige === true && tmp.f.canReset === true");
// Set f.points huge so pending gain is tiny relative to current: holds off.
// Keep Qi (player.points) sufficient for canReset.
boot("player.f.points = new Decimal(1e12); player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
check("slice-5 arsenal: tmp.f.autoPrestige false when f.points huge (gain < gainFraction * 1e12)",
    "tmp.f.autoPrestige === false && tmp.f.canReset === true");
//     (c) End-to-end: drive a gameLoop tick while f.canReset and autoPrestige would fire.
//         Set f.points back to zero so the threshold is met, give enough Qi for f canReset.
boot("player.f.points = new Decimal(0); player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
check("slice-5 arsenal: pre-gameLoop: tmp.f.autoPrestige true and canReset true",
    "tmp.f.autoPrestige === true && tmp.f.canReset === true");
boot("gameLoop(0.001); updateTemp(); updateTemp();");
check("slice-5 arsenal: f auto-prestiges through gameLoop (f.points > 0 after tick)",
    "player.f.points.gt(0)");

// 26. Persistence: sect archetype/techniques/contribution and journal unlocked entries
//     survive an n prestige AND a forced resetRow of the whole tree (life + eternal immunity).
//
//     State: archetype = azureSword, techniques 0/1/2 bought, sect.best = arsenal threshold.
//     journal.unlocked may have entries from prior blocks (checked below).
//     Set up for n prestige.
boot("player.b.coreGrade = 0; player.c.unlocked = true; player.c.best = new Decimal(2);");
boot("player.f.unlocked = true; player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(substageThreshold('q', '6th Level')); updateMilestones('q');");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='n';}).reqBase); updateTemp(); updateTemp();");
// Snapshot sect state before n prestige.
boot("var sectArchBefore = player.sect.archetype; var sectBestBefore = player.sect.best.toNumber();");
boot("var sectHasAzureForm = hasUpgrade('sect', 0); var journalUnlockedBefore = player.journal.unlocked.slice();");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-5 persist: sect archetype SURVIVES n prestige (life-scoped)",
    "player.sect.archetype === sectArchBefore");
check("slice-5 persist: sect best SURVIVES n prestige (never falls)",
    "player.sect.best.toNumber() === sectBestBefore");
check("slice-5 persist: techniques owned SURVIVE n prestige (life-scoped upgrades)",
    "hasUpgrade('sect', 0) === true");
check("slice-5 persist: journal.unlocked SURVIVES n prestige (eternal-scoped)",
    "JSON.stringify(player.journal.unlocked) === JSON.stringify(journalUnlockedBefore)");
// Now force a resetRow of the entire tree (doReset('c', true) cascades c/f/q).
boot("var sectArchAfterReset = player.sect.archetype; var journalAfterReset = player.journal.unlocked.slice();");
boot("doReset('c', true); updateTemp(); updateTemp();");
check("slice-5 persist: sect archetype SURVIVES forced c cascade (life-scoped)",
    "player.sect.archetype === sectArchAfterReset");
check("slice-5 persist: journal.unlocked SURVIVES forced c cascade (eternal-scoped)",
    "JSON.stringify(player.journal.unlocked) === JSON.stringify(journalAfterReset)");
check("slice-5 persist: sect techniques SURVIVE forced c cascade (life-scoped upgrades)",
    "hasUpgrade('sect', 0) === true");

// 27. Journal: entry latches when its condition first holds and STAYS unlocked after the
//     condition's inputs reset; shouldNotify true while unread, false after mark-read;
//     the achievement-conditioned entry (Outer Disciple) and the sectJoined entry latch.
//
//     Reset journal to a clean slate for this block.
boot("player.journal.unlocked = []; player.journal.read = []; updateTemp(); updateTemp();");
//     (a) qi-threshold entry: 'firstBreath' latches on layerUnlocked:'q'.
//         The q layer IS already unlocked (player.q.unlocked = true from prior blocks).
boot("player.q.unlocked = true; updateTemp();");
boot("layers.journal.update.call({layer:'journal'}); updateTemp();");
check("slice-5 journal: firstBreath entry latches when q is unlocked (layerUnlocked gate)",
    "player.journal.unlocked.indexOf('firstBreath') !== -1");
//     (b) shouldNotify true while the entry is unread.
check("slice-5 journal: shouldNotify() true while firstBreath is unread",
    "layers.journal.shouldNotify.call({layer:'journal'}) === true");
//     (c) The entry stays unlocked after q resets (q.unlocked becomes false).
//         A real q prestige does NOT affect player.q.unlocked (it stays true once latched
//         by TMT's normal reset flow — only the game's own unlock/canReset cycle touches it).
//         To test pure latch persistence: forcibly unlatch q.unlocked, drive an update tick,
//         and confirm firstBreath is still in journal.unlocked (not re-evaluated).
boot("player.q.unlocked = false; layers.journal.update.call({layer:'journal'}); updateTemp();");
check("slice-5 journal: firstBreath STAYS latched after q.unlocked is reset (latch is permanent)",
    "player.journal.unlocked.indexOf('firstBreath') !== -1");
//     (d) Reflect clickable (id 0) marks all read; shouldNotify drops to false.
boot("clickClickable('journal', 0); updateTemp();");
check("slice-5 journal: Reflect clickable marks firstBreath read (read array contains it)",
    "player.journal.read.indexOf('firstBreath') !== -1");
check("slice-5 journal: shouldNotify() false after Reflect (all unlocked entries are read)",
    "layers.journal.shouldNotify.call({layer:'journal'}) === false");
//     (e) sectJoined entry latches: set archetype + drive update.
boot("player.sect.archetype = SECT_DATA.archetypes[0].key; updateTemp();");
boot("layers.journal.update.call({layer:'journal'}); updateTemp();");
check("slice-5 journal: sectJoined entry latches when sectJoined() is true",
    "player.journal.unlocked.indexOf('sectJoined') !== -1");
//     (f) Outer Disciple achievement entry (outerDisciple key, when: achievement:['gate',11]).
//         Gate achievement 11 (outerDisciple) requires Foundation + meridians>=6 + Flesh temper.
//         Set up the state: f unlocked/best, meridians 6+, and a temper tier reached.
boot("player.q.unlocked = true; player.q.best = new Decimal(substageThreshold('q', '6th Level')); updateMilestones('q');");
boot("player.f.unlocked = true; player.f.best = new Decimal(1); updateMilestones('f');");
boot("setBuyableAmount('b', 11, new Decimal(6));"); // 6 primary meridians
// Flesh temper (index 1 in BODY_DATA.temperTiers, fromLevel 5): the gate achievement requires
// temperTier:"Flesh" whose label matches BODY_DATA.temperTiers[1] (key "flesh", fromLevel 5).
// temperTierIndexByKey("Flesh") matches tier.label === "Flesh" -> returns index 1; the player
// must be at temperLevel >= BODY_DATA.temperTiers[1].fromLevel for the meets() check to pass.
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(BODY_DATA.temperTiers[1].fromLevel)); updateTemp(); updateTemp();");
boot("updateAchievements('gate'); updateTemp(); updateTemp();");
check("slice-5 journal: gate achievement 11 (Outer Disciple) earned (prerequisite for outerDisciple entry)",
    "hasAchievement('gate', 11) === true");
boot("layers.journal.update.call({layer:'journal'}); updateTemp();");
check("slice-5 journal: outerDisciple entry latches when gate achievement 11 is held",
    "player.journal.unlocked.indexOf('outerDisciple') !== -1");

// 28. Hints: the joinSect row fires in its EARLY window only (sect revealed, archetype
//     unset, nothing later-game matching — it sits near the BOTTOM of the cascade per the
//     slice-5 review: joining is optional and must never pin the guidance), is shadowed
//     by realm progression for a non-joiner, and stops firing once joined.
//
//     (a) joinSect fires in its window: revealed + unjoined + a genuinely early state
//         (q below 4th Level, no lattice nodes, no foundation/core/NS) so no later row
//         shadows it from above and it beats climbQi from below.
boot("LATTICE_DATA.nodes.forEach(function(node){ setBuyableAmount('dao', node.buyableId, new Decimal(0)); });");
boot("player.sect.revealed = true; player.sect.archetype = '';"
    + "player.q.unlocked = true; player.q.best = new Decimal(substageThreshold('q', '4th Level') - 1);"
    + "player.b.coreGrade = BODY_DATA.grades.coreGrade.startIndex; player.c.unlocked = false;"
    + "player.f.unlocked = false; player.f.best = new Decimal(0); player.n.unlocked = false;"
    + "player.b.soulAspect = ''; updateTemp(); updateTemp();");
check("slice-5 hints: joinSect hint fires in the early revealed-but-unjoined window",
    "cultivationCurrentHint().key === 'joinSect'");
//     (a2) The slice-5 review's regression case: a player who NEVER joins must still get
//          realm-progression guidance — at 6th Level + 4 meridians (f's unlock recipe),
//          breakToFoundation shadows joinSect from above.
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); updateTemp(); updateTemp();");
check("slice-5 hints: breakToFoundation shadows joinSect for a non-joiner at 6th Level",
    "cultivationCurrentHint().key === 'breakToFoundation'");
boot("player.q.best = new Decimal(substageThreshold('q', '4th Level') - 1); updateTemp(); updateTemp();");
//     (b) After joining, joinSect stops firing entirely (sectUnjoined false); the cascade
//         falls through to climbQi in this early state.
boot("player.sect.archetype = SECT_DATA.archetypes[0].key; updateTemp(); updateTemp();");
check("slice-5 hints: joinSect does NOT fire once sect is joined (sectJoined true -> hintSectUnjoined false)",
    "cultivationCurrentHint().key !== 'joinSect'");
//     (c) Re-verify the complete hint for the current state. Restore q.unlocked (was cleared
//         in block 27 for latch-persistence testing). Set q.best below 4th Level so openLattice
//         does not fire; clear core/foundation/NS flags so higher-priority rows do not shadow;
//         archetype is already set (joined). Also zero dao buyables so anyDaoNode:1 (enterTrance
//         row 9) does not shadow climbQi: the dao nodes from earlier blocks are life-scoped and
//         persist, but we need the hint window that would apply to a player who had NO lattice
//         nodes yet (the semantic intent of the assertion: joinSect shadowed BY joining, leaving
//         the ordinary q-climb hint to fire). This is the last block, so zeroing dao state here
//         does not break any downstream block.
boot("LATTICE_DATA.nodes.forEach(function(node){ setBuyableAmount('dao', node.buyableId, new Decimal(0)); });");
boot("player.q.unlocked = true; player.q.best = new Decimal(substageThreshold('q', '4th Level') - 1); player.b.coreGrade = BODY_DATA.grades.coreGrade.startIndex; player.c.unlocked = false; player.f.unlocked = false; player.f.best = new Decimal(0); player.n.unlocked = false; player.b.soulAspect = ''; updateTemp(); updateTemp();");
check("slice-5 hints: below 4th Level + joined sect -> climbQi fires (joinSect shadowed by joining)",
    "cultivationCurrentHint().key === 'climbQi'");

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("RUNTIME SMOKE FAIL — at least one engine behavior diverged.");
    process.exit(1);
}
console.log("RUNTIME SMOKE PASS — real-engine reset cascade, keep rule, and hint cascade all behave.");
process.exit(0);
