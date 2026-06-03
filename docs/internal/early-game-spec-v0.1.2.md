# Early Game Spec — v0.1 "Mortal to Golden Core"

*Implementation-grade detail for the first playable slice. Companion to `cultivation-progression-map.md`. Target: an agentic workflow builds this on a clean TMT fork.*

**Rev 0.1.1** — incorporates technical review against TMT docs. Changes: §8 checkpoint reframed onto existing achievement + unlock-condition primitives; grade storage moved to the reset-immune Body layer (§6); Extraordinary Meridian unlock naming fixed (§4a); forge "push" semantics pinned to discrete options (§7a); temper-grade saturation handled by capping purchasability, not the curve (§4b/§6); impurity-flush consumable recorded as a conscious cut (§4a); new §11 specs the config→layer factory (the critical-path keystone).

**Rev 0.1.2** — locks the §11 loading mechanism. The 0.1.1 sample contradicted its own "no build step" decision (it showed `.ts` + ES `export`, which TMT's plain `<script src>` loader — no bundler, no modules, verified against `index.html` — cannot consume). Resolved to **option (a): no build step, plain-`.js` data tables as globals, loaded via `<script>` tags and consumed by an `addLayer` loop.** §11 rewritten accordingly; the rest of the spec is unchanged.

> **How to read this.** Every number tagged `⟨tune⟩` is a pass-1 starting value — they exist so the agent builds working math and so tuning edits *data*, not code. Every mechanic notes its **TMT primitive**. §10 lists decisions still open; §11 is the keystone build-step-1.

---

## 1. Scope

**In:** four realms — Body Tempering, Qi Condensation, Foundation Establishment, Core Formation — plus the early decision economy and the Core forge climax.
**Out (parked upstairs):** Nascent Soul+, Domain/Heavenly Concept, Professions, sect war.
**Demo-complete beat:** forging your first Golden Core of any grade.
**Pacing target:** 45–90 min to first core ⟨tune⟩.

---

## 2. Resources

| Resource | TMT mapping | Notes |
|----------|-------------|-------|
| **Qi** | base `points` | Passively gathered. The one spendable currency in v0.1 — everything competes for it. |
| **Cultivation** (per realm) | `q.points`, `f.points`, `c.points` | Realm progress; gained by breaking through (prestige). |
| **Foundation Grade** | stored on **Body side layer** (§6) | Set once at Foundation breakthrough. Caps Core Grade. Reset-immune. |
| **Core Grade** | stored on **Body side layer** (§6) | Set at the forge (§7). Global multiplier; the demo's payoff. Reset-immune. |

Qi/sec = `baseRate × meridianMult × temperMult × realmMult × upgradeMult`. baseRate = 1 ⟨tune⟩.

---

## 3. The decision economy (the heart of v0.1)

Three sinks compete for every Qi gathered — the tension flat incrementals and the reference lack. None strictly dominates; each pays off on a different axis and timescale.

| Sink | Pays off as | Timescale | Persists across breakthrough? |
|------|-------------|-----------|-------------------------------|
| **Open a meridian** | Faster Qi gathering (compounds) | Immediate, compounding | **Yes** — physical, permanent |
| **Temper the body** | Foundation/Core Grade ceiling (+ small immediate Qi bonus) | Mostly deferred to breakthrough | **Yes** — physical, permanent |
| **Bank toward breakthrough** | Realm multiplier + next tier unlocks | On breakthrough | n/a (it *is* the breakthrough) |

**Keystone architecture (verified against TMT docs).** Meridians, tempering, and the grades they produce are permanent body attributes — they must **not** reset on realm breakthrough. They live on a `row: "side"` **Body** layer, which TMT excludes from the row-cascade ("side layers are not affected by resets unless you add a doReset to them"). Realm prestiges (q→f→c) reset only the realm chain below them. The Body layer is never reset in v0.1.

---

## 4. The Body layer `row: "side"`

Holds the two permanent tracks **and** the stored grades (§6). Unlocks at game start.

### 4a. Meridians — TMT `buyable` (two buyables, capped)

- **Primary Meridians** — `purchaseLimit: 12`. Cost of Nth = `10 × 3^N` Qi ⟨tune⟩. Effect: each ×1.15 to Qi/sec ⟨tune⟩ (12 → ≈5.4×).
- **Extraordinary Meridians** — `purchaseLimit: 8`, unlocked after **all 12 primary open AND Qi Condensation 10th Level**. Cost of Nth = `5000 × 5^N` Qi ⟨tune⟩. Effect: each ×1.25 to Qi/sec ⟨tune⟩ (8 → ≈6×).
- *Conscious cut:* the map's "impurity-flush consumable" cost is **dropped for v0.1** — meridians cost Qi only, consistent with the single-currency economy and deferring Qi Purity (§10.1). Reintroduce alongside purity if/when Act II wants it.
- *No-dead-multiplier:* meridian mult applies to always-on Qi gathering. ✔

### 4b. Body Tempering — TMT `buyable` (single, → tiers)

- **Temper Body** — `purchaseLimit: 24` for v0.1 ⟨tune⟩ (a few levels into Marrow, then *no more offered* — prevents the over-temper trap where Qi buys grade-irrelevant levels; reopened in Act II).
- Cost of level N = `25 × 2.2^N` Qi ⟨tune⟩.
- **Tiers** (derived): Skin 1–4 · Flesh 5–9 · Tendon 10–14 · Bone 15–19 · Marrow 20–24. Each new tier = a `milestone` granting **+5% Qi/sec** (immediate payoff, so tempering isn't purely deferred) **and** a step up the Foundation Grade input.
- *No-dead-multiplier:* per-tier +5% immediate; grade contribution pays at breakthrough. ✔

---

## 5. The realm chain (prestige spine)

Three stacked prestige layers; each resets the one below for a permanent multiplier (genre- and TMT-idiomatic). Sub-stages = `milestones` at `best` thresholds.

### 5a. Qi Condensation `q` (row 0)
- **Unlock:** 50 Qi gathered ⟨tune⟩.
- **Breakthrough:** prestige Qi → q. Gain = `(Qi / req)^0.5` ⟨tune⟩, req = 50.
- **Sub-stages (`q.best`):** 1st…13th Level at `1, 3, 8, 20, 45, …` ⟨tune⟩. 6th Level reveals Foundation; **10th Level unlocks Extraordinary Meridians.**

### 5b. Foundation Establishment `f` (row 1)
- **Unlock:** Qi Condensation 6th Level AND ≥4 meridians open ⟨tune⟩.
- **Breakthrough is GRADED** — see §6.
- **Sub-stages:** Early/Mid/Late/Peak/Great Circle on `f.best`. Great Circle gates Core Formation.

### 5c. Core Formation `c` (row 2)
- **Unlock:** Foundation Great Circle AND tempering tier ≥ Tendon ⟨tune⟩.
- One-time **forge** then a **refinement** loop, never a repeatable prestige (so it triggers no reset cascade). See §7.

---

## 6. Foundation Grade — the coupling

Computed **once** at the Foundation breakthrough, then **stored on the Body side layer** and added to that layer's `keep` array — so it is reset-immune by design, not by current topology (this matters the moment Act II adds a higher cascading layer; storing on `f` would let a future reset wipe it).

```
gradeScore = clamp(
    0.40 × (meridiansOpened / 12)
  + 0.40 × min(temperLevel, 20) / 20
  + 0.20 × (q.best / qBestRequiredForFoundation),
  0, 1)                                            ⟨tune weights⟩
```

The temper term saturates at level 20 (Marrow entry) **by design** — the body is fully tempered for early-game purposes; this is *why* §4b caps purchasability near there, so no Qi is wasted chasing grade past the cap. (Act II can swap to a softer uncapped curve when it reopens tempering.)

| gradeScore | Foundation Grade | f-gain multiplier | Core Grade ceiling |
|-----------|------------------|-------------------|--------------------|
| < 0.35 | **Flawed** | ×1.0 | Lower |
| 0.35–0.60 | **Stable** | ×1.5 | Middle |
| 0.60–0.85 | **Solid** | ×2.2 | Upper |
| ≥ 0.85 | **Heaven-grade** | ×3.5 | **Perfect** |

*Intent:* rush → fast but Flawed → low core ceiling, felt at the §7 climax. Invest → Heaven-grade → shot at Perfect. Both valid; the tension is the game.

---

## 7. The Core forge + refinement (the climax)

### 7a. Forge — one-time action (TMT `clickable` + modal)
- **Requirement:** Core Formation unlock (§5c) + forge fuel `f.points ≥ forgeReq` ⟨tune⟩.
- **The push — three discrete options** (resolves the earlier unit ambiguity: fuel cost, grade offset, and crack chance are *separate* quantities, not one "×N" value):

  | Option | Fuel spent | Grade offset | Crack chance |
  |--------|-----------|--------------|--------------|
  | **Steady** | 1× | +0 | 0% |
  | **Forceful** | 2× | +1 | 15% ⟨tune⟩ |
  | **Reckless** | 3× | +2 | 35% ⟨tune⟩ |

- **Outcome:** `finalGrade = min( baseGrade + offset (minus 1 tier on a crack roll), foundationCeiling )`. A crack drops **one** tier; **never destroyed, never a hard wall** (invariant §9.3). Cracked is the floor.
- **Grades:** Cracked → Lower → Middle → Upper → **Perfect**. Each = global Qi/sec + cultivation multiplier (Cracked ×2 … Perfect ×8 ⟨tune⟩). Stored on the Body layer (§6).

### 7b. Refinement — slow safe route (TMT `buyable`, time-gated)
- Post-forge, "Warm the Core" accrues refinement progress; a full bar raises grade one tier, **capped at the Foundation ceiling**.
- Forge-push = fast/risky path to the ceiling; refinement = slow/safe path. Both reach the same cap, so the cautious player has a route without making the gamble pointless.

**Forging any core = v0.1 complete.** Grade is the optimization/replay hook.

---

## 8. Story gates — existing primitives, not a new one

Story gates need exactly two behaviors, and TMT already has a primitive for each. No new persistence is built.

- **Fire-once, read live state, grant a permanent buff** → a TMT **achievement** (`done()` reads state; `effect()` grants; permanent; global; never reset). This *is* the "reset-free checkpoint" — recognized, not rebuilt.
- **Block a later breakthrough until passed** (only if a gate must wall progression) → an **unlock condition** on the next layer that reads `hasAchievement(...)`. The achievement records; the unlock condition gates.

**Outer Disciple (the v0.1 proof):** an achievement. `done = reached Foundation (any grade) AND meridians ≥ 6 AND temperTier ≥ Flesh` ⟨tune⟩; `effect = +25% Qi/sec` ⟨tune⟩ + flavor (sect stipend). Reads live cross-layer state, grants a global buff, resets nothing — the correct rebuttal to the reference's reset-based gate, built from stock parts.

**Data discipline:** story-gate achievements carry `kind: "checkpoint"` in the data table so the linter and we distinguish narrative gates from optional buffs — the design rule ("story gates are never challenges") lives as a data category, not as a parallel component.

---

## 9. Invariant compliance (the agent must preserve these)

1. **Story gates ≠ challenges.** Gates are achievements + unlock conditions (§8). No story content uses the reset-based challenge primitive in v0.1.
2. **No dead multipliers.** Every multiplier is observable without its source in a reachable state (meridian/realm mults on always-on gathering; tempering's per-tier +5% immediate; grade mults after a kept breakthrough). Linter asserts over the data table.
3. **Completability.** No gate requires the resource it suppresses; the forge can never hard-fail (crack floors one grade down). Linter asserts every unlock condition is reachable from a fresh save under current modifiers.
4. **Balance as data.** All `⟨tune⟩` values, cost curves, thresholds, grade bands, and gate conditions live in one typed config the layers are *generated from* (§11) — tuning and linting both operate on data, never code.

---

## 10. Decisions to lock (open, recommended defaults)

1. **Qi Purity as a 4th lever?** **Defer.** Keep the clean 3-sink economy; treat purity as implicit in gradeScore. (Also keeps the impurity-flush consumable cut, §4a.)
2. **Meridians: two buyables vs. visual grid.** **Two buyables for v0.1** (TMT `grid` exists for the meridian-map polish later).
3. **Does Qi Condensation reset on Foundation breakthrough?** **Yes** — standard prestige; the Body layer protects what shouldn't reset.
4. **Forge push: slider vs discrete.** **Discrete** (Steady/Forceful/Reckless) — clearer stakes; also pins the push semantics (§7a).
5. **Pacing target.** 45–90 min to first core; tune cost-curve bases in config, not formulas.

---

## 11. The config→layer factory — build-step-1 (keystone) [NEW]

Everything else (linter, knobs A/B, "tuning edits data") assumes this exists. TMT layers are hand-authored JS objects with no scaffolding for data-generation, so this is real net-new work and the critical-path risk — if it slips, we silently fall back to balance-in-code, the exact reference failure. **Build and prove it before any realm content.**

**Decision (locked, rev 0.1.2): option (a) — runtime data-factory, no build step, plain JavaScript.** Verified against the fork: `index.html` loads everything through bare `<script src="…js">` tags — no bundler, no `type="module"`, no TypeScript (Vue is a CDN script). So **no `.ts`, no ES `export`** — those require a compile/module step this project deliberately does not have. Data tables are plain `.js` files that assign **globals**; the factory iterates them and calls `addLayer(...)` at load. (`addLayer(layerName, layerData)` is TMT's documented cross-file layer-registration entry point — `js/technical/layerSupport.js:214`, the same call the bundled Demo uses.)

**Hard rule: zero numeric literals in layer/factory code — every number resolves from a data row.** Enforced as a load-time assertion in the factory (and optionally an ESLint rule); no TypeScript needed for this.

```js
// js/data/realms.js — single source of truth (plain JS global, no export)
var REALM_DATA = [
  { id:"q", row:0, name:"Qi Condensation", reqBase:50, gainExp:0.5,
    unlock:{ qi:50 },
    substages:[ {label:"1st Level", at:1, qiMult:1.10}, /* … */ ] },
  { id:"f", row:1, name:"Foundation Establishment", reqBase:/*…*/,
    unlock:{ realm:["q",6], meridians:4 }, graded:true /* → §6 */ },
  { id:"c", row:2, name:"Core Formation",
    unlock:{ realm:["f","greatCircle"], temperTier:"tendon" }, forge:/* §7 */ },
]

// js/build/layerFactory.js — generic, parameterized, no magic numbers
REALM_DATA.forEach(function(r){ addLayer(r.id, makeRealmLayer(r)) })
// makeRealmLayer(r) → { row:r.row, requires(){ return new Decimal(r.reqBase) },
//   milestones: makeMilestones(r.substages), unlocked(){ return meets(r.unlock) }, … }
```

Sibling data tables — `BODY_DATA` (meridian/temper buyables + the Body side layer) and `GATE_DATA` (story-gate achievements, §8) — are consumed by the same pattern, each in its own `js/data/*.js` global.

**Load order (matters — this is the one integration point to get right).** Add the new scripts to `index.html` **after** `break_eternity.js` and `layerSupport.js` (the factory needs `Decimal`/`D()` and `addLayer` to exist) and **before** the tree/loader builds, e.g.:

```html
<script src="js/technical/break_eternity.js"></script>
<script src="js/technical/layerSupport.js"></script>
<!-- NEW: data tables, then the factory that registers layers -->
<script src="js/data/realms.js"></script>
<script src="js/data/body.js"></script>
<script src="js/data/gates.js"></script>
<script src="js/build/layerFactory.js"></script>
<!-- …existing mod.js / loader.js / game.js … -->
```

The **linter** (§9) runs over all tables at load, before `addLayer`: no-dead-multiplier, completability, and "no numeric literal in generated code." A failed assertion should hard-stop load with a clear console error rather than silently shipping a broken economy.

*(Codegen — emitting `.js`/`.ts` from the tables ahead of time — was rejected: it adds a build step the project doesn't have, for static analysis the load-time linter already covers. Revisit only if future tooling genuinely needs it.)*
