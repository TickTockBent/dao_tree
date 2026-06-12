// js/data/realms.js — single source of truth for the realm chain (spec §5)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js via an
// addLayer loop. EVERY tunable number for the realm spine lives here so that
// tuning edits data, never code. All values are pass-1 ⟨tune⟩ figures from the
// authoritative spec (docs/internal/early-game-spec-v0.1.2.md §5/§6/§7).
//
// Row shape (consumed by makeRealmLayer):
//   id          string   TMT layer id ("q","f","c")
//   row         number   tree row (Qi Condensation 0, Foundation 1, Core 2)
//   name        string   display name
//   symbol      string   node glyph
//   color       string   node / tab colour
//   resource    string   prestige currency display name
//   reqBase     number   Qi required for the first breakthrough
//   gainExp     number   prestige gain exponent: gain = (Qi / reqBase)^gainExp
//   unlock      object   unlock condition (see meets() in the factory):
//                          { qi:N }                  Qi gathered >= N
//                          { realm:[id, atOrStage] } realm id at sub-stage
//                                                    (number = best>=N,
//                                                     string = named stage label)
//                          { meridians:N }           primary meridians opened >= N
//                          { temperTier:"name" }     temper tier reached
//                        keys combine with AND.
//   substages   array    ordered sub-stage rows, each:
//                          { label:string, at:number, qiMult:number }
//                          done when player[id].best.gte(at); qiMult contributes
//                          to the realm multiplier on Qi/sec (no dead mult §9.2).
//   reveals     object   optional cross-system reveal markers keyed off a
//                        sub-stage label, e.g. { "10th Level":"extraordinary" }.
//   graded      bool     optional — breakthrough is graded (Foundation §6).
//   forge       object   optional — Core forge config (§7), see FORGE below.
//   soulAspect  object   optional — Nascent Soul aspect set-piece (expansion §5),
//                        see SOUL ASPECT below.
//
// graded realms additionally carry a gradeBands table (§6) and forge realms a
// forge table (§7). Those drive later phases; they are present now as data so
// the schema is fixed and the linter can see them.
//
// SOUL ASPECT (expansion §5 Nascent Soul "Soul Aspect"; progression-map §2 "the
// soul gains independence"): the Nascent Soul realm carries a soulAspect set-piece
// config on its realm row EXACTLY as Core Formation carries `forge` — one
// parameterized augmentation in the factory keyed on realmData.soulAspect, no
// per-realm hand assembly (the forge-doc precedent). On the first Nascent Soul
// breakthrough the soul "takes a form": the player picks ONE aspect, ONCE per life
// (no respec), stored LIFE-scoped on the Body layer as player.b.soulAspect (the
// grade-storage precedent §6 — survives every realm reset). The chosen aspect is a
// run-long passive identity multiplier folded into the Qi and Insight pipelines
// (soulAspectQiMult / soulAspectInsightMult — no dead mult §9.2).
//
//   soulAspect.aspects[] rows (consumed by makeRealmLayer's aspect augmentation):
//     key      string  semantic aspect key; the chosen one is stored as
//                      player.b.soulAspect ("" = unchosen).
//     label    string  display name.
//     element  string|null  the spiritual-root element this aspect embodies, or
//                      null for the always-available Formless aspect.
//     requires object  meets()-style gate (the daoElementTier grammar): an element
//                      aspect needs a HELD SEED of that element in the Dao lattice.
//                      {} (Formless) is always met — the completability FLOOR so
//                      Nascent Soul can NEVER be aspect-blocked (the always-available
//                      Formless aspect, lint-enforced).
//     effect   object  { qiMult?, insightMult? } the run-long identity multipliers,
//                      every value >= 1 (a pure passive identity, never a penalty).
//                      Folded into cultivationQiPerSecond / insightPerSecond via the
//                      soulAspectQiMult / soulAspectInsightMult readers. Formless is
//                      the small both-stats generalist; each element aspect is a
//                      larger single-stat identity: water/metal-sword lean insightMult
//                      (the §4.2 sword/flow Insight lines), wood/fire/earth lean qiMult.

var REALM_DATA = [
    {
        id: "q",
        row: 0,
        name: "Qi Condensation",
        symbol: "Qi",
        color: "#5fc9e0",
        resource: "qi condensation",
        // Pass-2 tune (pacing, §1): reqBase 50 -> 20 and gainExp 0.5 -> 0.6 so q.best
        // climbs to 6th Level (at:90) fast enough that Foundation unlocks in ~30 min,
        // not ~255 (see js/build/pacing-sim.js). Unlock stays at 50 Qi (> reqBase).
        reqBase: 20,
        gainExp: 0.6,
        unlock: { qi: 50 },
        substages: [
            { label: "1st Level",  at: 1,   qiMult: 1.10 },
            { label: "2nd Level",  at: 3,   qiMult: 1.10 },
            { label: "3rd Level",  at: 8,   qiMult: 1.10 },
            { label: "4th Level",  at: 20,  qiMult: 1.12 },
            { label: "5th Level",  at: 45,  qiMult: 1.12 },
            { label: "6th Level",  at: 90,  qiMult: 1.12 },
            { label: "7th Level",  at: 170, qiMult: 1.15 },
            { label: "8th Level",  at: 300, qiMult: 1.15 },
            { label: "9th Level",  at: 500, qiMult: 1.15 },
            { label: "10th Level", at: 800, qiMult: 1.18 },
            { label: "11th Level", at: 1250, qiMult: 1.18 },
            { label: "12th Level", at: 1900, qiMult: 1.18 },
            { label: "13th Level", at: 2800, qiMult: 1.20 }
        ],
        // 6th Level reveals Foundation; 10th Level unlocks Extraordinary Meridians (§5a).
        reveals: { "6th Level": "foundation", "10th Level": "extraordinary" }
    },
    {
        id: "f",
        row: 1,
        name: "Foundation Establishment",
        symbol: "Fnd",
        color: "#d8b25a",
        resource: "foundation",
        // Pass-2 tune (pacing, §1): reqBase 5000 -> 1000 and gainExp 0.5 -> 0.6 so
        // f.best reaches Great Circle (at:45) in a few-million-Qi budget rather than
        // ~10M. This also offsets the f-gain slowdown from fixing the gradeScore
        // blocker (which removed the inadvertent Heaven 3.5x). See pacing-sim.js.
        reqBase: 1000,
        gainExp: 0.6,
        // §5b: unlock at Qi Condensation 6th Level (best>=90) AND >=4 meridians.
        // String stage label (resolved via substageThreshold) — NOT a numeric token,
        // which would gate at best>=6 (~3rd Level region) and let Foundation unlock
        // before its "6th Level reveals Foundation" coupling fires (§5a).
        reveal: { realm: ["q", "6th Level"] }, // §5a: 6th Level reveals the node
        unlock: { realm: ["q", "6th Level"], meridians: 4 },
        substages: [
            { label: "Early Foundation", at: 1,  qiMult: 1.25 },
            { label: "Mid Foundation",   at: 4,  qiMult: 1.25 },
            { label: "Late Foundation",  at: 10, qiMult: 1.30 },
            { label: "Peak Foundation",  at: 22, qiMult: 1.30 },
            { label: "Great Circle",     at: 45, qiMult: 1.40 }
        ],
        // Great Circle gates Core Formation (§5b/§5c).
        reveals: { "Great Circle": "core" },
        graded: true,
        // Foundation Grade (§6): computed once at breakthrough, stored on Body
        // layer. weights sum to 1.0; meridian/temper/realm denominators below
        // are the saturation points the gradeScore formula divides by.
        grade: {
            weightMeridian: 0.40,
            weightTemper: 0.40,
            weightRealm: 0.20,
            meridianDenominator: 12,   // primary meridian cap (§4a)
            temperDenominator: 20,     // temper saturates at Marrow entry (§4b/§6)
            // realmDenominator is a SUB-STAGE COUNT, not a q.best currency value:
            // the realm term is realmReachedSubstageCount(q) / 6, where 6 = the
            // number of q sub-stages to reach 6th Level (the Foundation gate). The
            // factory divides the count of reached sub-stages (a small ~6 index) by
            // this — NOT raw q.best — so the realm term tops out at its 0.20 weight
            // and cannot alone saturate the whole gradeScore (blocker fix, §6/§9.2).
            realmDenominator: 6,
            // gradeScore band -> { tier label, f-gain mult, core ceiling key,
            //                      baseCore key }.
            // floor is the inclusive lower bound on gradeScore.
            //
            // baseCore (§7a, the previously-open item — now pinned as data) is the
            // STARTING Core grade the forge produces before any push offset, mapped
            // from the Foundation Grade that fed it:
            //   Flawed       -> Cracked   (floor; a sloppy foundation births a flawed core)
            //   Stable       -> Lower
            //   Solid        -> Middle
            //   Heaven-grade -> Upper
            // coreCeiling is the hard cap a foundation of this grade can ever reach
            // (push offset + refinement both clamp to it). The push offset is +0/+1/+2
            // (Steady/Forceful/Reckless), so each band's baseCore + the max +2 Reckless
            // offset exactly reaches that band's coreCeiling — i.e. a Heaven-grade
            // foundation (baseCore Upper) can push to Perfect, and every weaker band can
            // push to its own ceiling. Refinement (§7b) is the slow route to the same cap.
            // Keys reference REALM_DATA(c).forge.grades[].key; the factory resolves a key
            // to its ceilingIndex (the ordered ladder position) — no numeric grades here.
            bands: [
                { floor: 0.00, tier: "Flawed",       fMult: 1.0, coreCeiling: "lower",   baseCore: "cracked" },
                { floor: 0.35, tier: "Stable",       fMult: 1.5, coreCeiling: "middle",  baseCore: "lower"   },
                { floor: 0.60, tier: "Solid",        fMult: 2.2, coreCeiling: "upper",   baseCore: "middle"  },
                { floor: 0.85, tier: "Heaven-grade", fMult: 3.5, coreCeiling: "perfect", baseCore: "upper"   }
            ]
        }
    },
    {
        id: "c",
        row: 2,
        name: "Core Formation",
        symbol: "Core",
        color: "#e0a33a",
        resource: "core formation",
        reqBase: 250000,
        gainExp: 0.5,
        reveal: { realm: ["f", "Great Circle"] }, // §5a: Great Circle reveals the node
        unlock: { realm: ["f", "Great Circle"], temperTier: "Tendon" },
        substages: [
            { label: "Core Forged",   at: 1, qiMult: 1.50 },
            { label: "Core Refined",  at: 2, qiMult: 1.75 },
            { label: "Core Tempered", at: 3, qiMult: 2.00 }
        ],
        // One-time forge (§7a) then a refinement loop (§7b) — never a repeatable
        // prestige (§5c). All forge/refinement tuning + UI dimensions live here as
        // data so the factory/layer code stays literal-free (§11).
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
        }
    },
    {
        id: "n",
        row: 3,
        name: "Nascent Soul",
        symbol: "Soul",
        color: "#b486e0",   // amethyst — the soul's hue, distinct from Core gold
        resource: "nascent soul",
        // Pacing (expansion §5 / §11 slice 4): NS should OPEN ~30-60 min after the
        // first core for an active player. Post-core Qi/sec runs well into the
        // hundreds/thousands (baseRate 2 x meridianMult ~32 at full meridians x
        // temperMult ~1.28 x realmMult [q full + f Great Circle + c Core Forged] x
        // coreGradeMult [>=2x Cracked, up to 8x] x gateMult 1.25). reqBase 5,000,000
        // with gainExp 0.5 puts the first NS breakthrough roughly that window past a
        // forged core that has also climbed c to Core Refined (the unlock gate). The
        // 7 sub-stages then span a multi-hour climb (their `at` ladder geometrically
        // outruns a single realm's gain, like the q/f/c spines). All ⟨tune⟩.
        reqBase: 5000000,
        gainExp: 0.5,
        // §1.6/§5a: reveal the mountain EARLY — the Nascent Soul node appears the
        // moment the core is forged (Core Forged sub-stage), so the next peak is
        // visible while still locked. The breakthrough itself gates higher: the
        // player must first REFINE the core (Core Refined sub-stage, c.best >= 2)
        // before Nascent Soul unlocks — the carried-artifact core must mature first
        // (progression-map §5 "core as carried artifact").
        reveal: { realm: ["c", "Core Forged"] },
        unlock: { realm: ["c", "Core Refined"] },
        substages: [
            // 7 sub-stages (progression-map §2: Early/Mid/Late/Peak, then Great
            // Circle / Apex / Perfected). qiMults climb steeply (the soul's
            // independence compounds gathering) — each feeds realmMult (no dead
            // mult §9.2). ats are a geometric ladder so the climb is multi-hour.
            { label: "Early Nascent Soul", at: 1,    qiMult: 1.60 },
            { label: "Mid Nascent Soul",   at: 4,    qiMult: 1.70 },
            { label: "Late Nascent Soul",  at: 12,   qiMult: 1.80 },
            { label: "Peak Nascent Soul",  at: 30,   qiMult: 1.90 },
            { label: "Great Circle",       at: 75,   qiMult: 2.10 },
            { label: "Apex",               at: 175,  qiMult: 2.30 },
            { label: "Perfected",          at: 400,  qiMult: 2.60 }
        ],
        // Soul Aspect set-piece (expansion §5; SOUL ASPECT in the header). The soul
        // "takes a form" on first breakthrough: pick ONE aspect, ONCE per life. The
        // Formless aspect is ALWAYS available (requires {}) — the completability
        // floor so NS is never aspect-blocked even on a save with no Dao Seeds. Each
        // element aspect needs a HELD SEED (tier 2) of its element in the Dao lattice
        // (daoElementTier grammar). All effects >= 1 (a passive identity, never a
        // penalty); values ⟨tune⟩ per the pinned sizes.
        soulAspect: {
            aspects: [
                // Formless — the generalist floor. Small bonus to BOTH stats; always
                // pickable (requires {}), so a player with no element Seed can still
                // give the soul a form and progress (lint-enforced floor).
                { key: "formless", label: "Formless Soul", element: null, requires: {},
                  effect: { qiMult: 1.20, insightMult: 1.20 } },
                // Metal (Sword) — the §4.2 sword line is an Insight engine; lean insightMult.
                { key: "metalSoul", label: "Sword Soul", element: "metal",
                  requires: { daoElementTier: ["metal", 2] },
                  effect: { insightMult: 1.50 } },
                // Wood — vitality of the living world; lean qiMult.
                { key: "woodSoul", label: "Verdant Soul", element: "wood",
                  requires: { daoElementTier: ["wood", 2] },
                  effect: { qiMult: 1.45 } },
                // Water (Flow) — the §4.2 flow line leans Insight; lean insightMult.
                { key: "waterSoul", label: "Flowing Soul", element: "water",
                  requires: { daoElementTier: ["water", 2] },
                  effect: { insightMult: 1.50 } },
                // Fire (Life) — feeds the body's gathering; lean qiMult.
                { key: "fireSoul", label: "Blazing Soul", element: "fire",
                  requires: { daoElementTier: ["fire", 2] },
                  effect: { qiMult: 1.50 } },
                // Earth (Mountain) — immovable foundation; lean qiMult.
                { key: "earthSoul", label: "Mountain Soul", element: "earth",
                  requires: { daoElementTier: ["earth", 2] },
                  effect: { qiMult: 1.45 } }
            ]
        }
    }
];
