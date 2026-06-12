# `js/data/` — the single source of truth (spec §11)

Plain-JS data tables (no `.ts`, no ES `export`) that the layer factory in
`js/build/` consumes at load via an `addLayer` loop. Every tunable number in
the early game lives here, not in layer/factory code (the "zero numeric
literals in generated code" rule). See `docs/internal/early-game-spec-v0.1.2.md`.

- `realms.js` — `REALM_DATA` (Qi Condensation `q`, Foundation `f`, Core Formation `c`, Nascent Soul `n`, Soul Formation `s`); note: the Core Formation forge config was moved to `setpieces.js` (SETPIECE_DATA.forge) in slice 6 — the factory's `coreForgeData()` now reads from there as a compatibility accessor
- `setpieces.js` — `SETPIECE_DATA` (set-piece configs: instance 1 = the Forge, verbatim from former `realms.js` c row; instance 2 = firstTribulation, the Act I capstone set-piece; plus the shared scar table — design §8.3/§6.2)
- `legacy.js` — `LEGACY_DATA` (the eternal Act I Legacy Grade store: weighted score from core grade, soul aspect, Dao Seeds, sect standing, and tribulation grade → one of four evocative bands with a live qiMult consumer — design §5/§8.1 eternal scope)
- `body.js`  — `BODY_DATA` (meridian + tempering buyables, the `row:"side"` Body layer, stored grades including `soulAspect`)
- `gates.js` — `GATE_DATA` (story-gate achievements, e.g. Outer Disciple)
- `trees.js` — `TREE_DATA` (persistence scopes tree/life/eternal + tree membership; the factory compiles each layer's `doReset` from it — design doc §8.1)
- `keep-rules.js` — `KEEP_RULES` (milestone-gated keys that survive a prestige — design doc §1.2/§8.2)
- `hints.js` — `HINT_DATA` (guidance cascade, first match wins, unconditional catch-all last — design doc §1.5)
- `lattice.js` — `LATTICE_DATA` (the Dao lattice: 15 elemental nodes with Glimpse/Seed tiers, Insight currency, declared conflicts — design doc §4.2/§8.7)
- `stances.js` — `STANCE_DATA` (voluntary toggleable challenge stances with opportunity cost — design doc §6.1/§8.4)
- `automation.js` — `AUTOMATION_DATA` (milestone-gated automation grants; Tier 1 granted by the Nascent Soul first sub-stage — design doc §1.7/§7.5)
- `sect.js` — `SECT_DATA` (Sect v1: LIFE-scoped side layer; two archetypes with lattice discounts; Contribution economy; milestones granting stipend/library/arsenal — design doc §4.3)
- `techniques.js` — `TECHNIQUE_DATA` (permanent arts library; school/universal techniques purchased with Contribution; tier-2 rows gated on the library milestone — design doc §4.3/§8.1)
- `journal.js` — `JOURNAL_DATA` (narrative journal; ETERNAL-scoped side layer; entries latch once their when condition is met and survive reincarnation — design doc §1.6/§8.1)
