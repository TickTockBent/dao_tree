// js/data/setpieces.js — the set-piece config type (design §6.2 "TMT: bar + clickables,
// generalizing the forge's skeleton into a SETPIECE_DATA config type"; build-order slice 6
// "SETPIECE_DATA: the forge config generalized — waves, pools, grades, scar table. Forge =
// instance 1, tribulations = instances 2..n").
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js the same way
// REALM_DATA / BODY_DATA are. A "set-piece" is a one-time, performance-graded breakthrough
// event mounted on a realm row: the player prepares, triggers when ready, and a graded result
// feeds a permanent store. The FORGE (Core Formation) is instance 1; the FIRST TRIBULATION
// (Soul Formation, the Act I capstone) is instance 2. Each realm that carries a set-piece names
// it by key in REALM_DATA via `setpiece`, and the factory resolves the config from here
// (setpieceFor(realmData) -> SETPIECE_DATA[key]) — so the factory's set-piece functions change
// only WHERE they read, never WHAT they compute.
//
// SETPIECE_DATA shape (consumed by the factory's set-piece augmentation):
//   forge             object  INSTANCE 1 — the Core Formation forge, MIGRATED VERBATIM from the
//                             realms.js c row (same field names: forgeReq, fuelBase, pushOptions,
//                             crackTierDrop, refinement, grades). coreForgeData() reads it here now.
//   firstTribulation  object  INSTANCE 2 — the Soul Formation capstone tribulation (§6.2): a timed
//                             multi-wave bar drained against a prepared pool, graded Flawless /
//                             Scarred / Shaken / Failed by the pool fraction remaining at the end.
//   scar              object  THE SCAR TABLE (§1.3 / §6.2 / §10.9): ONE failure-scar slot that
//                             DEEPENS on repeated failure (never stacks), with a heal arc that
//                             converts the debuff into a permanent "Tempered by Ruin" buff.

var SETPIECE_DATA = {
    // -----------------------------------------------------------------------
    // INSTANCE 1 — THE FORGE (Core Formation, §7 / design "Forge = instance 1").
    // Moved VERBATIM from the realms.js c row's `forge` config: identical field
    // names and values, so the factory's forge functions (coreForgeData / performForge
    // / refinementTick ...) change only WHERE they read (SETPIECE_DATA.forge now),
    // never WHAT they compute. EVERY existing forge assertion must pass unchanged.
    // -----------------------------------------------------------------------
    forge: {
        // Requirement to OPEN the forge: Core Formation unlocked + f.points >= forgeReq (§7a).
        forgeReq: 25,
        // Base fuel the 1x (Steady) push spends; each push spends fuelBase * fuelMult
        // of f.points. Set equal to forgeReq so Steady is affordable the moment the
        // forge opens, while Forceful/Reckless demand banking more Foundation fuel.
        fuelBase: 25,
        // Discrete push options (§7a). fuelMult multiplies the base fuel cost,
        // offset shifts the produced grade, crackChance is the drop-one-tier risk.
        pushOptions: [
            { key: "steady",   label: "Steady",   fuelMult: 1, offset: 0, crackChance: 0.00 },
            { key: "forceful", label: "Forceful", fuelMult: 2, offset: 1, crackChance: 0.15 },
            { key: "reckless", label: "Reckless", fuelMult: 3, offset: 2, crackChance: 0.35 }
        ],
        // A crack drops exactly one tier; cracked is the floor (§7a/§9.3).
        crackTierDrop: 1,
        // Refinement loop (§7b): "Warm the Core" accrues progress; a full bar
        // raises grade one tier, capped at the Foundation ceiling. Slow/safe route
        // to the same ceiling the fast/risky push reaches.
        refinement: {
            goal: 100,            // progress units for one tier (§7b)
            ratePerSecond: 1,     // base accrual per second while warming
            tierStep: 1,          // tiers gained per full bar
            barWidth: 360,        // refinement bar width  (px) — UI dimension as data (§11)
            barHeight: 28         // refinement bar height (px)
        },
        // Core Grade ladder (§7): grade key -> global Qi/sec + cultivation mult.
        // ceilingIndex orders the ladder so a Foundation coreCeiling caps it.
        grades: [
            { key: "cracked", label: "Cracked", ceilingIndex: 0, globalMult: 2 },
            { key: "lower",   label: "Lower",   ceilingIndex: 1, globalMult: 3 },
            { key: "middle",  label: "Middle",  ceilingIndex: 2, globalMult: 4 },
            { key: "upper",   label: "Upper",   ceilingIndex: 3, globalMult: 6 },
            { key: "perfect", label: "Perfect", ceilingIndex: 4, globalMult: 8 }
        ]
    },

    // -----------------------------------------------------------------------
    // INSTANCE 2 — THE FIRST TRIBULATION (Soul Formation capstone, §6.2 / §5 Act I
    // table "First Tribulation + Act Legacy Grade"; progression-map §2 "Soul Formation
    // = Act I capstone"). A timed multi-wave bar drained against a PREPARED POOL the
    // player built across Act I (temper, meridians, core grade, techniques, banked Qi).
    // The player CHOOSES when to trigger (after reaching the peak s sub-stage); the run
    // is a TMT bar + update(diff) with NO mid-run actions in v1 (pills / talismans arrive
    // in slice 7+ ⟨design §7.6⟩ — comment it). On the last wave the REMAINING pool fraction
    // resolves the grade (Flawless > Scarred > Shaken > Failed, §6.2); an emptied pool
    // mid-waves is a Failed. Passing latches the grade, fires the Act I Legacy Grade, and
    // (Scarred) deepens the scar; a Failed deepens the scar and sets a retry cooldown.
    // Failure DESTROYS NOTHING else (§6.2): the consumed Qi fuel is the only gamble.
    // -----------------------------------------------------------------------
    firstTribulation: {
        kind: "tribulation",
        name: "The First Tribulation",
        // The player triggers it after reaching the peak Soul Formation sub-stage — a
        // CHOICE of when, exactly as the forge opens after banking fuel. Named stage label
        // (the §5a realm-gate standard), resolved via the shared meets() realm grammar.
        trigger: { realm: ["s", "Great Circle of Soul Formation"] },

        // Intensity = f(power) in v1 (§6.2 "Intensity = f(power, karma, bloodline) ⟨tune⟩").
        // The karma term arrives with Samsara (§6.2 / §7.2) ⟨design⟩ — commented, not built.
        // base is the floor intensity; perBest scales intensity GENTLY with the s realm high-water
        // (a deeper Soul Formation means heaven weighs you a little heavier). Wave damage x
        // intensity drains the pool. TUNING: the trigger fires at the peak s sub-stage (s.best ~=
        // 320, the Great Circle `at`), so at the trigger point intensity = 1.0 + 0.0005 x 320 ~=
        // 1.16 — a modest multiplier the prepared pool is sized against (see the pool weights
        // below). perBest is deliberately TINY so a player who over-climbs s before triggering
        // faces only a slightly heavier storm (1.5x by s.best ~1000), never a runaway wall. ⟨tune⟩
        intensity: { base: 1.0, perBest: 0.0005 },

        // Wall-clock length of the run: the waves are spaced evenly across this many seconds.
        // ~35s is long enough to read the bar fall and feel the climax, short enough not to be
        // a chore (the forge is a single click; the tribulation is a held breath). ⟨tune⟩
        durationSeconds: 35,

        // The waves (§6.2 "multi-wave bar drain"). Each wave's damage (x intensity) is removed
        // from the pool when the run's elapsed time crosses that wave's scheduled moment; the
        // waves are spaced evenly across durationSeconds (the factory schedules wave i at
        // (i+1)/waveCount of the duration). Flavor names are the canonical heavenly tribulation
        // elements (wind / fire / lightning ...); the damage ladder RISES so the last waves are
        // the test (an under-prepared pool empties on the final lightning). ⟨tune⟩
        waves: [
            { key: "gale",      name: "Gale",            damage: 14 },
            { key: "flame",     name: "Heart Flame",     damage: 18 },
            { key: "frost",     name: "Killing Frost",   damage: 22 },
            { key: "thunder",   name: "Nine-Fold Thunder", damage: 28 },
            { key: "tribulationLightning", name: "Tribulation Lightning", damage: 36 }
        ],

        // Preparedness -> starting pool (§6.2 "a prepared pool": tempering, talismans,
        // formations, pills). The pool is a weighted sum of what Act I built, PLUS banked Qi
        // as fuel (consumed at trigger). The qi-fuel term is normalized (log10/denom) so banked
        // Qi HELPS but cannot SOLO the pool — a rushed entry with a huge Qi bank still risks Failed
        // (§6.2 tension).
        //
        // BALANCE (against total raw wave damage 118 x intensity ~1.16 at the trigger ~= 137 drained):
        //   - FULL prep (max temper + all meridians + Perfect core + ~4 techniques + ~1e12 banked
        //     Qi) -> poolMax ~= 90+90+130+60+90 = 460; remaining ~= 460-137 = 323; frac ~= 0.70 ->
        //     FLAWLESS (the top band's floor) — so Flawless demands near-everything Act I offers.
        //   - MID prep (~half of each axis) -> poolMax ~= 230; remaining ~= 93; frac ~= 0.40 ->
        //     SCARRED/SHAKEN — a player reaching s Peak with reasonable prep clears at Shaken+.
        //   - RUSHED entry (low temper/meridians, Cracked core, little banked Qi) -> poolMax ~=
        //     60-100; the ~137 drain EMPTIES it -> FAILED (a real risk, never a wall: retry after
        //     the cooldown). This is the §6.2 tension made concrete. All ⟨tune⟩.
        pool: {
            weightTemper: 90,         // temper level / temperDenominator -> up to 90 pool
            temperDenominator: 24,    // BODY_DATA temper buyable limit (full temper)
            weightMeridians: 90,      // primary meridians / meridianDenominator -> up to 90 pool
            meridianDenominator: 12,  // BODY_DATA primary meridian cap (all primaries)
            weightCoreGrade: 130,     // (core ceilingIndex / top) -> up to 130 pool (the carried artifact dominates)
            weightTechniques: 60,     // owned techniques / techniqueDenominator -> up to 60 pool
            techniqueDenominator: 4,  // ~four techniques is "well-armed" for Act I
            qiFuelWeight: 90,         // banked-Qi term cap: log10(qi)/qiFuelDenominator x weight
            qiFuelDenominator: 12     // log10 normalizer: qi ~1e12 banked maxes the fuel term
        },

        // Grade by REMAINING pool fraction when the LAST wave resolves (§6.2 rank order:
        // Flawless > Scarred > Shaken > Failed). gradeIndex = array index (ascending). A pool
        // emptied mid-waves resolves to Failed (index 0) immediately. `floor` is the inclusive
        // lower bound on the remaining fraction; the highest band whose floor the fraction meets
        // wins. passes=false only for Failed; scars=true marks the grades that leave a scar
        // (Failed always; Scarred by definition; Flawless/Shaken are clean).
        grades: [
            { key: "failed",   label: "Failed",   passes: false, scars: true               },  // index 0: pool emptied
            { key: "shaken",   label: "Shaken",   passes: true,  scars: false, floor: 0.0  },  // 0 < frac < scarred.floor
            { key: "scarred",  label: "Scarred",  passes: true,  scars: true,  floor: 0.35 },  // a marked but real ascent
            { key: "flawless", label: "Flawless", passes: true,  scars: false, floor: 0.70 }   // near-full pool remaining
        ],

        // After a Failed, a beat to re-prepare (bank Qi, heal the scar a little) before the
        // run can be re-triggered (§6.2 "failure keeps paying", never a wall — retry after
        // cooldown). A pass can never re-trigger (the tribulation is once per life). ⟨tune⟩
        retryCooldownSeconds: 60
    },

    // -----------------------------------------------------------------------
    // THE SCAR TABLE (§1.3 "a visible debuff with a heal arc → permanent buff"; §6.2
    // "the tribulation-failure Scar is a single slot that DEEPENS on repeated failure
    // instead of multiplying"; §10.9 "depth ceiling, lean 3"). ONE failure-scar slot:
    //   - depth deepens on each Failed/Scarred result, capped at maxDepth (never stacks).
    //   - while active (depth > healedDepth) it applies a Qi/sec debuff (never zero —
    //     completability §6.3: the scarred state is the tuned baseline, §1.3).
    //   - a passive heal arc accrues; a full heal bar converts ONE depth to healedDepth,
    //     turning that depth's debuff into a permanent "Tempered by Ruin" Qi/sec buff.
    // -----------------------------------------------------------------------
    scar: {
        maxDepth: 3,                       // §10.9 depth ceiling (lean 3)
        debuffQiMultPerDepth: 0.88,        // active debuff = this^activeDepth: ~12%/depth Qi/sec down
                                           // (never zero — a scarred ascent stays completable, §6.3)
        healGoalPerDepth: 240,             // heal progress units per depth healed; arc scales with depth
        healRatePerSecond: 1,              // passive heal accrual/sec (the warm-the-core pattern)
        temperedQiMultPerDepth: 1.06       // permanent buff = this^healedDepth: ~6%/depth healed
                                           // ("Tempered by Ruin", §1.3: ruin endured becomes strength)
    }
};
