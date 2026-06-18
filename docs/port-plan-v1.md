# Dao Tree Port Plan v1 — TMT/Vue 2 → Vite + TS + Vue 3 + Pinia

*Authoritative build plan for the engine port. Date: 2026-06-18. Supersedes nothing; runs alongside `cultivation-design-expansion-v0.1.1.md` and `early-game-spec-v0.1.2.md`.*

## Locked decisions

| Decision | Choice |
|---|---|
| Stack | Vite + TypeScript + Vue 3 (SFC, `<script setup>`) + Pinia + Vitest |
| Engine model | Idiomatic per-system Pinia stores (no `layer` abstraction) |
| Save policy | Fresh start, schema-versioned from day one, no 0.2.x importer |
| Pacing sim | Ported in parallel as the parity oracle |
| UI strategy | Purpose-built SFCs per system (no `tabFormat` DSL, no generic upgrade/buyable grids) |
| Decimal lib | Keep `break_eternity.js` (via npm, ships types) |
| Data layer | Stays the single source of truth; ports to typed TS modules |
| Linter | TS types absorb structural rules; semantic rules remain as build-time assertions |
| Distribution | GitHub Pages + itch.io unchanged; Vite emits static bundles |
| Lattice UI | SVG graph (3 concentric rings, 5-fold radial symmetry), not TMT buyable grid |
| Branch | `port/v1`; new code in `src/`; `js/`+`css/` kept as reference until M8 cutover |

## Repo layout

```
src/
  data/           # 15 typed tables (port of js/data/)
  engine/
    decimal.ts    # break_eternity re-export + helpers
    format.ts     # port of NumberFormating.js
    meets.ts      # the condition DSL (typed discriminated union)
    save.ts       # schema-versioned save system, migration registry
    tick.ts       # the 50ms loop, offline catch-up, devSpeed
    types.ts      # LayerId, Scope, Element, etc. vocabularies
    doReset.ts    # doReset cascade compiled from TREE_DATA + KEEP_RULES
  stores/
    game.ts       # tick orchestration, diff, time, offline
    nav.ts        # tab/navTab/subtabs (replaces stringly-typed nav)
    realm.ts      # q/f/c/n/s prestige + sub-stages + doReset cascade
    body.ts       # meridians, temper, stored grades, scar slot
    dao.ts        # lattice nodes (graph), insight, stances
    sect.ts       # archetype, contribution, milestones, techniques
    forge.ts      # set-piece instance 1
    tribulation.ts# set-piece instance 2
    scar.ts       # depth/heal arc (cross-cutting; reads/writes body)
    journal.ts    # eternal latch entries
    legacy.ts     # eternal Act I Legacy Grade
    hints.ts      # first-match-wins cascade
    automation.ts # maturity model, frontier coverage
    pipelines.ts  # cultivationQiPerSecond + insightPerSecond getters
  components/      # Vue 3 SFCs (per-system, not generic primitives)
  css/            # ported from css/, with .fade-enter rename
  lint/
    rules.ts      # semantic assertions (no-dead-mult, completability, etc.)
    index.ts      # orchestration; runs at dev startup + `npm run lint`
  sim/
    pacing.ts     # 3 profiles, pinned budgets (boot new engine headless)
    smoke.ts      # 259 behavioral checks ported to Vitest
  App.vue
  main.ts
  main-headless.ts # Node entry for sim/lint (mounts stores without Vue)
```

## Phases

### Phase 1 — Foundation (M1)

**Goal:** running Vite app with Qi proof of concept, save system, tick loop.

1. **Scaffold.** `npm create vite@latest . -- --template vue-ts`. Add Pinia, Vitest, `break_eternity.js`. Configure paths (`@/` → `src/`). ESLint with `no-magic-numbers` scoped to `src/stores/**` and `src/sim/**` (§11 rule ported — data tables in `src/data/` exempt).
2. **`engine/decimal.ts`.** Re-export `Decimal` from `break_eternity.js`. Add `decimalZero`, `decimalOne` constants. Centralize construction so no module-top-level `new Decimal()` runs before save load.
3. **`engine/format.ts`.** Port `NumberFormating.js` verbatim. Functions: `format`, `formatWhole`, `formatTime`, `formatSmall`, `commaFormat`, `regularFormat`, `exponentialFormat`, `invertOOM`.
4. **`engine/types.ts`.** Vocabularies: `RealmId = 'q'|'f'|'c'|'n'|'s'`, `Element = 'metal'|'wood'|'water'|'fire'|'earth'`, `Scope = 'tree'|'life'|'eternal'`, `LayerId` union, `TemperTier`, `CoreGrade`, `TribGrade`, `LegacyBand`, etc.
5. **`engine/meets.ts`.** Port `meets()` as typed discriminated union, not loose-object-with-string-keys. Pure function `meets(condition, state: GameState): boolean` over a `GameState` snapshot interface (NOT over `player`/`tmp` globals) — testable and headless-runnable. Hint-only shadow keys get their own union, evaluated separately before delegating to `meets()`.
6. **`engine/save.ts`.** Schema-versioned:
   - `SAVE_VERSION = 1` integer (not lexicographic string).
   - `SaveSchema` typed interface with Decimal fields marked (serialized as strings).
   - `migrations: Migration[]` registry — currently empty, hook exists.
   - `load()`: read localStorage → parse → run migrations → hydrate Decimals → validate against `SaveSchema` (extra keys pruned, missing keys default-filled).
   - `save()`: serialize → write. Autosave every 5s. `beforeunload` save (fixes existing `player.autosave` bug).
   - Export/import via clipboard (same UX as current).
   - NaN guard: refuse to save NaN-corrupted state, halt tick loop, alert.
7. **`engine/tick.ts` + `stores/game.ts`.** 50ms `setInterval` → single Pinia action `tick()` in `gameStore`:
   - Compute `diff` (real elapsed seconds, clamped to `maxTickLength`).
   - Apply offline catch-up (`offTime` drain, 10×-real-time model) and `devSpeed`.
   - Forward pass: `player.points += qiPerSecond * diff`; call each system store's `update(diff)` in dependency order (Body → Dao → Sect → Realms → Forge → Tribulation → Scar → Journal → Legacy → Hints).
   - Reverse pass: automation (autoPrestige via maturity model, auto-buy via `runBuyableAutomationFor`).
   - Milestone/achievement latch sweeps.
   - Autosave timer.
   - `tmp` is gone — Pinia getters replace it. Cross-store reads compose via Pinia reactivity; tick's defined update order guarantees freshness within a tick.
8. **`stores/nav.ts`.** Replaces `player.tab`/`navTab`/`subtabs`/`prevTab`/`lastSafeTab` with typed nav store: `currentTab: TabId | null`, `currentNavTab: TabId | null`, `subtabs: Record<LayerId, string>`, `goBack()`. Tab ids are a union, not bare strings.
9. **M1 proof of concept:** `App.vue` shows `player.points` ticking up at `qiBaseRate`, a "Prestige" button that resets points to 0 and banks `q.points`. Save/load round-trips.

**Deliverable:** running app; gather Qi, prestige once, save, reload, state intact.

### Phase 2 — Data port (M2)

**Goal:** all 15 tables in TS with typed schemas; structural half of linter becomes compile errors.

Port each `js/data/*.js` to `src/data/*.ts` as `export const X: TypedShape = [...]`. Cross-table references become typed: `RealmRow.setpiece` is `keyof typeof SETPIECE_DATA`, `KeepRule.onResetOf` is `LayerId`, `LatticeNode.requires` is `NodeKey[]`, etc.

| Table | File | Key types |
|---|---|---|
| `FACTORY_NUMERICS` | `constants.ts` | `FactoryNumerics` |
| `REALM_DATA` | `realms.ts` | `RealmRow` (with optional `grade`, `setpiece`, `soulAspect` discriminated) |
| `SETPIECE_DATA` | `setpieces.ts` | `ForgeConfig`, `TribulationConfig`, `ScarTable` |
| `LEGACY_DATA` | `legacy.ts` | `LegacyConfig` |
| `BODY_DATA` | `body.ts` | `BodyConfig`, `BuyableRow`, `TemperTier` |
| `GATE_DATA` | `gates.ts` | `GateAchievement` |
| `TREE_DATA` | `trees.ts` | `TreeRegistry` (scope enum enforced) |
| `KEEP_RULES` | `keep-rules.ts` | `KeepRule` |
| `LATTICE_DATA` | `lattice.ts` | `LatticeConfig`, `LatticeNode` |
| `STANCE_DATA` | `stances.ts` | `Stance` (modifier keys enum-enforced) |
| `HINT_DATA` | `hints.ts` | `HintRow` (with `always?: true` discriminating catch-all) |
| `AUTOMATION_DATA` | `automation.ts` | `AutomationRow` (action enum, maturity optional) |
| `SECT_DATA` | `sect.ts` | `SectConfig`, `Archetype`, `SectMilestone` |
| `TECHNIQUE_DATA` | `techniques.ts` | `Technique` (school enum, effect enum) |
| `JOURNAL_DATA` | `journal.ts` | `JournalEntry` (with `bonus` discriminated) |

**Deliverable:** `npm run lint` (structural checks via tsc) passes; data tables are single source of truth.

### Phase 3 — Engine core + realm spine (M3)

**Goal:** Act I realm spine playable (q → f → c → n → s), with prestige, sub-stages, graded Foundation, doReset cascade, keep rules. First real parity milestone.

1. **`stores/realm.ts`.** One store managing all 5 realms. State: per-realm `{ points, best, total, unlocked, resetTime, refinementProgress?, warming?, tribActive?, ... }`. Actions: `prestige(realmId)` (validates `canReset`, computes `resetGain = (baseAmount/reqBase)^gainExp`, awards points, fires `onPrestige` for graded Foundation, runs `doReset` cascade). Getters: `realmBest(id)`, `realmReachedSubstageCount(id)`, `substageThreshold(id, label)`, `realmMult()`, `canReset(id)`, `resetGain(id)`, `nextAt(id)`.
2. **`engine/doReset.ts`.** Cascade compiled from `TREE_DATA` + `KEEP_RULES` exactly as current factory (`treeResetKeepKeys` → `layerDataReset` equivalent). Tree-scoped realms reset lower rows in their tree; life/eternal layers topologically immune (scope check, not `isNaN(row)`). Keep-rule acquisition via `hasMilestone(grant.layer, grant.milestone)`. Pure function over save state + milestone state.
3. **`stores/body.ts`** (skeleton). Meridians + temper buyables + stored grade slots. `qiBaseRate`, `meridianMult`, `temperMult` getters feed Qi pipeline. Full impl in M4.
4. **`stores/pipelines.ts`.** `qiPerSecond` getter composing: `qiBaseRate × meridianMult × temperMult × realmMult × gateMult × coreGradeMult × daoNodeQiMult × stanceQiMult × soulAspectQiMult × sectStipendQiMult × techniqueQiMult × scarQiMult × temperedQiMult × legacyQiMult`. `insightPerSecond` similarly. Replace `cultivationQiPerSecond` / `insightPerSecond`.
5. **`stores/game.ts`** wired: tick calls `realmStore.update(diff)`, `bodyStore.update(diff)`, reads `pipelines.qiPerSecond`.
6. **UI (minimal):** `<PrestigeTree>` (canvas, keep the shape), `<RealmTab>` (sub-stages + prestige button + milestones), `<OverlayHead>` (points + qi/sec). Enough to play the spine.

**Deliverable:** playthrough Qi Condensation → Soul Formation, Foundation grading, keep rules surviving breakthroughs. Pacing not yet verified.

### Phase 4 — Body, Dao lattice (as graph), Soul Aspect (M4)

**Goal:** second grammar (comprehension) and body depth online.

1. **`stores/body.ts`** full: meridian buyables (primary 12, extraordinary 8, temper 24), temper tier milestones, `temperTierIndexForLevel`, `nextTemperTierDescription`. Scar slot lives here (depth/healed/healProgress) with `scarHealTick(diff)` called from tick.
2. **`stores/dao.ts`.** Lattice as **real graph**, not TMT buyables in grid:
   - State: per-node `{ tierOwned: 0|1|2 }`, `insight` currency, `activeStance`, `revealed` latch.
   - Graph derived from `LATTICE_DATA.nodes` (15 nodes) + `requires` edges + `conflicts`.
   - Actions: `buyNodeTier(nodeKey)` (validates `requires` met, costs insight, applies sect discount), `toggleStance(stanceKey)` (exclusive, max 1, self-heals if unlock unmet).
   - Getters: `daoNodeTierOwned(key)`, `heldDaoSeedCount()`, `daoNodeQiMult()`, `daoNodeInsightMult()`, `stanceQiMult()`, `stanceInsightMult()`.
3. **Soul Aspect** (on realm `n`): `soulAspectRow()`, `setSoulAspectKey(key)`, `soulAspectQiMult()`, `soulAspectInsightMult()`. Aspect pick is one-shot action gated by `meets(aspect.requires)`.
4. **UI:**
   - **`<DaoLatticeGraph>`** — centerpiece. SVG, 3 concentric rings (roots innermost, ring-2 mid, ring-2b outer), 5-fold radial symmetry (one element per spoke: metal/wood/water/fire/earth). Edges drawn from `requires` (root → ring-2 → ring-2b). Nodes colored by element, sized by tier owned. Conflicts rendered as red dashed arc between nodes. Click node to buy next tier. The "treat it like a lattice" moment.
   - `<BodyTab>` — meridian rows + temper tier ladder + stored-grade display + scar heal bar.
   - `<SoulAspectPanel>` — aspect pick (one-shot, Formless always available).

**Deliverable:** Dao lattice playable as graph, stances toggle, Soul Aspect pickable, body tempered through Marrow.

### Phase 5 — Forge, Tribulation, Scar, Legacy (M5)

**Goal:** Act I capstone playable.

1. **`stores/forge.ts`** (set-piece instance 1): `performForge(pushOption)`, `refinementTick(diff)`, `setCoreGradeIndex()`, all forge readers (`coreIsForged`, `coreBaseGradeIndex`, `coreCeilingGradeIndex`, `forgeFuelCost`, `canAffordForgePush`, `refinementProgress/IsWarming/CanProgress/BarFraction`).
2. **`stores/tribulation.ts`** (set-piece instance 2): `beginTribulation()`, `tribulationTick(diff)`, `resolveTribulation()`, `tribulationPreparednessPool()` (weighted sum, deliberately excludes scar debuff per §6.3), `tribulationIsReady()`, `tribulationGradeForFraction()`.
3. **`stores/scar.ts`**: `deepenScar()`, `scarHealTick(diff)`, `scarQiMult()`, `temperedQiMult()`, `scarIsActive()`. Cross-cutting: reads/writes `bodyStore.scar*` (slot is life-scoped on Body, logic is own concern).
4. **`stores/legacy.ts`**: `actOneLegacyScore()` (weighted sum over normalized coreGrade/aspect/daoSeeds/sectStanding/tribulation), `computeAndStoreActOneLegacy()` (called once on first trib pass, monotone), `legacyQiMult()`.
5. **UI:** `<ForgePanel>` (push buttons, refinement bar, crack state, fuel cost labeled correctly — fixes 0.2.2 bug by construction), `<TribulationPanel>` (wave drain, pool bar, grade display, retry cooldown), `<LegacyDisplay>` (band + qiMult).

**Deliverable:** full Act I playable end-to-end — gather Qi → breakthrough all 5 realms → forge core → pick aspect → survive tribulation → inscribe Legacy Grade.

### Phase 6 — Sect, Techniques, Journal, Hints, Automation (M6)

**Goal:** full content parity with 0.2.x.

1. **`stores/sect.ts`**: archetype pick (one-shot), `contributionPerSecond()` (sub-linear, `rate × qiPerSecond^exponent`), `contributionStageCap()` (first unmet-stage milestone's `at`), sect milestones (stipend/library/arsenal), `sectStipendQiMult()`, `sectLatticeDiscount(element)`, `sectLibraryUnlocked()`.
2. **Techniques** (folded into `sect.ts` or own store): TMT upgrades → `techniques` array on sect state, `techniqueIsOwned(index)`, `techniqueQiMult()`, `techniqueInsightMult()`, school/tier gating.
3. **`stores/journal.ts`**: eternal latch entries, `journalEntryConditionMet()` (handles hint-only keys locally then delegates to `meets()`), `currentCultivationStage()` stamping, `grantJournalBonus()` (qi or achievement), Reflect action.
4. **`stores/hints.ts`**: first-match-wins cascade, `cultivationCurrentHint()` / `cultivationHintText()`. Hint-only shadow grammar evaluated here before delegating to `meets()`.
5. **`stores/automation.ts`**: maturity model (`realmAutoCompleteness`, `autoPrestigeCostMultiplier`, `autoPrestigeFires`, `secondsUntilAutoPrestigeRests`), `runBuyableAutomationFor(layerId)`. Auto-prestige and auto-buy wired into tick's reverse pass. Temper deliberately not automated.
6. **UI:** `<SectTab>` (archetype pick, contribution, milestones, technique library), `<JournalView>` (chronological entries, unread glow, Reflect), `<HintBar>` (top guidance line in `<OverlayHead>`), automation indicators on relevant tabs.

**Deliverable:** every feature in CHANGELOG 0.2 works. Content parity complete.

### Phase 7 — Linter + pacing sim + parity verification (M7)

**Goal:** new engine provably at parity with old.

1. **`lint/rules.ts`.** Port semantic half of 18 rules as build-time assertions:
   - `checkNoDeadMultipliers` — declared multiplier → live consumer function referencing data field token. (Cross-cutting data↔code reachability; stays.)
   - `checkCompletability` — fresh-save reachability, no-circular-dependency at root, forge ceiling reachability, realm-token-must-be-stage-label.
   - `checkGradeScoreScaling` — weight-sum-to-1, per-term max-input/denominator ratio.
   - `checkPersistenceScopes` ISOLATION half — contiguous disjoint row bands (cross-tree leak).
   - `checkKeepRules` reachability half — `row(target) < row(onResetOf)`.
   - `checkHintData` reachability + catch-all-LAST + exactly-one.
   - `checkLatticeData` acyclicity + root-reachability.
   - `checkStanceData` opportunity-cost (must trade DOWN and UP).
   - `checkAutomationData` FRONTIER RULE.
   - `checkSoulAspectData` completability floor.
   - `checkSectData` sub-linear exponent, ≥2 archetypes, ascending `at`s.
   - `checkTechniqueData` school-technique offered-coverage.
   - `checkJournalData` fresh-save reachability.
   - `checkSetpieceData` tribulation grade ladder shape, scar bounds.
   - `checkLegacyData` weight-sum, ascending floors, qiMult ≥ 1.
   - §11 no-numeric-literals rule now ESLint `no-magic-numbers` config from Phase 1.
   - Run via `npm run lint` and at dev startup (same UX as current `npm test` gate).
2. **`sim/pacing.ts`.** Boot new engine headless in Node (`main-headless.ts` mounts stores without Vue). Run 3 profiles (`diligent`, `spineOnly`, `maxScar`) with same pinned `PACING_BUDGETS`. Same event-stepped time model (analytic `dt` between decisions). Same assertions (`assertStructural` + `assertPinned`). Parity oracle — if new engine passes same budgets, pacing preserved.
3. **`sim/smoke.ts`.** Port 259 runtime-smoke behavioral checks to Vitest against new engine. Reset cascade, keep rules, hint cascade, forge/tribulation/scar flows, automation maturity.
4. **Manual parity playthrough.** Checklist derived from CHANGELOG 0.2: every feature exercised, every popup observed, every grade band reachable, every journal entry latches, every hint fires in order.

**Deliverable:** lint green, pacing sim green (3 profiles within budgets), smoke tests green, manual parity sign-off. New engine provably at parity.

### Phase 8 — Cutover (M8)

1. Swap `index.html` to load Vite build output.
2. Update `.github/workflows/` (Pages) and `itch-*` tag workflow to build via `npm run build` instead of copying `js/`+`css/`.
3. Delete `js/`, `css/`, `demo.html`, old `js/build/` harnesses (replaced by `src/lint/` + `src/sim/`). Move `docs/internal/` to `docs/` (still authoritative).
4. Bump `SAVE_VERSION`, tag `0.3.0`.
5. Update README to reflect new architecture.

**Deliverable:** 0.3.0 ships. TMT era over.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Getter staleness across stores** (TMT eagerly recomputes `tmp` every tick; Pinia getters lazy/cached) | Tick's defined forward-pass update order guarantees freshness within a tick. Getters reading other stores compose via Pinia reactivity. Add Vitest assertion that `qiPerSecond` is stable across a tick boundary. |
| **Decimal serialization bugs** (current `fixSave` only re-Decimals `best`/`total` explicitly) | Typed `SaveSchema` with Decimal fields marked; `hydrate()` walks schema and re-Decimals by field type, not default-shape matching. |
| **§11 no-numeric-literals rule weakening** (ESLint `no-magic-numbers` less precise than source-text scan) | Scope `no-magic-numbers` to `src/stores/**` and `src/sim/**` only; `src/data/**` exempt (where numbers live). Add custom ESLint rule if needed to match old scan precision. |
| **Pacing drift** (new engine's tick model differs subtly from TMT's) | Pacing sim is oracle. If budgets fail, diff is in tick model, not content. M7 catches before cutover. |
| **Canvas tree branch lines** (current impl reads DOM rects by id; component port must preserve ids or update drawer) | `<PrestigeTree>` emits stable ids (`node-${layerId}`); branch drawer reads them. Same pattern, clean reimpl. |
| **Scope creep into locations/combat** (explicitly out of scope) | Plan above is parity-only. Locations and combat land in 0.4+ on new foundation. |

## Out of scope for this arc

- Locations / location-based events
- Combat (decision-based or otherwise)
- Any new feature/concept beyond 0.2.x parity
