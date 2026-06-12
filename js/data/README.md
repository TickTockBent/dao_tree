# `js/data/` — the single source of truth (spec §11)

Plain-JS data tables (no `.ts`, no ES `export`) that the layer factory in
`js/build/` consumes at load via an `addLayer` loop. Every tunable number in
the early game lives here, not in layer/factory code (the "zero numeric
literals in generated code" rule). See `docs/internal/early-game-spec-v0.1.2.md`.

- `realms.js` — `REALM_DATA` (Qi Condensation `q`, Foundation `f`, Core Formation `c`)
- `body.js`  — `BODY_DATA` (meridian + tempering buyables, the `row:"side"` Body layer, stored grades)
- `gates.js` — `GATE_DATA` (story-gate achievements, e.g. Outer Disciple)
- `trees.js` — `TREE_DATA` (persistence scopes tree/life/eternal + tree membership; the factory compiles each layer's `doReset` from it — design doc §8.1)
- `keep-rules.js` — `KEEP_RULES` (milestone-gated keys that survive a prestige — design doc §1.2/§8.2)
- `hints.js` — `HINT_DATA` (guidance cascade, first match wins, unconditional catch-all last — design doc §1.5)
- `lattice.js` — `LATTICE_DATA` (the Dao lattice: 15 elemental nodes with Glimpse/Seed tiers, Insight currency, declared conflicts — design doc §4.2/§8.7)
- `stances.js` — `STANCE_DATA` (voluntary toggleable challenge stances with opportunity cost — design doc §6.1/§8.4)
