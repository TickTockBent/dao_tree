# `js/data/` — the single source of truth (spec §11)

Plain-JS data tables (no `.ts`, no ES `export`) that the layer factory in
`js/build/` consumes at load via an `addLayer` loop. Every tunable number in
the early game lives here, not in layer/factory code (the "zero numeric
literals in generated code" rule). See `docs/internal/early-game-spec-v0.1.2.md`.

- `realms.js` — `REALM_DATA` (Qi Condensation `q`, Foundation `f`, Core Formation `c`)
- `body.js`  — `BODY_DATA` (meridian + tempering buyables, the `row:"side"` Body layer, stored grades)
- `gates.js` — `GATE_DATA` (story-gate achievements, e.g. Outer Disciple)
