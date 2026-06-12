// js/data/body.js — single source of truth for the Body side layer (spec §3/§4/§6)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js. The Body
// layer is row:"side" and is NEVER doReset, so the permanent body tracks
// (meridians, tempering) and the stored grades (§6) survive every realm
// breakthrough by topology. All numbers are pass-1 ⟨tune⟩ values from the spec.
//
// BODY_DATA shape (consumed by makeBodyLayer):
//   id            string  TMT layer id for the Body layer ("b")
//   name/symbol/color/resource  display fields
//   qi            object  Qi/sec base + global factors read by getPointGen():
//                   baseRate          number  base Qi/sec (spec §2, =1 ⟨tune⟩)
//                   coreGradeStartKey string  starting Core Grade key ("none")
//   buyables      array   buyable rows (see buyable row shape below)
//   temperBuyableId  number  id (in buyables) of the Temper Body buyable; its
//                            tier crossings drive the per-tier milestones
//   temperTiers   array   ordered tier rows for tempering:
//                   { key, label, fromLevel, qiBonus } — qiBonus is the +5%
//                   immediate Qi/sec granted when this tier is first entered
//                   (§4b), applied via a milestone keyed on fromLevel.
//   grades        object  stored-grade slot config (§6), see GRADE SLOTS below.
//
// Buyable row shape (consumed by makeBuyable):
//   id            number  TMT buyable id (11, 12, 13 ...)
//   key           string  semantic key ("primaryMeridian","extraordinaryMeridian","temper")
//   title         string
//   resourceWord  string  word for the effect line ("Qi/sec")
//   costBase      number  cost of the 0th purchase
//   costRatio     number  cost ratio: cost(x) = costBase * costRatio^x
//   effectBase    number  per-level multiplicative effect: effect(x) = effectBase^x
//                         (a meridian at ×1.15 each, temper handled via tiers)
//   limit         number  purchaseLimit (caps purchasability — §4a/§4b)
//   unlock        object|null  unlock condition (meets()-style); null = always
//                         For Extraordinary Meridians: all primary open AND q 10th Level.
//
// GRADE SLOTS (§6): stored scalar grade indices on the Body layer's startData,
//   reset-immune because the Body layer is never doReset. The factory maps the
//   index back to a band/grade via REALM_DATA. startValue is the index BEFORE
//   any breakthrough/forge (no grade yet).
//   foundationGrade -> index into REALM_DATA f.grade.bands
//   coreGrade       -> index into REALM_DATA c.forge.grades, with a sentinel
//                      below the first real grade meaning "not yet forged".

var BODY_DATA = {
    id: "b",
    name: "Body",
    symbol: "Body",
    color: "#c97b5a",
    resource: "body refinement",

    qi: {
        // baseRate is the linear floor of Qi/sec (§2). Pass-2 tune: raised 1 -> 2
        // so the early grind (before meridians/realm mults compound) clears fast
        // enough to hit the §1 45-90 min target after the gradeScore blocker fix
        // removed the inadvertent 3.5x Heaven f-gain speedup (see pacing-sim.js).
        baseRate: 2,
        coreGradeStartIndex: -1   // -1 = no core forged yet (sentinel below Cracked)
    },

    // The two meridian buyables + the temper buyable (§4a/§4b).
    buyables: [
        {
            id: 11,
            key: "primaryMeridian",
            title: "Primary Meridian",
            resourceWord: "Qi/sec",
            costBase: 10,
            costRatio: 3,
            effectBase: 1.15,
            limit: 12,
            unlock: null
        },
        {
            id: 12,
            key: "extraordinaryMeridian",
            title: "Extraordinary Meridian",
            resourceWord: "Qi/sec",
            costBase: 5000,
            costRatio: 5,
            effectBase: 1.25,
            limit: 8,
            // Unlocks after all 12 primary open AND Qi Condensation 10th Level (§4a/§5a).
            // String stage label (resolves to best>=800), NOT numeric 10 — a numeric
            // token would gate at best>=10 (~3rd/4th Level), the same scale bug fixed
            // for f.unlock. Standardize realm gates on named stage labels (§5a).
            unlock: { primaryMeridiansAll: true, realm: ["q", "10th Level"] }
        },
        {
            id: 13,
            key: "temper",
            title: "Temper Body",
            resourceWord: "Foundation ceiling",
            costBase: 25,
            // costRatio pass-2 tune: 2.2 -> 1.7 so reaching Tendon (level 10, the
            // Core Formation gate §5c) isn't a Qi wall. At 2.2 the 10th temper level
            // alone cost ~30k cumulative; 1.7 keeps tempering a real choice, not a tax.
            costRatio: 1.7,
            // Temper's immediate Qi/sec payoff comes from the per-tier milestones
            // (§4b), not a per-level mult, so its per-level effectBase is neutral (1).
            effectBase: 1,
            limit: 24,
            unlock: null
        }
    ],

    temperBuyableId: 13,

    // Tiers derived from temper level (§4b). fromLevel = first level in the tier;
    // crossing into a tier grants a milestone worth +5% Qi/sec (qiBonus) and a
    // step up the Foundation Grade input. qiBonus is a multiplier (1.05 = +5%).
    temperTiers: [
        { key: "skin",   label: "Skin",   fromLevel: 1,  qiBonus: 1.05 },
        { key: "flesh",  label: "Flesh",  fromLevel: 5,  qiBonus: 1.05 },
        { key: "tendon", label: "Tendon", fromLevel: 10, qiBonus: 1.05 },
        { key: "bone",   label: "Bone",   fromLevel: 15, qiBonus: 1.05 },
        { key: "marrow", label: "Marrow", fromLevel: 20, qiBonus: 1.05 }
    ],

    // Stored, reset-immune grade slots (§6).
    grades: {
        foundationGrade: { startIndex: -1 },  // -1 = no Foundation breakthrough yet
        coreGrade: { startIndex: -1 }         // -1 = no core forged yet
    },

    // Chosen Soul Aspect (expansion §5 Nascent Soul "Soul Aspect"): stored LIFE-scoped
    // on this never-reset Body layer as player.b.soulAspect, exactly like the grade
    // slots above (the grade-storage precedent, §6). "" = unchosen; on the first
    // Nascent Soul breakthrough the player picks one aspect ONCE per life (no respec).
    // The key resolves to a REALM_DATA(n).soulAspect.aspects[] row; its effect is a
    // run-long passive identity multiplier folded into the Qi/Insight pipelines.
    soulAspect: { startKey: "" }
};
