# The-Modding-Tree

An incremental game engine based on The Prestige Tree. It still requires programming knowledge, but it's mostly pretty easy things and copy/pasting.

[Look here for a tutorial on getting started with modding with TMT](docs/tutorials/getting-started.md)

You can look in the [documentation](docs/!general-info.md) for more information on how it all works, or look at the code in [layers.js](js/layers.js) to see what it all looks like.

## Verification

Run `npm test` (or `node js/build/check-all.js`; add `--quick` to skip the pacing sim for inner-loop use) to run the four harnesses: the data-invariant linter (18 rules over all data tables), the synthetic lint-fixture suite (two-tree topology cases), the real-engine runtime smoke test (reset cascade, keep rules, hint cascade), and the pacing sim (actor-model timing assertions for diligent/spine-only/max-scar profiles). **The suite must be run before any commit that touches `js/data/` or `js/build/`.**
