# Dao Tree

A xianxia cultivation incremental game. Built with Vite + TypeScript + Vue 3 + Pinia.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run test     # run all tests (166 tests)
npm run lint     # typecheck + eslint
npm run sim      # run pacing simulation
```

## Architecture

- **Engine** (`src/engine/`): pure functions — `meets()` condition DSL, `format()`, save system, `buildGameState()`, `doReset` cascade.
- **Data** (`src/data/`): 15 typed tables — single source of truth for all game numbers.
- **Stores** (`src/stores/`): idiomatic Pinia stores per system — `game`, `realm`, `body`, `dao`, `sect`, `forge`, `tribulation`, `scar`, `legacy`, `journal`, `hints`, `automation`, `gate`, `pipelines`.
- **Components** (`src/components/`): Vue 3 SFCs — `DaoLatticeGraph` (SVG), `BodyTab`, `SoulAspectPanel`, `ForgePanel`, `TribulationPanel`, `LegacyDisplay`, `SectTab`, `JournalView`, `HintBar`, `StancesPanel`.
- **Lint** (`src/lint/`): semantic invariant checks (§9 no dead multipliers, completability, gradeScore scaling, etc.).
- **Sim** (`src/sim/`): pacing simulation + behavioral smoke tests.

## Verification

Run `npm test` to run 166 tests: data-port snapshots, engine unit tests, store integration tests, lint invariant checks, and behavioral smoke tests. Run `npm run lint` for typecheck + ESLint (no-magic-numbers scoped to stores/sim).
