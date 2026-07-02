# Dao Tree

A xianxia cultivation incremental game. Walk the mortal road from first breath to the First Tribulation: open meridians, temper the body, forge a Golden Core, comprehend the Dao lattice, join a sect, brew pills from secret realms — and face what rushing costs.

Built with Vite + TypeScript + Vue 3 + Pinia. No monetization, no build-step tricks: a design-pure incremental.

## Play

- **Stable** (tagged releases): [ticktockbent.itch.io/dao-tree](https://ticktockbent.itch.io/dao-tree)
- **Bleeding edge** (every push to main, with debug keys + banner): [ticktockbent.github.io/dao_tree](https://ticktockbent.github.io/dao_tree/)

Releases: push to main deploys Pages; an `itch-x.y.z` tag publishes to itch via butler. Player-facing history lives in [CHANGELOG.md](CHANGELOG.md).

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run test     # run the full test suite
npm run lint     # typecheck + eslint (no-magic-numbers outside data/tests)
npm run sim      # headless pacing simulation (actor profiles + §6.6 optionality proofs)
```

## Architecture

- **Engine** (`src/engine/`): pure functions — the `meets()` condition DSL, `format()`, the schema-versioned save system, `buildGameState()`, the `doReset` prestige cascade compiled from persistence scopes (tree / life / eternal).
- **Data** (`src/data/`): typed tables — the single source of truth for every game number. Tuning edits data, never code.
- **Stores** (`src/stores/`): one Pinia store per system — realms, body, dao lattice + stances, sect, forge, tribulation, scar, legacy, journal, hints, automation, secret realms, alchemy, heart demons, seclusion (Deep Meditation), pipelines (the Qi/sec composition), game (tick loop + save lifecycle).
- **Components** (`src/components/`): Vue 3 SFCs, one per system surface.
- **Lint** (`src/lint/`): semantic invariant tests over the data tables — no dead multipliers, completability by construction, closed economies, optionality (§6.6: optional systems are accelerants, never requirements).
- **Sim** (`src/sim/`): a headless actor-model pacing simulation (event-stepped, deterministic) plus behavioral smoke tests. The sim is the tuning instrument: profiles range from a spine-only control to a competent optimizer, and pacing/viability assertions run in `npm test`'s companion `npm run sim`.

## Verification

`npm test` runs the full suite: data-tuning snapshots, engine unit tests, store integration tests, lint invariants, and behavioral smoke tests. The suite plus `npm run sim` runs before any commit touching `src/data/` or `src/engine/`.

## License

MIT. The project began as a fork of [The Modding Tree](https://github.com/Acamaeda/The-Modding-Tree); no TMT code remains since the 0.3.0 engine rewrite, but the upstream licenses are retained (`LICENSE`, `Prestige-tree-license`) as the repo history contains derived code.
