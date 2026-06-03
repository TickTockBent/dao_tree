// js/build/pacing-sim.js — throwaway pacing simulation harness (NOT loaded by the
// game; not scanned by the linter). Drives a coarse optimal-ish player against the
// data tables to estimate minutes-to-first-core, so cost-curve retuning (spec §1,
// 45-90 min target) is an acceptance test on DATA rather than a guess.
//
// Usage: node js/build/pacing-sim.js
//
// The model mirrors getPointGen()/getResetGain(): Qi/sec is the product of the
// data-defined multipliers; breakthroughs use gain=(Qi/req)^exp. The "player"
// greedily buys the cheapest useful thing and breaks through when it pays.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");
const dataDir = path.join(root, "js", "data");
const sandbox = {};
sandbox.globalThis = sandbox;
["constants.js", "realms.js", "body.js", "gates.js"].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), vm.createContext(sandbox), { filename: f });
});
const REALM_DATA = sandbox.REALM_DATA;
const BODY_DATA = sandbox.BODY_DATA;
const GATE_DATA = sandbox.GATE_DATA;

const q = REALM_DATA.find(r => r.id === "q");
const f = REALM_DATA.find(r => r.id === "f");
const c = REALM_DATA.find(r => r.id === "c");

// Optional overrides for sweeping (env): does NOT touch the data files.
function ov(name, target, key, parse) {
    if (process.env[name] !== undefined) target[key] = parse(process.env[name]);
}
ov("F_REQ", f, "reqBase", Number);
ov("F_EXP", f, "gainExp", Number);
ov("Q_EXP", q, "gainExp", Number);
ov("Q_REQ", q, "reqBase", Number);
ov("C_FORGEREQ", c.forge, "forgeReq", Number);
ov("BASE_RATE", BODY_DATA.qi, "baseRate", Number);
ov("C_REQ", c, "reqBase", Number);
const primary = BODY_DATA.buyables.find(b => b.key === "primaryMeridian");
const extra = BODY_DATA.buyables.find(b => b.key === "extraordinaryMeridian");
const temper = BODY_DATA.buyables.find(b => b.key === "temper");
ov("TEMP_RATIO", temper, "costRatio", Number);
ov("TEMP_BASE", temper, "costBase", Number);
ov("PRIM_RATIO", primary, "costRatio", Number);

function buyableCost(row, owned) { return Math.floor(row.costBase * Math.pow(row.costRatio, owned)); }

function tierMilestonesReached(temperLevel) {
    let mult = 1;
    BODY_DATA.temperTiers.forEach(t => { if (temperLevel >= t.fromLevel) mult *= t.qiBonus; });
    return mult;
}
function temperTierIndex(temperLevel) {
    let idx = -1;
    BODY_DATA.temperTiers.forEach((t, i) => { if (temperLevel >= t.fromLevel) idx = i; });
    return idx;
}
const tendonIndex = BODY_DATA.temperTiers.findIndex(t => t.key === "tendon");

function realmMult(state) {
    let mult = 1;
    [q, f, c].forEach(r => {
        const best = state.best[r.id] || 0;
        r.substages.forEach(s => { if (best >= s.at) mult *= s.qiMult; });
    });
    return mult;
}
function meridianMult(state) {
    return Math.pow(primary.effectBase, state.primary) * Math.pow(extra.effectBase, state.extra);
}
function gateMult(state) {
    // Outer Disciple: f reached (best.f>=1) AND meridians>=6 AND temper>=Flesh.
    const fleshLevel = BODY_DATA.temperTiers.find(t => t.key === "flesh").fromLevel;
    if ((state.best.f || 0) >= 1 && state.primary >= 6 && state.temper >= fleshLevel) return 1.25;
    return 1;
}
function foundationGradeMult(state) {
    if (state.foundationBand < 0) return 1;
    return f.grade.bands[state.foundationBand].fMult;
}
function qiPerSec(state) {
    return BODY_DATA.qi.baseRate * meridianMult(state) * tierMilestonesReached(state.temper) *
        realmMult(state) * gateMult(state) * foundationGradeMult(state);
}

function substagesReached(realmId, best) {
    const r = REALM_DATA.find(x => x.id === realmId);
    let n = 0; r.substages.forEach(s => { if (best >= s.at) n++; }); return n;
}
function gradeScore(state) {
    const g = f.grade;
    const merTerm = Math.min(state.primary / g.meridianDenominator, 1) * g.weightMeridian;
    const tempTerm = Math.min(state.temper, g.temperDenominator) / g.temperDenominator * g.weightTemper;
    const realmTerm = substagesReached("q", state.best.q || 0) / g.realmDenominator * g.weightRealm;
    return Math.min(Math.max(merTerm + tempTerm + realmTerm, 0), 1);
}
function bandForScore(score) {
    let idx = -1; f.grade.bands.forEach((b, i) => { if (score >= b.floor) idx = i; }); return idx;
}

function simulate(verbose) {
    const state = {
        qi: 0, primary: 0, extra: 0, temper: 0,
        best: { q: 0, f: 0, c: 0 }, points: { q: 0, f: 0 },
        foundationBand: -1, coreForged: false
    };
    let seconds = 0;
    const maxSeconds = 60 * 60 * 10; // 10h cap
    const dt = 1;
    const marks = {};
    function mark(name) { if (marks[name] === undefined) marks[name] = seconds; }
    const fGreatCircleMark = f.substages.find(s => s.label === c.unlock.realm[1]).at;

    function qUnlocked() { return state.qi >= q.unlock.qi || (state.best.q || 0) > 0; }
    function fUnlocked() {
        const need = q.substages.find(s => s.label === f.unlock.realm[1]).at;
        return (state.best.q || 0) >= need && state.primary >= f.unlock.meridians;
    }
    function cUnlocked() {
        const need = f.substages.find(s => s.label === c.unlock.realm[1]).at;
        return (state.best.f || 0) >= need && temperTierIndex(state.temper) >= tendonIndex;
    }

    while (seconds < maxSeconds) {
        state.qi += qiPerSec(state) * dt;
        seconds += dt;

        if (fUnlocked()) mark("f_unlock");
        if ((state.best.f || 0) >= fGreatCircleMark) mark("f_greatCircle");
        if (state.primary >= primary.limit) mark("primary_max");
        if (temperTierIndex(state.temper) >= tendonIndex) mark("tendon");

        // Forge check: c unlocked + enough fuel (f.points) -> forge with best safe option.
        if (cUnlocked() && state.points.f >= c.forge.forgeReq) {
            state.coreForged = true;
            if (verbose) report(state, seconds);
            if (verbose) console.log("  marks(min): " + JSON.stringify(
                Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, (v / 60).toFixed(1)]))));
            return { seconds, state, marks };
        }

        // ---- Player policy (a competent, not perfect, player) ----
        // Phase goals drive spending so the sim reflects intended play, not a
        // pathological greedy loop:
        //   1. Open meridians toward 4 (to unlock f) then on toward 12.
        //   2. Temper toward Tendon (level 10) to unlock c, plus a couple more.
        //   3. Keep enough Qi to breakthrough q/f when the gain is worthwhile.
        const qMaxBest = q.substages[q.substages.length - 1].at;
        const fGreatCircle = f.substages.find(s => s.label === c.unlock.realm[1]).at;
        const extraToken = extra.unlock.realm[1];
        const extraUnlockQ = typeof extraToken === "string"
            ? q.substages.find(s => s.label === extraToken).at : extraToken;

        // Decide a single "want to buy" target by priority, then buy it if affordable.
        function tryBuy(name, row, owned, cap) {
            if (owned >= cap) return false;
            const cost = buyableCost(row, owned);
            if (state.qi >= cost) { state.qi -= cost; state[name]++; return true; }
            return false;
        }
        // Buy in priority order, looping so cheap things batch up.
        let acted = true;
        while (acted) {
            acted = false;
            // Priority A: meridians to 4 (gate f).
            if (state.primary < 4 && tryBuy("primary", primary, state.primary, primary.limit)) { acted = true; continue; }
            // Priority B: temper to Tendon (gate c) — first 10 levels.
            if (state.temper < 10 && tryBuy("temper", temper, state.temper, temper.limit)) { acted = true; continue; }
            // Priority C: fill primary meridians (compounding Qi/sec + grade).
            if (state.primary < primary.limit && tryBuy("primary", primary, state.primary, primary.limit)) { acted = true; continue; }
            // Priority D: temper toward Marrow cap (grade ceiling + qi bonus).
            if (state.temper < temper.limit && tryBuy("temper", temper, state.temper, temper.limit)) { acted = true; continue; }
            // Priority E: extraordinary meridians once unlocked.
            if (state.primary >= primary.limit && (state.best.q || 0) >= extraUnlockQ &&
                tryBuy("extra", extra, state.extra, extra.limit)) { acted = true; continue; }
        }

        // ---- Breakthroughs ----
        // q breakthrough: only while it advances best (more substages) and only if
        // we are NOT mid-pursuit of a meridian/temper buy we can't yet afford.
        if (qUnlocked() && (state.best.q || 0) < qMaxBest && !fUnlocked()) {
            const reqQ = q.reqBase;
            const gainQ = Math.floor(Math.pow(state.qi / reqQ, q.gainExp));
            const wouldBe = state.points.q + gainQ;
            // Breakthrough when it raises best by a worthwhile chunk.
            if (gainQ >= 1 && wouldBe > (state.best.q || 0) * 1.15 && state.qi >= reqQ) {
                state.points.q = wouldBe;
                if (state.points.q > (state.best.q || 0)) state.best.q = state.points.q;
                state.qi = 0;
            }
        }
        // f breakthrough: bank fuel toward forgeReq and push f.best to Great Circle.
        if (fUnlocked()) {
            const reqF = f.reqBase;
            const gainF = Math.floor(Math.pow(state.qi / reqF, f.gainExp) * foundationGradeMult(state));
            const needFuel = c.forge.forgeReq;
            const wantMore = (state.best.f || 0) < fGreatCircle || state.points.f < needFuel;
            if (gainF >= 1 && wantMore && state.qi >= reqF) {
                const band = bandForScore(gradeScore(state));
                if (band > state.foundationBand) state.foundationBand = band;
                state.points.f += gainF;
                if (state.points.f > (state.best.f || 0)) state.best.f = state.points.f;
                // f prestige resets q chain + Qi (Body layer + f.points persist).
                state.points.q = 0;
                state.qi = 0;
            }
        }
    }
    return { seconds: maxSeconds, state, timedOut: true };
}

function report(state, seconds) {
    console.log("FORGED first core at " + (seconds / 60).toFixed(1) + " min");
    console.log("  q.best=" + state.best.q + " f.best=" + state.best.f +
        " primary=" + state.primary + " extra=" + state.extra + " temper=" + state.temper);
    console.log("  foundationBand=" + state.foundationBand +
        " (" + (state.foundationBand >= 0 ? f.grade.bands[state.foundationBand].tier : "none") + ")");
    console.log("  peak Qi/sec (this state, no core) ~ " + qiPerSec(state).toFixed(1));
}

const result = simulate(true);
if (result.timedOut) console.log("TIMED OUT (>10h) — pacing way too slow. " +
    "q.best=" + result.state.best.q + " f.best=" + result.state.best.f + " primary=" + result.state.primary + " temper=" + result.state.temper);
console.log("---");
console.log("f.reqBase=" + f.reqBase + " c.forgeReq=" + c.forge.forgeReq +
    " temper costBase=" + temper.costBase + " ratio=" + temper.costRatio +
    " primary costBase=" + primary.costBase + " ratio=" + primary.costRatio);
