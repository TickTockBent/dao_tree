# Architecture

Engine-shaping structures — decided direction, staged implementation.

## Typed accumulators (the convergent architecture)

*Decided 2026-07-02 (the most architecturally significant call of the design
pass).* Accumulators — state that accumulates across resets and feeds back —
are a **first-class engine concept with a scope enum, not individual
features**:

- **soul** — carried by the reincarnating cultivator: the ascent counter
  (slice 9), Dao Heart.
- **world** — living in the world, findable by any life: sect seed-stores,
  wild seedings, territory effects, the chronicle's raw material.
- **dao** *(reserved)* — comprehension/philosophical progress: earned
  foresight (the knowledge veil's content), ancestral knowledge. No instances
  yet; "reserved" means an enum value and this paragraph, not code.

Same data patterns, persistence rules, and diminishing-returns math
(**wider, not taller** — see design-principles #21) across all instances;
the next accumulator is a data entry, not a feature. Five planned systems —
weather, loot table, sect monopoly, chronicle, Samsara economy — are five
expressions of "the world remembers," not five systems.

**Staging (agreed):** slice 9 ships the ascent counter as the first typed
instance — the TYPE is defined (scope tag, diminishing-returns descriptor,
persistence rule) but no machinery exists for scopes with zero instances.
Slice 10's world instances force the generalization; dao validates it.
Premature generality is how convergent designs die.

**Scope model mapping:** the enum already exists in embryo — `doReset`
compiles from `tree | life | eternal` scopes today, and eternal state is
topologically unreachable by any cascade (persistence is already
default-by-scope, not exception-by-list; keep-rules are the exception
mechanism *within* tree scope). At Samsara, `eternal` **differentiates** into
soul/world/dao — the assignment audit of every currently-eternal state is a
named slice-10 task (open-questions Q6).

## Save lineage + achievement registry (landed 2026-07-02, `36556ac`)

The Steam soft-yes consequences (decisions D9a/D9b), now real:

- **Golden-save lineage**: `src/save/goldens/` holds one fixture per shipped
  version (0.3.0/0.4.0/0.4.1 generated from git worktrees at their itch tags
  using each tag's own store code; 0.4.2 from HEAD via
  `scripts/generate-golden.ts`). `golden-saves.test.ts` revives each through
  migrations → merge → hydration on current HEAD, ticks, asserts an expect
  block, and export/import round-trips. Rules in `src/save/goldens/README.md`
  — never edit a shipped fixture; every release adds one. CI
  (`.github/workflows/ci.yml`) runs lint, tests, build, and the pacing sim
  with FAIL-line enforcement.
- **Achievement registry**: `src/data/achievements.ts` — stable UPPER_SNAKE
  keys that double as Steam API names, eternal `ach` slice (file-scoped by
  construction — the Steam-account analog), pure record with zero gameplay
  effects, lint-pinned invariants (typed clause whitelist, fresh-boot
  false-for-all, veil discipline). Distinct from the buff-carrying,
  life-scoped gate "Deeds."
- **`reviveSave()`** in `src/engine/save.ts` is the single load path shared
  by localStorage load, base64 import, and the harness.

## The multi-life (dynasty) harness

*Scoped 2026-07-02; build before any world-accumulation rate is tuned —
single-life sims are structurally blind to cross-life effects (life 5 after
four gatherer lives ≠ life 5 after four lattice lives).*

A second harness wrapping the first: `runDynasty(sequence, seed)` ≈ a loop of
single-life runs with a persistence bridge carrying soul/world accumulator
state; determinism via seeded almanac + per-life encounter tables; cost is
wall-time, which is a tuning concern, not a design one.

**Dynasty-scale assertions to pin when it exists:**
1. *Sequencing matters, no sequence dominates* — the counter-monopoly test at
   file scale (a strictly optimal build order would make sequencing a puzzle
   with an answer, not a strategy).
2. *Cold-file band* — a save that never invests in world-state still lands
   every life inside the pacing band (loot-never-gate at file scale).
3. *Wider-not-taller invariant* — late-save single-life times stay inside a
   bounded multiple of the cold-file band (world richness accelerates and
   texturizes, never trivializes).

## The almanac substrate

One world-clock serves both the celestial weather system and ambient rivals
(decision D10's "architect hooks" realized): a **deterministic seeded
almanac** — predictable tier as a pure function of world-time, loot tier as
per-life seeded encounter tables — schedules the sky and the neighbors
("during the Crimson Comet, someone attempts ascension"). Architect once.
Design content: [design-directions.md](design-directions.md).
