# Slice 6.5 — Act I Gate Spec v0.1

*Closes the Act I content-complete gate opened by slice 6. Scope: revive and extend the pacing sim so the gate's criteria are machine-checked, add the run-all harness entry, and clear the review findings (2026-06-12 repo review). Companion to `cultivation-design-expansion-v0.1.1.md` (§8.8, §11) and `early-game-spec-v0.1.2.md`. No new game content ships in this slice.*

**Why this slice exists.** Slice 6 declared Act I content complete, but the pacing sim (the gate's enforcement mechanism per expansion §8.8) crashes on the slice-6 forge migration and has no actor model past Core Formation. The crash root cause is structural: the sim duplicated a read path (`realm.forge.forgeReq`) instead of binding to the factory's readers, so the SETPIECE_DATA migration broke it silently while the linter, fixture suite, and smoke harness all stayed green. This slice fixes the instance and the class.

---

## 0. Hard rules (read first, apply throughout)

1. **No game-data retuning without sign-off.** If a sim assertion fails because the game is actually paced wrong (Act I takes 40 hours, the tribulation is unpassable at max scar), the agent STOPS and reports the numbers. Pacing changes to `js/data/*` are a human decision. The sim measures the game; it never licenses changing it.
2. **Bind, don't duplicate.** Wherever the sim needs an engine value (a multiplier, a pool, a grade resolution, a keep decision), it MUST call the factory's reader function against the sim's synthetic player state, not re-implement the formula. Re-implementation is permitted ONLY where a reader cannot run headless (document each exception inline with a `SIM-DUP:` comment explaining why). This is the rule whose absence caused the crash.
3. **Determinism.** Every actor policy is a pure function of sim state. No `Math.random`. The forge policy is Steady (crackChance 0) for exactly this reason; Forceful/Reckless are excluded from actor policies, not modeled with RNG.
4. **Zero numeric literals in policies** follows the repo rule: policy thresholds and budget bands live in clearly tagged constant blocks (`PACING_BUDGETS`, `ACTOR_POLICY`) at the top of the sim, pass-tagged ⟨tune⟩. These are test expectations, not game data; they do not move to `js/data/`.

---

## Phase A — Shared node boot shim

The runtime smoke harness already boots the real engine headless (`runtime-smoke-node.js`, "real-engine reset cascade"). The sim must boot the same way.

**A1.** Read `runtime-smoke-node.js` and identify its engine-boot path (data loads, factory load, player/temp shims, Decimal availability).
**A2.** If the boot path is not already a separable module, extract it to `js/build/node-boot.js` exposing one function (e.g. `bootEngine()` returning the shimmed globals). `lint-node.js`, `fixture-test-node.js`, `runtime-smoke-node.js`, and `pacing-sim.js` all consume it. Behavior of the three existing harnesses must be byte-identical after extraction (their PASS output unchanged).
**A3.** If extraction would require touching more than the require/boot sections of the existing harnesses, stop and flag before proceeding (the harnesses are the safety net; we do not destabilize them to save the sim).

**Gate A (machine):** all three existing harnesses pass identically post-extraction.

---

## Phase B — Sim revival on the binding rule

**B1.** Fix the crash by deleting the duplicated forge read and binding to the factory: forge requirement via the factory's set-piece reader (`coreForgeData()` / `setpieceFor`), not `realm.forge.*` and not a hand-patched `SETPIECE_DATA.forge.*` path literal.
**B2.** Audit the rest of the existing sim for duplicated reads under rule 0.2: grade scoring, foundation grade mult, band resolution, unlock checks. Rebind each to its factory reader where the reader runs headless; tag unavoidable duplications `SIM-DUP:`.
**B3.** Port the existing sim's q/f-era assertions forward unchanged (coverage must not regress while the actor model grows).

**Gate B (machine):** `node js/build/pacing-sim.js` runs to completion on current data; legacy q/f assertions pass.

---

## Phase C — Actor model through the tribulation

Extend the sim's state and event loop to cover slices 3–6. The sim advances in adaptive steps (large dt during idle accumulation, event boundaries computed exactly); full-run wall time MUST stay under 30s so it lives in the run-all path.

**C1. State extension.** Synthetic player grows: lattice (insight, node tiers), stance (active key), sect (joined, archetype, contribution, owned techniques, deeds checkpoints), NS layer (best, aspect), SF layer (best), tribulation (grade, passed, cooldown), scar (depth, healedDepth, healProgress), milestones earned per layer (needed for KEEP_RULES and AUTOMATION_DATA), legacy (actOneGrade).

**C2. Engine couplings that MUST be live in the sim** (each via reader binding per rule 0.2):
- The full Qi pipeline product (`cultivationQiPerSecond` or its factor readers) so stances, techniques, aspect, scar, tempered, and legacy mults all shape pacing.
- Keep rules: realm prestiges apply `treeResetKeepKeys` so post-NS and post-SF rebuild times reflect earned permanence (a first-class pacing effect).
- Automation: once the NS milestone grants tier 1, q prestiges and meridian buys follow AUTOMATION_DATA semantics including the `gainFraction` threshold (the anti-starvation rule must hold in the sim too).
- Tribulation: pool via `tribulationPreparednessPool`, intensity via `tribulationIntensity`, waves and grade via the factory's wave/grade functions, cooldown and scar deepening via the same transitions the smoke harness exercises.
- Scar heal: `scarHealTick` semantics (passive accrual, depth conversion, remainder carry).

**C3. Actor policies.** Three named profiles, each a deterministic rule set in `ACTOR_POLICY`:

- **diligent** (the budget actor): meridians cheapest-first under the existing reserve heuristic; temper to the Act I target tier ⟨tune⟩ as already modeled; forge Steady at first affordability, refinement runs passively to ceiling; joins the sect at reveal (archetype: first row; document the choice), buys cheapest affordable techniques to the pool's `techniqueDenominator` count; opens lattice nodes cheapest-first targeting the legacy `daoSeeds` denominator (8 Seeds); Breathing Trance ON when lattice is revealed AND Seed target unmet AND not in a banking phase (banking phases: f pre-Great-Circle, forge fuel, tribulation Qi bank ⟨tune thresholds⟩); NS aspect: the highest-credit choice its state allows; triggers the tribulation at first `tribulationIsReady()` with the Qi-bank policy threshold met ⟨tune⟩.
- **spine-only** (the optionality actor): never joins the sect, never opens the lattice, never uses a stance. Climbs realms, tempers, forges Steady, picks whatever NS aspect is reachable with zero Dao nodes (C4 documents what that is), banks Qi, faces the tribulation. This actor exists to prove the horizontal systems are optional for Act I completion, the act-scale ancestor of invariant §6.6.
- **max-scar** (the §6.2 actor): runs diligent, but scar depth is forced to `maxDepth` at first tribulation eligibility. Must still pass (slower re-bank under the depth-3 debuff is acceptable; structural unpassability is a finding under rule 0.1). Additionally asserts the heal arc: from depth 3, passive healing converts all depths and the tempered buff applies.

**C4. Discovery step (required, before assertions are pinned):** read the slice-4 aspect implementation and document in the sim header which aspect choices each profile can actually reach (in particular whether spine-only can access an element aspect with zero Dao nodes, or only Formless). The spine-only assertion is grade-agnostic, so either answer is acceptable; it must simply be *documented*, not assumed.

**Gate C (machine):** all three profiles run to a terminal state (tribulation passed, or budget ceiling hit with a clear report) deterministically across two consecutive runs (identical output).

---

## Phase D — Assertions and calibration

**D1. Calibration mode.** `node js/build/pacing-sim.js --report` runs all profiles and prints a phase-timing table (lattice reveal, Foundation, forge, NS, SF peak, first tribulation attempt, pass, heal completion) with NO assertions. This is the human calibration surface.

**D2. Calibrate-then-pin procedure (human gate).** Run `--report` on current data; Wes reviews the table against the design intent (expansion §8.8: Act I 8–15h to capstone ⟨tune⟩) and pins the bands. The agent proposes bands at ±25% around observed values as a starting point but the pinned numbers are sign-off. **Do not pin and pass in the same unreviewed step.**

**D3. Pinned assertions** (default mode, post-pin):
- diligent: first tribulation PASS within [low, high] sim-hours ⟨pinned at D2⟩; grade Scarred or better; Act I Legacy Grade lands Steady band or higher (legacy bands comment: "a typical first clear lands Steady/Radiant").
- spine-only: tribulation PASS (any grade) within high × 1.5 ⟨tune⟩ sim-hours. Failure of this assertion means an optional system became load-bearing (likely pool weights), a rule-0.1 finding.
- max-scar: tribulation PASS within high × 2 ⟨tune⟩; heal arc completes from depth 3; `temperedQiMult` > 1 afterward.
- Phase floors as well as ceilings: lattice reveal, forge, and NS each carry a [min, max] band so "too fast" (content burned) fails like "too slow."
- The ported legacy q/f assertions (B3) remain.

**D4. Structural-invariance smoke addition** (one new case in `runtime-smoke-node.js`, not the sim): at identical pool inputs, `tribulationPreparednessPool()` is equal with scar depth 0 and scar depth `maxDepth` (the scar slows Qi accrual; it never restructures the pool). This converts the review's "looks like a bug, isn't" finding into a pinned test, paired with an intentionality comment at `scarQiMult()` citing completability (§6.3) and warning against "fixing" it into a death spiral.

**Gate D (human):** Wes signs off on the pinned bands and the `--report` table.

---

## Phase E — Run-all harness

**E1.** `js/build/check-all.js`: runs lint → fixture → smoke → sim in sequence, fail-fast, nonzero exit on any failure, and prints a four-row summary (name, result, wall ms). Total wall budget under 60s on current data.
**E2.** `--quick` flag skips the sim (inner-loop use); default runs everything.
**E3.** A minimal `package.json` with `"scripts": { "test": "node js/build/check-all.js" }` and nothing else (no dependencies, no build machinery; the repo stays a static no-build TMT fork). `npm test` is convention, the script is the substance.
**E4.** README gains a three-line "Verification" section: the command, what the four harnesses cover, and the rule that the suite runs before any commit that touches `js/data/` or `js/build/`.

**Gate E (machine):** `npm test` green end-to-end; deliberately breaking any one harness turns it red.

---

## Phase F — Metadata and recorded decisions

**F1.** `VERSION` bump: num `0.2`, name `"The Mortal Road"` (Act I's act name; default, Wes may rename at sign-off). Changelog entry covering the player-facing surface of slices 2–6: the Dao lattice and stances, Nascent Soul and the Soul Aspect, Automation Tier 1, the Sect (techniques, stipend, deeds), Soul Formation, the First Tribulation, Scars and healing, the Legacy Grade. Match the existing changelog voice.
**F2.** Deferred-decision notes, recorded where the next reader trips over them: (a) `hints.js` header gains one line: a third synthetic hint-only key (after `sectUnjoined`) triggers adding negation to `meets()` instead of growing the shadow grammar; (b) `tribulationIntensity()` already documents the karma term deferral to Samsara, verify and leave.
**F3.** This spec is committed to `docs/internal/` alongside the others.

---

## Acceptance criteria (slice complete when all hold)

1. `npm test` green: lint (18 rules), fixtures (19+1 cases including D4), smoke, sim with pinned assertions, under 60s wall.
2. The sim contains zero duplicated engine reads outside tagged `SIM-DUP:` exceptions, each with a stated reason.
3. All three actor profiles deterministic (two consecutive runs byte-identical) and documented in the sim header, including the C4 aspect-reach finding.
4. Pinned budget bands carry Wes's sign-off (Gate D), and no `js/data/` value changed in this slice without explicit approval (rule 0.1).
5. VERSION/changelog reflect Act I; review findings 1–6 (2026-06-12) each map to a closing change or a recorded deferral.

## Out of scope (do not build)

Secret Realms and Alchemy (slice 7), Heart Demons (slice 8), karma intensity term, Samsara, hint-grammar negation (deferred per F2), any Forceful/Reckless forge modeling, offline-time modeling in the sim (sim time is continuous game time, stated as an assumption in the sim header).
