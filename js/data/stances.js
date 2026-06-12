// js/data/stances.js — single source of truth for cultivation stances (design §6.1/§8.4)
//
// Plain-JS global, no ES export. Consumed by js/build/layerFactory.js (the dao layer's
// clickables + the stanceQiMult/stanceInsightMult readers). Stances are the game's
// self-imposed-difficulty grammar (§6.1): voluntary, toggleable global modifiers with an
// opportunity cost, "enterable and exitable freely" — zero new TMT primitives, just
// clickable toggles feeding the EXISTING multiplier pipeline (§6.1/§8.4 item 4). They
// introduce no resource and no reset; a stance only retunes the live multiplier product.
//
// STANCE_DATA shape (consumed by makeDaoLayer):
//   maxActive  number   how many stances may be active at once. 1 in slice 3, enforced
//                       STRUCTURALLY by the single player.dao.activeStance key slot —
//                       the toggle logic does not read this cap yet. When Void
//                       Refinement raises it in Act II ("walking the void between" two
//                       conflicting stances, §5/§6.1), the storage must become
//                       multi-slot and the toggle logic must actually consume maxActive.
//   stances    array    stance rows (see row shape below).
//
// Stance row shape (consumed by the dao layer's stance clickables + stanceXMult readers):
//   key         string  semantic stance key; the ACTIVE stance is stored as
//                       player.dao.activeStance (this key, or "" for none).
//   clickableId number  TMT clickable id on the dao layer (41, 42 — a row above the
//                       node buyables' id bands so the two never collide).
//   name        string  display name.
//   unlock      object  meets()-style condition (extended with daoNode for lattice gates).
//                       {} = always available (free with the dao layer).
//   modifiers   object  the global factors this stance applies WHILE ACTIVE:
//                         qiMult       multiply Qi/sec      (stanceQiMult)
//                         insightMult  multiply Insight/sec (stanceInsightMult)
//                       Every value > 0 (a stance may slow a resource, never zero it —
//                       completability §6.3); identity (1) for any factor omitted.
//
// STANCE SEMANTICS (pinned, §6.1): stances are FREE, COSTLESS, INSTANT toggles. Clicking
// an inactive stance activates it and (with maxActive 1) deactivates any other; clicking
// the active stance deactivates it. Every stance must TRADE — at least one modifier < 1
// AND at least one > 1 — so it is a real opportunity cost, never a pure free buff (and
// never a pure penalty). All modifiers > 0 keeps every objective completable (§6.3).

var STANCE_DATA = {
    // One active stance in slice 3 (§6.1); raised in Act II by Void Refinement (§5).
    maxActive: 1,
    stances: [
        {
            // Breathing Trance (§6.1 starter set): qi down, Insight up. Seeds the lattice
            // grammar early at near-zero cost (§3.1 table: Qi Condensation "first Stance").
            // Free with the dao layer (unlock {}). The trade: qiMult 0.7 (slow gathering ~30%)
            // for insightMult 2.0 — at base trickle this roughly DOUBLES effective Insight
            // (pacing intent: "Breathing Trance roughly doubles effective insight at meaningful
            // qi cost"). Both > 0, so qi is slowed, never zeroed (§6.3).
            key: "breathingTrance",
            clickableId: 41,
            name: "Breathing Trance",
            unlock: {},
            modifiers: { qiMult: 0.7, insightMult: 2.0 }
        },
        {
            // Sword Trance (§6.1 starter set): "everything down, sword-line Insight way up."
            // Unlocks once Sword Intent is glimpsed (daoNode ["sword", 1] = sword node tier >= 1).
            // The design's TARGETED sword-line Insight is DELIBERATELY simplified to GLOBAL
            // Insight for v1 — targeted line-insight (per-element Insight) arrives with the
            // deeper lattice tiers in Act II. The trade is steeper than Breathing Trance:
            // qiMult 0.4 (heavy qi cost) for insightMult 3.5 ("way up"). Both > 0 (§6.3).
            key: "swordTrance",
            clickableId: 42,
            name: "Sword Trance",
            unlock: { daoNode: ["sword", 1] },
            modifiers: { qiMult: 0.4, insightMult: 3.5 }
        }
    ]
};
