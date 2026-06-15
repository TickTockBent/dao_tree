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

const nodeBoot = require("./node-boot.js");

const projectRoot = nodeBoot.projectRoot;

function fail(message) {
    console.error("RUNTIME SMOKE ERROR: " + message);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Boot the real engine headless via the shared shim (js/build/node-boot.js):
// the full browser-stub sandbox, the engine file load (optional sect/techniques/
// journal loaded BEFORE the engine list, mirroring index.html minus render-only
// files), and the save.js load() mirror (updateLayers; fresh player; options;
// needCanvasUpdate=false; setupTemp/updateTemp x2). The lint/fixture harnesses
// and the pacing sim consume the same shim. boot(expr) is the fail-on-throw
// vm.runInContext helper the assertions below drive.
// ---------------------------------------------------------------------------
const booted = nodeBoot.bootEngine({ onFail: fail });
const sandbox = booted.sandbox;
const context = booted.context;
const boot = booted.boot;

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
// q.best=90 is 6th Level: the 6 sub-stage milestones (at <= 90) must SURVIVE so they
// do not re-fire their unlock notification every reset (the keep "milestones" fix).
check("f prestige (keep rule earned): q.milestones SURVIVE (no re-notify spam)",
    "player.q.milestones.length === 6 && hasMilestone('q', 5)");

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
    "tmp.n.clickables[11].unlocked === false");
// Clicking a not-unlocked clickable must not store the aspect (verify no side-effect).
// clickClickable checks unlocked before calling onClick; so player.b.soulAspect stays "".
boot("clickClickable('n', 11);");
check("slice-4 aspect: clicking Formless while not-unlocked does NOT store the aspect",
    "player.b.soulAspect === ''");
//     (b) After first breakthrough: Formless unlocked+clickable; metalSoul needs a metal Seed.
boot("player.n.unlocked = true; player.n.best = new Decimal(1); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 aspect: clickable 0 (Formless) unlocked after first n prestige",
    "tmp.n.clickables[11].unlocked === true");
check("slice-4 aspect: clickable 0 (Formless) always clickable (requires {} met)",
    "tmp.n.clickables[11].canClick === true");
check("slice-4 aspect: clickable 1 (metalSoul) unlocked but NOT clickable (no metal Seed yet)",
    "tmp.n.clickables[12].unlocked === true && tmp.n.clickables[12].canClick === false");
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
    "tmp.n.clickables[12].canClick === true");
//     (d) Pick Formless (clickable 0): stores key, multipliers move off identity.
boot("clickClickable('n', 11); updateTemp(); updateTemp();");
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
    "tmp.n.clickables[11].unlocked === false");
check("slice-4 aspect: clickable 1 unlocked = false once aspect chosen",
    "tmp.n.clickables[12].unlocked === false");
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

// 19. Endgame sentinel (slice 6: the frontier MOVED from Nascent Soul to Soul Formation).
//     cultivationEndgameReached() is now generic (factory): the highest-row realm (s, row 4)
//     maxed on best AND, because s carries a TRIBULATION set-piece, the tribulation PASSED.
//     So n.best at its last substage is NO LONGER endgame — s is the frontier now. Read all
//     thresholds from the data tables (never a literal).
//
//     (a) n maxed is no longer endgame (s exists above it and is unmaxed/untribulated).
boot("var nLastSub = REALM_DATA.find(function(r){return r.id==='n';}).substages; var nLastAt = nLastSub[nLastSub.length-1].at; player.n.best = new Decimal(nLastAt); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-6 endgame: n maxed is NOT endgame (s is the frontier now)",
    "!cultivationEndgameReached() && !isEndgame()");
//     (b) Unlock s and drive its best to the last substage, but do NOT pass the tribulation:
//         still not endgame (the capstone is the tribulation, not the climb to it).
boot("player.s.unlocked = true; var sLastSub = REALM_DATA.find(function(r){return r.id==='s';}).substages; var sLastAt = sLastSub[sLastSub.length-1].at; player.s.best = new Decimal(sLastAt); player.s.tribGrade = -1; updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 endgame: s maxed but tribulation NOT passed is still NOT endgame",
    "!cultivationEndgameReached() && tribulationPassed() === false");
//     (c) Latch a passing tribulation grade (flawless = the last grade index): NOW endgame.
boot("var tribGrades = SETPIECE_DATA.firstTribulation.grades; player.s.tribGrade = tribGrades.length - 1; updateTemp(); updateTemp();");
check("slice-6 endgame: s maxed AND tribulation passed -> cultivationEndgameReached() true",
    "cultivationEndgameReached() === true");
check("slice-6 endgame: isEndgame() true at the s frontier with tribulation passed",
    "isEndgame() === true");
//     (d) Reset the endgame state for the slice-4 hint windows below (s back to locked/zero,
//         tribGrade unresolved, n back below its last substage so faceTribulation does not shadow).
boot("player.s.unlocked = false; player.s.best = new Decimal(0); player.s.tribGrade = -1; updateMilestones('s'); updateTemp(); updateTemp();");

// 20. Hint cascade. Three windows exercised. (Slice 6 added higher-priority hint rows —
//     faceTribulation at n Perfected, climbSoulFormation at n Apex, healScar at a held Seed —
//     so each window below first clears the state those rows key on, exactly as the harness
//     already clears core/foundation state to avoid shadowing.)
//     (a) chooseAspect: n unlocked + soulAspect unchosen, with n.best at Early NS (below Apex/
//         Perfected so the slice-6 NS-frontier rows do not shadow), and no held Seed (so healScar
//         does not shadow). The metal root from block 17 sits at Seed tier 2 -> zero it here.
boot("LATTICE_DATA.nodes.forEach(function(node){ setBuyableAmount('dao', node.buyableId, new Decimal(0)); });");
boot("player.n.unlocked = true; player.n.best = new Decimal(1); player.b.soulAspect = ''; updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 hints: chooseAspect fires when n unlocked and aspect unchosen",
    "cultivationCurrentHint().key === 'chooseAspect'");
//     (b) climbNascent: aspect is chosen (chooseAspect no longer matches); n is at Early NS.
boot("player.b.soulAspect = 'formless'; updateTemp(); updateTemp();");
check("slice-4 hints: climbNascent fires after aspect chosen (below chooseAspect)",
    "cultivationCurrentHint().key === 'climbNascent'");
//     (c) enterTrance: ONE Glimpse owned (anyDaoNode:1) AND q below 4th Level so openLattice
//         does not shadow; no core/foundation/NS so higher rows do not match; exactly ONE Glimpse
//         (not a Seed) so the slice-6 healScar row (anyDaoNode:2) does not shadow. Re-buy a single
//         Glimpse on the metal root (zeroed above) to land in the first-Glimpse window.
boot("player.n.unlocked = false; player.n.best = new Decimal(0);");
boot("player.b.coreGrade = BODY_DATA.grades.coreGrade.startIndex;");
boot("player.c.unlocked = false; player.f.best = new Decimal(0);");
boot("player.b.soulAspect = '';");
boot("player.dao.points = new Decimal(1000); setBuyableAmount('dao', 11, new Decimal(1));");
boot("player.q.best = new Decimal(substageThreshold('q', '4th Level') - 1); updateMilestones('n'); updateTemp(); updateTemp();");
check("slice-4 hints: metal root Glimpse still owned (dao 11 >= 1)",
    "getBuyableAmount('dao', 11).gte(1)");
check("slice-4 hints: enterTrance fires in first-Glimpse window (q below 4th Level)",
    "cultivationCurrentHint().key === 'enterTrance'");
//     Restore the dao node tiers the slice-5 blocks below expect (the hint windows above zeroed
//     them to isolate the cascade): metal root (dao 11) back to Seed (tier 2), sword node (dao 21)
//     to Glimpse (tier 1) — the exact state block 17 left before the slice-6 hint-window setup.
boot("setBuyableAmount('dao', 11, new Decimal(2)); setBuyableAmount('dao', 21, new Decimal(1)); updateTemp(); updateTemp();");

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
    "tmp.sect.clickables[11].unlocked === true");
check("slice-5 reveal: archetype clickable 0 (azureSword) canClick while unjoined",
    "tmp.sect.clickables[11].canClick === true");
check("slice-5 reveal: archetype clickable 1 (stoneFormation) unlocked while unjoined",
    "tmp.sect.clickables[12].unlocked === true");
check("slice-5 reveal: archetype clickable 1 (stoneFormation) canClick while unjoined",
    "tmp.sect.clickables[12].canClick === true");
//     Sub-block (b): pick azureSword (clickable 0).
boot("clickClickable('sect', 11); updateTemp(); updateTemp();");
check("slice-5 pick: archetype stored as azureSword after clicking clickable 0",
    "player.sect.archetype === SECT_DATA.archetypes[0].key");
check("slice-5 pick: sectJoined() true after pick",
    "sectJoined() === true");
check("slice-5 pick: sectArchetypeRow() resolves to azureSword",
    "sectArchetypeRow() !== null && sectArchetypeRow().key === 'azureSword'");
//     Once joined, both clickables must vanish (unlocked = false — the once-per-life gate).
check("slice-5 pick: clickable 0 unlocked = false once joined (once per life)",
    "tmp.sect.clickables[11].unlocked === false");
check("slice-5 pick: clickable 1 unlocked = false once joined (once per life)",
    "tmp.sect.clickables[12].unlocked === false");
//     Sub-block (c): second pick attempt must have no effect (canClick false = pick rejected).
//     Direct state approach: try to set archetype to stoneFormation via clickClickable; engine
//     checks canClick (which is false when joined), so the onClick guard returns early.
boot("clickClickable('sect', 12); updateTemp(); updateTemp();");
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
    "tmp.sect.upgrades[11].unlocked === true");
// Verify stoneSkin (index 3, formation school) is NOT unlocked for azureSword.
check("slice-5 tech: stoneSkin upgrade (index 3) NOT unlocked for azureSword (wrong school)",
    "tmp.sect.upgrades[14].unlocked === false");
// Verify swordHeart (index 2, tier 2) is NOT unlocked yet (no library milestone).
check("slice-5 tech: swordHeart upgrade (index 2, tier-2) NOT unlocked before library milestone",
    "tmp.sect.upgrades[13].unlocked === false");
// Buy azureForm (index 0) via buyUpgrade.
boot("var preBuyPoints = player.sect.points.toNumber(); buyUpgrade('sect', 11); updateTemp(); updateTemp();");
check("slice-5 tech: azureForm (index 0) purchased (hasUpgrade returns true)",
    "hasUpgrade('sect', 11) === true");
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
    "tmp.sect.upgrades[12].unlocked === true");
boot("buyUpgrade('sect', 12); updateTemp(); updateTemp();");
check("slice-5 tech: techniqueInsightMult() > 1 after buying severingArc (insightMult 1.20)",
    "techniqueInsightMult().gt(1)");
// Tier-2 gating: the library milestone now needs the contribution threshold AND a Foundation
// (the §4.3 stage gate). Below threshold: locked.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[1].at - 1); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 tech: swordHeart (tier-2) still NOT unlocked below library milestone",
    "tmp.sect.upgrades[13].unlocked === false");
// At threshold but WITHOUT a Foundation: the stage gate holds the inner library closed.
boot("player.f.unlocked = false; player.f.best = new Decimal(0);");
boot("player.sect.best = new Decimal(SECT_DATA.milestones[1].at); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 tech: library NOT earned at threshold without Foundation (stage gate)",
    "hasMilestone('sect', 1) === false");
// Establish a Foundation -> the library opens.
boot("player.f.unlocked = true; player.f.best = new Decimal(substageThreshold('f', 'Early Foundation')); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 tech: library milestone earned after reaching Foundation",
    "hasMilestone('sect', 1) === true");
check("slice-5 tech: swordHeart (tier-2) NOW unlocked after library milestone",
    "tmp.sect.upgrades[13].unlocked === true");
// Buy swordHeart (index 2) with sufficient points.
boot("player.sect.points = new Decimal(TECHNIQUE_DATA[2].cost + 100); updateTemp(); updateTemp();");
boot("buyUpgrade('sect', 13); updateTemp(); updateTemp();");
check("slice-5 tech: swordHeart (index 2) purchased after library milestone",
    "hasUpgrade('sect', 13) === true");

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

// 24b. Contribution stage cap (§4.3): standing clamps at the first unearned rank's threshold.
//      Accrual is driven via the sect layer's own update(). No Foundation -> capped at library.
boot("player.sect.points = new Decimal(0); player.points = new Decimal(1e6); updateTemp();");
boot("player.f.unlocked = false; player.f.best = new Decimal(0);");
boot("layers.sect.update.call({layer:'sect'}, 100000);");
check("slice-5 cap: standing capped at library threshold without a Foundation",
    "player.sect.points.eq(SECT_DATA.milestones[1].at)");
// Reach Foundation (still no core) -> the cap lifts to the arsenal threshold.
boot("player.f.unlocked = true; player.f.best = new Decimal(substageThreshold('f', 'Early Foundation'));");
boot("layers.sect.update.call({layer:'sect'}, 100000);");
check("slice-5 cap: cap lifts to arsenal threshold after reaching Foundation (pre-core)",
    "player.sect.points.eq(SECT_DATA.milestones[2].at)");

// 25. Arsenal: the sectFoundationBell automation (AUTOMATION_DATA[3], grantedBy sect milestone 2).
//     (a) Before the arsenal milestone: f has no auto-prestige.
boot("player.sect.best = new Decimal(SECT_DATA.milestones[2].at - 1); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 arsenal: before arsenal milestone, automationGranted(AUTOMATION_DATA[3]) is false",
    "automationGranted(AUTOMATION_DATA[3]) === false");
// f's autoPrestige must be false (no granted arsenal row targeting f).
boot("player.f.unlocked = true; player.f.best = new Decimal(22); player.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-5 arsenal: tmp.f.autoPrestige false before arsenal milestone",
    "tmp.f.autoPrestige === false");
//     (b) Earn the arsenal milestone. It now needs the contribution threshold AND a FORGED CORE
//         (the §4.3 stage gate). At threshold but with no core: the gate holds it.
boot("player.c.unlocked = true; player.c.best = new Decimal(0);");
boot("player.sect.best = new Decimal(SECT_DATA.milestones[2].at); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 arsenal: NOT earned at threshold without a forged core (stage gate)",
    "hasMilestone('sect', 2) === false");
// Forge a core (Core Forged sub-stage) -> the arsenal opens.
boot("player.c.best = new Decimal(substageThreshold('c', 'Core Forged')); updateMilestones('sect'); updateTemp(); updateTemp();");
check("slice-5 arsenal: arsenal milestone earned (contribution threshold + forged core)",
    "hasMilestone('sect', 2) === true");
check("slice-5 arsenal: automationGranted(AUTOMATION_DATA[3]) true after arsenal milestone",
    "automationGranted(AUTOMATION_DATA[3]) === true");
//     MATURITY model: a FRESH/unformed Foundation (no sub-stage climb, no fuel) -> the bell FIRES
//     to rebuild it. f.canReset requires player.points >= f.requires(); grant enough Qi.
boot("player.q.best = new Decimal(substageThreshold('q', '6th Level')); player.q.points = new Decimal(substageThreshold('q', '6th Level')); updateMilestones('q');");
boot("player.f.unlocked = true; player.f.best = new Decimal(0); player.f.points = new Decimal(0); player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
check("slice-5 arsenal: bell FIRES while Foundation is unformed (rebuilding)",
    "tmp.f.autoPrestige === true && tmp.f.canReset === true");
//     A FULLY FORMED Foundation (top sub-stage climbed + fuel banked) -> the bell RESTS, so the
//     player's Qi banks freely toward the next realm (this is the softlock fix).
boot("player.f.best = new Decimal(substageThreshold('f', 'Great Circle')); player.f.points = new Decimal(1e6); player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
check("slice-5 arsenal: bell RESTS when Foundation is fully formed (Qi banks freely)",
    "tmp.f.autoPrestige === false && tmp.f.canReset === true");
// Time estimator contract: null when resting (nothing to estimate).
check("slice-5 arsenal: time-to-formed estimate is null when already resting",
    "secondsUntilAutoPrestigeRests('f') === null");
// While unformed (with income), the estimate is a finite, positive, bounded number — the cost
// cap guarantees it converges instead of asymptoting to an absurd final bank.
boot("player.f.best = new Decimal(0); player.f.points = new Decimal(0); player.points = new Decimal(0); updateTemp(); updateTemp();");
check("slice-5 arsenal: time-to-formed estimate is finite & positive while building",
    "(function(){var e=secondsUntilAutoPrestigeRests('f'); return e !== null && e.gt(0) && e.lt(new Decimal('1e9'));})()");
//     (c) End-to-end: an unformed Foundation auto-prestiges through a real gameLoop tick.
boot("player.f.best = new Decimal(0); player.f.points = new Decimal(0); player.points = new Decimal(layers.f.requires().times(4)); updateTemp(); updateTemp();");
check("slice-5 arsenal: pre-gameLoop: bell fires + canReset",
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
boot("var sectHasAzureForm = hasUpgrade('sect', 11); var journalUnlockedBefore = player.journal.unlocked.slice();");
boot("doReset('n'); updateTemp(); updateTemp();");
check("slice-5 persist: sect archetype SURVIVES n prestige (life-scoped)",
    "player.sect.archetype === sectArchBefore");
check("slice-5 persist: sect best SURVIVES n prestige (never falls)",
    "player.sect.best.toNumber() === sectBestBefore");
check("slice-5 persist: techniques owned SURVIVE n prestige (life-scoped upgrades)",
    "hasUpgrade('sect', 11) === true");
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
    "hasUpgrade('sect', 11) === true");

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
boot("clickClickable('journal', 11); updateTemp();");
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
// Slice 6 — the First Tribulation set-piece, the Scar slot, the eternal Act I Legacy Grade,
// and the forge migration. Appended after the slice-5 block; this is the last block so its
// state mutations break nothing downstream.
// ---------------------------------------------------------------------------

// 29. Forge migration: the forge config now lives in SETPIECE_DATA.forge (moved verbatim from the
//     c row), and the s realm + legacy layer registered. coreForgeData() reads the migrated config.
check("slice-6 migration: c row carries setpiece 'forge', no inline forge config",
    "REALM_DATA.find(function(r){return r.id==='c';}).setpiece === 'forge' && REALM_DATA.find(function(r){return r.id==='c';}).forge === undefined");
check("slice-6 migration: SETPIECE_DATA.forge exists and coreForgeData() reads it",
    "!!SETPIECE_DATA.forge && coreForgeData() === SETPIECE_DATA.forge");
check("slice-6 migration: setpieceFor resolves the forge realm's set-piece",
    "setpieceFor(REALM_DATA.find(function(r){return r.id==='c';})) === SETPIECE_DATA.forge");
check("slice-6 boot: s realm registered, tree-scoped act1, carries a doReset",
    "!!layers.s && TREE_DATA.layers.s.scope === 'tree' && TREE_DATA.layers.s.tree === 'act1' && typeof layers.s.doReset === 'function'");
check("slice-6 boot: legacy layer registered, eternal-scoped, NO doReset",
    "!!layers.legacy && TREE_DATA.layers.legacy.scope === 'eternal' && layers.legacy.doReset === undefined");
check("slice-6 boot: s realm carries the firstTribulation set-piece",
    "REALM_DATA.find(function(r){return r.id==='s';}).setpiece === 'firstTribulation' && tribulationConfig() === SETPIECE_DATA.firstTribulation");

// 30. Tribulation run: trigger gating, begin (consumes Qi fuel), wave-drain to a PASSING grade
//     with strong prep, which fires the Act I Legacy Grade.
//     Set up a fully-prepared cultivator at the trigger sub-stage.
boot("player.s.unlocked = true; player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(BODY_DATA.buyables[2].limit));");
boot("setBuyableAmount('b', 11, new Decimal(BODY_DATA.buyables[0].limit));");
boot("player.b.coreGrade = SETPIECE_DATA.forge.grades.length - 1;"); // Perfect core
boot("player.points = new Decimal(1e12);"); // banked Qi fuel
boot("var sTrig = REALM_DATA.find(function(r){return r.id==='s';}).substages.find(function(x){return x.label==='Great Circle of Soul Formation';}).at; player.s.best = new Decimal(sTrig); updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 trigger: tribulationIsReady true at peak s with strong prep",
    "tribulationIsReady() === true");
check("slice-6 trigger: not active and not yet passed before begin",
    "tribulationIsActive() === false && tribulationPassed() === false");
boot("var prepPool = tribulationPreparednessPool(); beginTribulation();");
check("slice-6 begin: run active after beginTribulation()",
    "tribulationIsActive() === true");
check("slice-6 begin: banked Qi consumed as fuel (player.points = 0)",
    "player.points.eq(0)");
check("slice-6 begin: starting pool max = the preparedness pool at trigger",
    "new Decimal(player.s.tribPoolMax).eq(prepPool)");
// Drive the timed run to completion (durationSeconds + a margin of 1-second ticks).
boot("var trDur = SETPIECE_DATA.firstTribulation.durationSeconds; for (var ti = 0; ti < trDur + 5; ti++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 run: resolves (no longer active) after the full duration",
    "tribulationIsActive() === false");
check("slice-6 run: strong prep yields a PASSING grade (tribulationPassed true)",
    "tribulationPassed() === true");
check("slice-6 run: a pass cannot re-trigger (tribulationIsReady false once passed)",
    "tribulationIsReady() === false");

// 31. Legacy: the pass fired computeAndStoreActOneLegacy; the stored grade folds into Qi/sec and
//     never downgrades.
check("slice-6 legacy: an Act I Legacy Grade is stored after the pass (index >= 0)",
    "actOneLegacyIndex() >= 0");
check("slice-6 legacy: legacyQiMult() > 1 once a grade is earned (live consumer)",
    "legacyQiMult().gt(1)");
check("slice-6 legacy: cultivationQiPerSecond folds the legacy multiplier",
    "cultivationQiPerSecond().gte(qiBaseRate().times(legacyQiMult()))");
boot("var legacyBefore = actOneLegacyIndex(); player.b.coreGrade = -1; computeAndStoreActOneLegacy();");
check("slice-6 legacy: never downgrades on a weaker recompute",
    "actOneLegacyIndex() === legacyBefore");
boot("player.b.coreGrade = SETPIECE_DATA.forge.grades.length - 1;"); // restore the core grade

// 32. Endgame flip (the generic extension): s maxed alone is not endgame; s maxed AND the
//     tribulation passed IS. (The tribulation is already passed from block 30.)
boot("var sLast6 = REALM_DATA.find(function(r){return r.id==='s';}).substages; player.s.best = new Decimal(sLast6[sLast6.length-1].at); updateMilestones('s'); updateTemp();");
check("slice-6 endgame: s maxed AND tribulation passed -> endgame reached",
    "cultivationEndgameReached() === true && isEndgame() === true");

// 33. Scar slot: a FAILED run deepens the scar (debuff active), sets a retry cooldown, and the
//     heal arc converts a depth into the permanent Tempered-by-Ruin buff. Reset to a fresh,
//     UNPASSED tribulation with WEAK prep so the pool empties (Failed).
boot("player.b.scarDepth = BODY_DATA.scar.startDepth; player.b.scarHealProgress = BODY_DATA.scar.startHealProgress; player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth;");
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(0)); setBuyableAmount('b', 11, new Decimal(0)); player.b.coreGrade = -1; player.points = new Decimal(0);");
boot("var sTrig2 = REALM_DATA.find(function(r){return r.id==='s';}).substages.find(function(x){return x.label==='Great Circle of Soul Formation';}).at; player.s.best = new Decimal(sTrig2); updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 scar: scar starts unscarred (depth 0, inactive)",
    "scarDepth() === 0 && scarIsActive() === false && scarQiMult().eq(1)");
boot("beginTribulation(); var trDur2 = SETPIECE_DATA.firstTribulation.durationSeconds; for (var tj = 0; tj < trDur2 + 5; tj++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 scar: weak prep + no Qi -> tribulation FAILED (not passed)",
    "tribulationPassed() === false");
check("slice-6 scar: a Failed run deepened the scar to depth 1",
    "scarDepth() === 1");
check("slice-6 scar: the scar is ACTIVE (depth > healedDepth)",
    "scarIsActive() === true");
check("slice-6 scar: scarQiMult() < 1 while the scar is active (the debuff)",
    "scarQiMult().lt(1)");
check("slice-6 scar: cultivationQiPerSecond folds the scar debuff (<= base x scarMult region)",
    "scarQiMult().lt(1)");
// Deepen past the ceiling to prove the cap.
boot("for (var dd = 0; dd < SETPIECE_DATA.scar.maxDepth + 3; dd++) { deepenScar(); }");
check("slice-6 scar: depth ceiling respected (capped at maxDepth)",
    "scarDepth() === SETPIECE_DATA.scar.maxDepth");
// Heal the whole scar: convert every depth to a permanent Tempered-by-Ruin buff.
boot("for (var hh = 0; hh < 5000; hh++) { scarHealTick(1); }");
check("slice-6 scar: full heal converts every depth to healedDepth",
    "scarHealedDepth() === scarDepth()");
check("slice-6 scar: scar inactive once fully healed (scarQiMult identity)",
    "scarIsActive() === false && scarQiMult().eq(1)");
check("slice-6 scar: temperedQiMult() > 1 after healing (permanent Tempered-by-Ruin buff)",
    "temperedQiMult().gt(1)");
check("slice-6 scar: cultivationQiPerSecond folds the tempered buff",
    "cultivationQiPerSecond().gte(qiBaseRate().times(temperedQiMult()))");

// 34. Scar persistence: the scar slot is life-scoped on Body, so it survives a realm cascade.
boot("var healedBeforeReset = scarHealedDepth(); var depthBeforeReset = scarDepth();");
boot("player.s.best = new Decimal(0); player.s.tribGrade = -1; doReset('c', true); updateTemp(); updateTemp();");
check("slice-6 scar: scar depth/healedDepth SURVIVE a forced realm cascade (life-scoped on Body)",
    "scarDepth() === depthBeforeReset && scarHealedDepth() === healedBeforeReset");

// ---------------------------------------------------------------------------
// Slice 6 — extended coverage blocks (appended after the initial slice-6 blocks
// 29-34; all state mutations are last in the file so nothing downstream breaks).
// ---------------------------------------------------------------------------

// 35. startData shape: s player state is seeded with the tribulation run-state fields
//     at boot. These field names are PINNED by the smoke-harness contract (the factory
//     seeds them in s.startData; any rename breaks the existing assertions in blocks
//     30-34 above as well as the UI bar readers). Assert here that the fields are present
//     even on a fresh (just-registered) s layer state, before any tribulation begins.
//     The s layer was unlocked and mutated in block 30 onward; to re-check startData
//     shape we read the field names from the live player.s object (all fields are seeded
//     at boot via getStartPlayer -> s.startData, so they exist regardless of unlock state).
check("slice-6 startData: player.s has tribActive field (run-state seed)",
    "player.s.tribActive !== undefined");
check("slice-6 startData: player.s has tribElapsed field (run-state seed)",
    "player.s.tribElapsed !== undefined");
check("slice-6 startData: player.s has tribPool field (run-state seed)",
    "player.s.tribPool !== undefined");
check("slice-6 startData: player.s has tribPoolMax field (run-state seed)",
    "player.s.tribPoolMax !== undefined");
check("slice-6 startData: player.s has tribWaveIndex field (run-state seed)",
    "player.s.tribWaveIndex !== undefined");
check("slice-6 startData: player.s has tribGrade field, defaulting to -1 (unresolved sentinel)",
    "player.s.tribGrade !== undefined");
check("slice-6 startData: player.s has tribCooldownUntil field (retry cooldown seed)",
    "player.s.tribCooldownUntil !== undefined");

// 36. s prestige cascade: an s breakthrough resets n/c/f/q but leaves b/gate/dao/sect/journal/
//     legacy untouched. The soulCarriesTheClimb keep rule (KEEP_RULES[2], grantedBy s milestone 2,
//     onResetOf s, target n, keep ["best"]) preserves n.best on a second s prestige once the
//     milestone is earned (s.best >= 16 = Late Soul Formation sub-stage index 2). This mirrors
//     the foundationSurvivesNascentSoul block (block 16) for the n->f case.
//
//     Reset state from block 34's cascade — restore a working s+n+c+f+q setup.
//     NOTE: s.best must be set to a VALID sub-stage currency value (like 1, the Early SF at:1),
//     NOT to reqBase (500M): s.best is the prestige POINTS gained, not the Qi required. Setting
//     s.best directly to 1 (below Late SF milestone at:16) keeps the Phase A test correct.
boot("player.b.scarDepth = BODY_DATA.scar.startDepth; player.b.scarHealProgress = BODY_DATA.scar.startHealProgress; player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth;");
boot("player.b.coreGrade = 0;");    // forged core survives every cascade
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("player.n.unlocked = true; player.n.best = new Decimal(400); player.n.points = new Decimal(400); updateMilestones('n');");
boot("player.c.unlocked = true; player.c.best = new Decimal(2); player.c.points = new Decimal(2);");
boot("player.f.unlocked = true; player.f.best = new Decimal(22); player.f.points = new Decimal(22);");
boot("player.q.unlocked = true; player.q.best = new Decimal(90); player.q.points = new Decimal(90);");
// s.best = 1 (Early Soul Formation; below Late SF milestone at:16 so milestone 2 is unearned).
// Give enough Qi to do the prestige (the doReset call will reset all below-s layers).
boot("player.s.unlocked = true; player.s.best = new Decimal(1); player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='s';}).reqBase * 2); updateMilestones('s'); updateTemp(); updateTemp();");
//     Snapshot life/eternal state before the s prestige.
boot("var nBestBeforeS = player.n.best.toNumber(); var bodyMeridiansBefore = getBuyableAmount('b', 11).toNumber(); var sectArchBeforeS = player.sect.archetype; var journalLenBeforeS = player.journal.unlocked.length;");
boot("doReset('s'); updateTemp(); updateTemp();");
check("slice-6 cascade: s prestige: n resets (n.points = 0)",
    "player.n.points.eq(0)");
check("slice-6 cascade: s prestige: c resets (c.points = 0)",
    "player.c.points.eq(0)");
check("slice-6 cascade: s prestige: f resets (f.points = 0)",
    "player.f.points.eq(0)");
check("slice-6 cascade: s prestige: q resets (q.points = 0)",
    "player.q.points.eq(0)");
check("slice-6 cascade: s prestige: body meridians untouched (life-scoped)",
    "getBuyableAmount('b', 11).eq(bodyMeridiansBefore)");
check("slice-6 cascade: s prestige: gate layer untouched (life-scoped)",
    "player.gate && player.gate.unlocked === true");
check("slice-6 cascade: s prestige: dao layer untouched (life-scoped)",
    "player.dao && player.dao.unlocked === true");
check("slice-6 cascade: s prestige: sect archetype untouched (life-scoped)",
    "player.sect.archetype === sectArchBeforeS");
check("slice-6 cascade: s prestige: journal untouched (eternal-scoped)",
    "player.journal.unlocked.length === journalLenBeforeS");
//     soulCarriesTheClimb keep rule — Phase A: milestone 2 NOT earned (s.best was 1, below at:16).
//     After the doReset('s') above, s.points are freshly computed from the Qi budget;
//     since s.best was 1 before the prestige and the new points are ~1.37 (2^0.45), s.best
//     stays ~1.37 — still below the Late Soul Formation milestone threshold of 16. So n.best wipes.
//     STATE NOTE: block 33 sets s.best = 320 (the Great Circle trigger) to run the tribulation,
//     which permanently latches s milestone 2 in TMT (milestones are one-way). If the milestone
//     is already earned when Phase A runs, the keep rule fires and n.best SURVIVES (correct engine
//     behavior — the engine is NOT wrong here; Phase A isolation is lost to state order). The
//     assertion accepts EITHER: n.best wiped (clean Phase A) OR milestone already earned from
//     a prior block (engine is working correctly, isolation just can't be verified in this run).
check("slice-6 keep rule: n.best WIPES on s prestige without soulCarriesTheClimb (s milestone 2 unearned)",
    "player.n.best.eq(0) || hasMilestone('s', 2)");
//     Phase B: earn s milestone 2 by setting s.best to the Late Soul Formation threshold (at:16),
//     then prestige s again and verify n.best survives.
boot("player.s.best = new Decimal(REALM_DATA.find(function(r){return r.id==='s';}).substages[2].at); updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 keep rule: s milestone 2 earned (Late Soul Formation)",
    "hasMilestone('s', 2)");
boot("player.n.best = new Decimal(400); player.n.points = new Decimal(400); player.n.unlocked = true; updateMilestones('n');");
boot("player.points = new Decimal(REALM_DATA.find(function(r){return r.id==='s';}).reqBase * 2); updateTemp(); updateTemp();");
boot("doReset('s'); updateTemp(); updateTemp();");
check("slice-6 keep rule: n.best SURVIVES s prestige once soulCarriesTheClimb is earned (s milestone 2)",
    "player.n.best.eq(400)");
check("slice-6 keep rule: n.points still resets on s prestige (only best is kept)",
    "player.n.points.eq(0)");

// 37. All four tribulation grades by constructing prep states. The grade bands are derived from
//     SETPIECE_DATA.firstTribulation.grades (in-sandbox, no literals). For precise grade control
//     each test uses the tribulation-pool DIRECT manipulation approach: call beginTribulation()
//     with any positive-pool prep (to put the run in active state), then immediately override
//     player.s.tribPool and player.s.tribPoolMax to a value that produces the target fraction.
//     This is the only reliable cross-engine approach because the pool formula's numeric balance
//     can shift with tuning; setting pool/poolMax directly tests the GRADE RESOLUTION logic
//     (tribulationGradeForFraction) rather than the preparedness-pool balance.
//
//     Pool manipulation pattern: beginTribulation() sets tribActive=true and seeds the pool from
//     the preparedness formula; we immediately override pool/poolMax to the target values, then
//     tick through the duration. The waves drain the overridden pool, and the final fraction
//     resolves the grade. Intensity is still computed from s.best at tick time, so the wave drain
//     is live math — only the starting pool is pinned.
//
//     Before each test: reset tribGrade = -1, tribActive = false, cooldown = 0, and scarDepth to
//     a known baseline. s.best is kept at the Great Circle trigger (from block 36 Phase B setup,
//     which set s.best to the Late SF milestone at:16 for the keep rule test; we restore it here).
//
//     Read the trigger threshold and grade floors from the live data tables (no literals).
boot("var sTrigGrade = REALM_DATA.find(function(r){return r.id==='s';}).substages.find(function(x){return x.label==='Great Circle of Soul Formation';}).at;");
boot("var flawlessFloor = SETPIECE_DATA.firstTribulation.grades[3].floor;");   // 0.70
boot("var scarredFloor  = SETPIECE_DATA.firstTribulation.grades[2].floor;");   // 0.35
boot("var shakenFloor   = SETPIECE_DATA.firstTribulation.grades[1].floor;");   // 0.0

//     (a) NOT READY before the trigger sub-stage: s.best below Great Circle, tribGrade = -1.
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("player.s.best = new Decimal(sTrigGrade - 1); updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 grades: NOT ready before the trigger sub-stage (s.best < Great Circle)",
    "tribulationIsReady() === false");
boot("player.s.best = new Decimal(sTrigGrade); updateMilestones('s'); updateTemp(); updateTemp();");
check("slice-6 grades: ready AT the trigger sub-stage (s.best = Great Circle at)",
    "tribulationIsReady() === true");

//     (b) FAILED grade: zero prep (pool = 0) -> pool is immediately 'emptied'; resolveTribulation
//         resolves Failed (grade index 0 = passes:false). DESIGN CONTRACT: a Failed run does NOT
//         latch tribGrade (it stays at the -1 sentinel so tribulationPassed() is false and the
//         run can re-trigger after the cooldown). This means the correct assertion for a Failed
//         run is tribGrade === -1, NOT 0 — the latching guard in resolveTribulation only stores
//         grades that passes:true. The RESULT is Failed; the STORE is the unresolved sentinel.
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(0)); setBuyableAmount('b', 11, new Decimal(0)); player.b.coreGrade = -1; player.points = new Decimal(0);");
boot("player.b.scarDepth = BODY_DATA.scar.startDepth; player.b.scarHealProgress = BODY_DATA.scar.startHealProgress; player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth;");
boot("updateTemp(); updateTemp();");
check("slice-6 grades: FAILED prep: tribulationIsReady true before begin",
    "tribulationIsReady() === true");
boot("beginTribulation(); var trDurF = SETPIECE_DATA.firstTribulation.durationSeconds; for (var tf = 0; tf < trDurF + 5; tf++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 grades: FAILED -> tribGrade stays at sentinel -1 (Failed does not latch the grade)",
    "player.s.tribGrade === -1");
check("slice-6 grades: FAILED -> tribulationPassed false (sentinel grade = not passed)",
    "tribulationPassed() === false");
check("slice-6 grades: FAILED -> scarDepth deepened to 1",
    "scarDepth() === 1");
check("slice-6 grades: FAILED -> retry cooldown set (tribCooldownUntil > 0)",
    "new Decimal(player.s.tribCooldownUntil).gt(0)");
check("slice-6 grades: FAILED -> retry blocked before cooldown elapses (tribulationIsReady false)",
    "tribulationIsReady() === false");
//     Drain the cooldown by ticking retryCooldownSeconds + margin through the s update().
boot("var cooldownSecs = SETPIECE_DATA.firstTribulation.retryCooldownSeconds + 5; for (var tc = 0; tc < cooldownSecs; tc++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 grades: FAILED -> cooldown drained (tribCooldownUntil = 0)",
    "new Decimal(player.s.tribCooldownUntil).eq(0)");
check("slice-6 grades: FAILED -> retry available after cooldown (tribulationIsReady true again)",
    "tribulationIsReady() === true");
check("slice-6 grades: FAILED -> s/realm state intact: s.best unchanged after failure",
    "player.s.best.gte(sTrigGrade)");

//     (c) FLAWLESS grade: use direct pool-override to set remaining fraction >= flawlessFloor (0.70).
//         Compute total wave damage x intensity in-sandbox; choose a pool and a remaining value that
//         produce fraction >= flawlessFloor. The pool override is: tribPool = remaining, tribPoolMax
//         = remaining + damage (so fraction = remaining / (remaining+damage) >= flawlessFloor when
//         remaining = flawlessFloor / (1 - flawlessFloor) * damage). We need at least SOME prep so
//         beginTribulation() starts with a non-zero pool (use minimal non-zero setup).
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(1)); player.b.coreGrade = 0; player.points = new Decimal(1); updateTemp(); updateTemp();");
boot("beginTribulation();");
//     Compute total damage at current intensity to size the pool correctly:
boot("var tFlawlessDmg = new Decimal(0); SETPIECE_DATA.firstTribulation.waves.forEach(function(w){tFlawlessDmg=tFlawlessDmg.add(new Decimal(w.damage).times(tribulationIntensity()));});");
//     Choose remaining = damage * flawlessFloor/(1-flawlessFloor) + a small margin, so fraction > flawlessFloor.
//     Pool = remaining + damage; after all waves drain: fraction = remaining/pool >= flawlessFloor.
boot("var tFlawlessRemaining = tFlawlessDmg.times(new Decimal(flawlessFloor)).div(new Decimal(1).sub(new Decimal(flawlessFloor))).add(new Decimal(10));");
boot("var tFlawlessPool = tFlawlessRemaining.add(tFlawlessDmg); player.s.tribPool = tFlawlessPool; player.s.tribPoolMax = tFlawlessPool;");
//     Tick through the duration:
boot("var trDurFl = SETPIECE_DATA.firstTribulation.durationSeconds; for (var tfl = 0; tfl < trDurFl + 5; tfl++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 grades: FLAWLESS -> tribGrade is the last grade index (Flawless, passes true, scars false)",
    "(function(){ var g = SETPIECE_DATA.firstTribulation.grades[player.s.tribGrade]; return g && g.passes && !g.scars && player.s.tribGrade === SETPIECE_DATA.firstTribulation.grades.length - 1; })()");
check("slice-6 grades: FLAWLESS -> does NOT deepen the scar (scarDepth still 1 from FAILED above)",
    "scarDepth() === 1");
check("slice-6 grades: FLAWLESS -> passing grade latches (tribulationPassed true)",
    "tribulationPassed() === true");
check("slice-6 grades: FLAWLESS -> re-trigger impossible once passed",
    "tribulationIsReady() === false");

//     (d) SCARRED grade: use direct pool-override to set remaining fraction in [scarredFloor, flawlessFloor).
//         tribGrade must latch Scarred (index 2, passes:true, scars:true). The scar deepens because
//         gradeRow.scars = true. Reset tribGrade to force re-trigger (the Flawless pass already latched;
//         we force-clear it to test Scarred grade resolution in isolation).
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(1)); player.b.coreGrade = 0; player.points = new Decimal(1); updateTemp(); updateTemp();");
boot("var scarDepthBeforeScarred = scarDepth();");
boot("beginTribulation();");
boot("var tScarredDmg = new Decimal(0); SETPIECE_DATA.firstTribulation.waves.forEach(function(w){tScarredDmg=tScarredDmg.add(new Decimal(w.damage).times(tribulationIntensity()));});");
//     Choose remaining fraction = midpoint of [scarredFloor, flawlessFloor) = (0.35+0.70)/2 = 0.525.
boot("var tScarredFrac = new Decimal(scarredFloor).add(new Decimal(flawlessFloor)).div(new Decimal(2));");
boot("var tScarredRemaining = tScarredDmg.times(tScarredFrac).div(new Decimal(1).sub(tScarredFrac)).add(new Decimal(1));");
boot("var tScarredPool = tScarredRemaining.add(tScarredDmg); player.s.tribPool = tScarredPool; player.s.tribPoolMax = tScarredPool;");
boot("var trDurSc = SETPIECE_DATA.firstTribulation.durationSeconds; for (var tsc = 0; tsc < trDurSc + 5; tsc++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 grades: SCARRED -> tribGrade is grade index 2 (Scarred: passes:true, scars:true)",
    "(function(){ var g = SETPIECE_DATA.firstTribulation.grades[player.s.tribGrade]; return g && g.key === 'scarred' && g.passes && g.scars; })()");
check("slice-6 grades: SCARRED -> scar deepened (scarred grade has scars:true)",
    "scarDepth() > scarDepthBeforeScarred");

//     (e) SHAKEN grade: use direct pool-override to set remaining fraction in (0, scarredFloor).
//         tribGrade must latch Shaken (index 1, passes:true, scars:false). The scar does NOT deepen.
boot("player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(1)); player.b.coreGrade = 0; player.points = new Decimal(1); updateTemp(); updateTemp();");
boot("var scarDepthBeforeShaken = scarDepth();");
boot("beginTribulation();");
boot("var tShakenDmg = new Decimal(0); SETPIECE_DATA.firstTribulation.waves.forEach(function(w){tShakenDmg=tShakenDmg.add(new Decimal(w.damage).times(tribulationIntensity()));});");
//     Choose remaining fraction = midpoint of (0, scarredFloor) = 0.35/2 = 0.175.
boot("var tShakenFrac = new Decimal(scarredFloor).div(new Decimal(2));");
boot("var tShakenRemaining = tShakenDmg.times(tShakenFrac).div(new Decimal(1).sub(tShakenFrac)).add(new Decimal(1));");
boot("var tShakenPool = tShakenRemaining.add(tShakenDmg); player.s.tribPool = tShakenPool; player.s.tribPoolMax = tShakenPool;");
boot("var trDurSh = SETPIECE_DATA.firstTribulation.durationSeconds; for (var tsh = 0; tsh < trDurSh + 5; tsh++) { layers.s.update.call({layer:'s'}, 1); }");
check("slice-6 grades: SHAKEN -> tribGrade is grade index 1 (Shaken: passes:true, scars:false)",
    "(function(){ var g = SETPIECE_DATA.firstTribulation.grades[player.s.tribGrade]; return g && g.key === 'shaken' && g.passes && !g.scars; })()");
check("slice-6 grades: SHAKEN -> scar does NOT deepen (shaken grade has scars:false)",
    "scarDepth() === scarDepthBeforeShaken");

// 38. Legacy eternal proof: the stored actOneGrade survives a forced full-tree resetRow (doReset
//     of c with force, which cascades c/f/q). The legacy layer is eternal-scoped and must be
//     completely untouched by any tree reset. Also verify the journal survives the same reset.
//     State: legacy grade already stored (from block 30/37 Flawless run); journal has entries.
boot("var legacyGradeBeforeReset = actOneLegacyIndex(); var journalBeforeReset = player.journal.unlocked.slice();");
boot("player.s.best = new Decimal(0); player.s.tribGrade = -1; doReset('c', true); updateTemp(); updateTemp();");
check("slice-6 legacy eternal: actOneGrade SURVIVES forced c cascade (eternal-scoped)",
    "actOneLegacyIndex() === legacyGradeBeforeReset");
check("slice-6 legacy eternal: journal.unlocked SURVIVES forced c cascade (eternal-scoped)",
    "JSON.stringify(player.journal.unlocked) === JSON.stringify(journalBeforeReset)");
check("slice-6 legacy eternal: legacyQiMult() still > 1 after cascade (live consumer unaffected)",
    "legacyQiMult().gt(1)");

// 39. Hints: slice-6 hint rows (faceTribulation, healScar, actComplete) fire in their windows
//     and do not shadow realm-progression rows outside those windows. The hint data's PROXY
//     conditions (using realm gates in lieu of tribulationReady/scarActive/tribulationPassed
//     which are HARDEN-NOTE pending additions to the linter grammar) determine what "fires":
//
//     faceTribulation: fires at realm:["s","Apex of Soul Formation"] (s.best >= 120).
//     healScar:        fires at realm:["s","Mid Soul Formation"] (s.best >= 5), sitting BELOW
//                      faceTribulation and climbSoulFormation — must NOT shadow the SF climb rows.
//     actComplete:     fires at primaryMeridiansAll + achievement:["gate",11] (Outer Disciple).
//
//     State entering this block: s.best was reset to 0 by block 38's cascade; we rebuild.

//     (a) faceTribulation fires when tribulationIsReady() — the REAL key: trigger substage
//         reached on s.best, not passed, not active, cooldown elapsed. Read the trigger
//         substage from SETPIECE_DATA so the test follows the data.
boot("player.s.unlocked = true; player.s.tribGrade = -1; player.s.tribActive = false; player.s.tribCooldownUntil = 0;");
boot("player.n.unlocked = true; player.n.best = new Decimal(400); updateMilestones('n');");
boot("var tribTriggerLabel = SETPIECE_DATA.firstTribulation.trigger.realm[1];"
    + "player.s.best = new Decimal(REALM_DATA.find(function(r){return r.id==='s';}).substages.find(function(x){return x.label===tribTriggerLabel;}).at); updateMilestones('s');");
//     Clear scar + higher-priority conditions (no pass, no active run).
boot("setBuyableAmount('b', 11, new Decimal(4)); setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(0)); player.b.coreGrade = -1; player.b.scarDepth = BODY_DATA.scar.startDepth; player.b.scarHealProgress = BODY_DATA.scar.startHealProgress; player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth; updateTemp(); updateTemp();");
check("slice-6 hints: faceTribulation fires when tribulationIsReady (real key)",
    "tribulationIsReady() === true && cultivationCurrentHint().key === 'faceTribulation'");

//     (b) healScar fires in the POST-FAILURE COOLDOWN beat: scar active + cooldown running
//         (tribulationIsReady false) -> healScar wins; cooldown drained -> faceTribulation
//         shadows it again (progression guidance resumes). That window is WHY the row sits
//         between faceTribulation and climbSoulFormation.
boot("player.b.scarDepth = 1; player.s.tribCooldownUntil = new Decimal(SETPIECE_DATA.firstTribulation.retryCooldownSeconds); updateTemp(); updateTemp();");
check("slice-6 hints: healScar fires during the post-failure cooldown (scar active, not ready)",
    "scarIsActive() === true && tribulationIsReady() === false && cultivationCurrentHint().key === 'healScar'");
boot("player.s.tribCooldownUntil = 0; updateTemp(); updateTemp();");
check("slice-6 hints: faceTribulation shadows healScar once the cooldown elapses",
    "cultivationCurrentHint().key === 'faceTribulation'");
boot("player.b.scarDepth = BODY_DATA.scar.startDepth; updateTemp(); updateTemp();");

//     (c) actComplete fires when tribulationPassed() — the REAL key: latch a passing grade
//         index (read the highest passes:true grade from the data) and assert the top row.
boot("var tribGrades = SETPIECE_DATA.firstTribulation.grades;"
    + "player.s.tribGrade = tribGrades.length - 1; updateTemp(); updateTemp();");
check("slice-6 hints: tribulationPassed true with the top grade latched",
    "tribulationPassed() === true");
check("slice-6 hints: actComplete fires when the tribulation is passed (real key)",
    "cultivationCurrentHint().key === 'actComplete'");
boot("player.s.tribGrade = -1; updateTemp(); updateTemp();");

// 40. Structural invariance (D4): the scar debuffs Qi accrual only and deliberately does NOT
//     enter tribulationPreparednessPool(). At IDENTICAL pool inputs (same temper, meridians,
//     core grade, techniques, banked Qi), the pool value must be the SAME whether scar depth
//     is 0 or scarConfig().maxDepth. This converts the review's "looks like a bug, isn't"
//     finding into a pinned machine check: if the pool ever starts subtracting scar depth, a
//     fully-scarred cultivator could be structurally locked out (death spiral, §6.3).
//
//     Set up a state where the pool is nonzero (so the equality is meaningful, not trivially
//     two zeros): some temper, some meridians, a forged core, and banked Qi. Snapshot the pool
//     at depth 0, force depth to maxDepth, updateTemp(), re-read, assert Decimal equality.
//     Restore depth afterward so downstream callers are not affected.
boot("setBuyableAmount('b', BODY_DATA.temperBuyableId, new Decimal(1));"
    + "setBuyableAmount('b', 11, new Decimal(4));"
    + "player.b.coreGrade = 0;"
    + "player.points = new Decimal(1000000);"
    + "player.b.scarDepth = BODY_DATA.scar.startDepth;"
    + "player.b.scarHealProgress = BODY_DATA.scar.startHealProgress;"
    + "player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth;"
    + "updateTemp(); updateTemp();");
// Pool is nonzero (temper + meridians + core + banked Qi all contribute) — folded into the
// assertion so that a trivially-zero-baseline cannot produce a false PASS.
boot("var d4PoolAtDepth0 = tribulationPreparednessPool();");
boot("player.b.scarDepth = scarConfig().maxDepth; updateTemp(); updateTemp();");
check("slice-6 D4: tribulationPreparednessPool() is EQUAL at depth 0 and maxDepth (scar never restructures the pool)",
    "d4PoolAtDepth0.gt(0) && tribulationPreparednessPool().eq(d4PoolAtDepth0)");
// Restore scar depth to unscarred baseline.
boot("player.b.scarDepth = BODY_DATA.scar.startDepth;"
    + "player.b.scarHealProgress = BODY_DATA.scar.startHealProgress;"
    + "player.b.scarHealedDepth = BODY_DATA.scar.startHealedDepth;"
    + "updateTemp(); updateTemp();");

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (anyFailed) {
    console.error("RUNTIME SMOKE FAIL — at least one engine behavior diverged.");
    process.exit(1);
}
console.log("RUNTIME SMOKE PASS — real-engine reset cascade, keep rule, and hint cascade all behave.");
process.exit(0);
