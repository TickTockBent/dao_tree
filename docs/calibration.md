# Calibration record

The sim's measured facts: pinned bands, probe results, and the methods that
produced them. The sim itself (`npm run sim`, `src/sim/pacing.ts`) is the
source of truth — this file records what the numbers mean and which
decisions consumed them.

## Pinned bands (Gate-D, signed off 2026-07-02)

Asserted in every sim run ("PINNED BANDS" section) and enforced in CI:

| Band | Value | Job |
|---|---|---|
| Competent floor | **74,041s (20.57h)** exact at 1s resolution | Regression instrument — if it moves, the data changed; not a pacing claim |
| Realistic band | **[48.5h … 62.4h]** *at 24–36min late-game check-in cadence* | The experience target; the number defended at planning time |
| Cluster ratio | **≤ 1.5** (observed 1.418) | Focused grammars stay viable relative to each other |

The Realistic band is **cadence-shaped**: the jitter sweep showed the
banking-factor knob does nothing (check-in quantization dominates), so the
band is a one-knob function of session cadence — the assumption is pinned in
the label, and the width is a feature (a twice-a-day checker and an
every-few-hours checker land 14h apart, both finishing). The banking knob
wakes when a mechanic interacts with banking discipline (the almanac); the
band then re-derives, never silently widens.

**Pin migration pre-agreed** (D13): post-slice-9 keep mechanic → Realistic
~[28–35h] cadence-labeled with r final; Competent wherever it lands, as
instrument; cluster re-checked with r in place.

## Actor roster

Nine-plus profiles, all deterministic: **Diligent** (spine-only control,
12,228h — a measuring stick, not a path), **Competent** (optimizer, the
regression floor), **Lattice/Sect/PillFocused** (single-grammar builds:
28.71 / 40.72 / 30.72h — cluster 1.418), **MeridianProbe** (30.45h —
competitive standalone, closed D14), **SectFocused\*/PillFocused\***
(counterfactual aspect probes — land exactly on their base profiles since
the trap-aspect fix), **Realistic** (deterministic imperfection: 300→1800s
check-in cadence, 1.5× banking, every-other-cascade core lapses — 53.25h),
plus the †/‡/r counterfactual variants below.

## The c-churn probes (decision inputs for D2)

**Decomposition († = counterfactual full c-keep):**

| profile | base | with c-keep | churn tax | share |
|---|---|---|---|---|
| Competent | 20.57h | 5.61h | 14.96h | **72.7%** |
| Realistic | 53.25h | 30.25h | 23.00h | **43.2%** |

Realistic − Competent gap (32.68h) = 75.4% genuine idle imperfection +
24.6% keep-topology churn.

**The actor inversion (the probe's central finding):** Competent does
**1,344** re-climbs whose durations already self-accelerate to zero
(first/last 26,102× — rate growth trivializes c's fixed reqBase; everything
past the first decile is instant). Realistic does **12** re-climbs that
**decelerate** (first/last 0.50× — late multi-cascade lapse segments are the
worst). "The core remembers" therefore serves the human's lived hours; the
optimizer already has its vanishing mountain.

**Partial keep (‡, milestones-only):** a uniform ~70% coupon on every
re-climb (per-k spread 4.9pts) — **no curve** (c's three milestones all
latch before the first cascade). Confirmed the real mechanic needs an
explicit per-ascent compounding term.

**r-refinement (Realistic, curve shape):** BRIEF tail (ritual mastered,
still felt) at r ∈ {0.65, 0.70, 0.75} and r=0.7+f=0.05; HEAVY (not yet a
ritual) at r=0.8 and f=0.1; the vanish regime needs r=0.5. At r=0.7 the last
four climbs run 3.5/14.5/5.1/3.6min with 9/12 single-breath climbs. The
felt curve is two interleaved accelerating classes — routine re-tempers AND
post-lapse recoveries both monotone down (recovery-from-neglect also gets
mastered). Realistic's own imperfection floors the tail naturally.
Counterfactual totals are brackets, not predictions (the clock compression
includes interleaved work/idle): a real r=0.7-style mechanic lands Competent
~[6.6–10.3]h, Realistic ~[28–46]h (quantized to the check-in grid).

**Jitter sweep (Realistic sensitivity):** 9-point grid, late check-in
{1440/1800/2160s} × banking {1.3/1.5/1.7} → 48.55 / 53.25 / 62.35h, swing
1.284× (wide → pin a range). Banking column identical throughout — the dead
knob finding.

## The severing k-probe (decision input for Q9/D23, 2026-07-02)

**Part 1 — live contribution (⊘ effect-ablation: the policy still acquires
and uses the piece; its effect is nullified from acquisition onward):**

| severable | actor | base → ablated | contribution | end rate share m |
|---|---|---|---|---|
| soul aspect | LatticeFocused | 28.71 → 41.04h | **12.33h** | 1.50× (clean) |
| soul aspect | Realistic | 53.25 → 59.25h | **6.00h** | 1.50× (clean) |
| stance | LatticeFocused | 28.71 → **21.59h** | **−7.12h (ablated FASTER)** | 1.00× |
| profession | PillFocused | 30.72 → 57.32h | **26.60h** | not clean |
| profession | Realistic | 53.25 → 83.75h | **30.50h** | not clean |
| ext-meridian track | MeridianProbe | 30.45 → 57.37h | **26.92h** | 5.96× (clean, 1.25⁸) |

Realistic never acquires the stance or the ext track (measured structural
zeros). Findings that reshape the D23 candidate list:

- **The stance inversion:** severing Breathing Trance's effect makes the
  focused lattice actor 7.12h *faster* — the trance is net-negative on
  total time at current data (×0.7 qi cost outweighs what ×2 Insight buys
  back for that policy). Severing it would be a pure buff with no weakness
  window: **stance does not fit the severance shape on the qi axis as-is.**
  (Separate rule-0.1 question flagged: is the trance itself a trap for
  qi-focused play, or is the sim policy just using it badly?)
- **"Meridian set bonuses" don't exist as a distinct effect** —
  `meridianMult` is a smooth per-meridian product; the severable analog is
  the extraordinary-meridian **track** (whole set of 8, 5.96×).
- **Manifestation gap:** the lattice Manifestation tier isn't in data yet —
  not measured, not faked.
- **Availability is build-dependent:** for the experience-target actor only
  soul aspect and profession are live severables today — three sequential
  severances need ≥3 live options per viable build (a sim assertion the
  mechanic must ship with).
- Profession is the largest Realistic contributor (30.5h) but is a
  duty-cycle + episodic composite, not a clean multiplier — bracket it by
  felt hours, not by m. The ext track's 5.96× is end-state, not
  lifetime-average (it ramps in across the run).

**Part 2 — breakeven-timing MODEL** (analytic; ritual steps, not Act II
wall-clock; ramp starts at c·m, grows geometrically, caps at k·m by step 12
— mirroring Act I's 12-re-climb resolution): breakeven step n\* and
in-window lifetime net are **m-independent**, so one grid serves every
severable:

| c | k | breakeven step | net over the 12-step ramp |
|---|---|---|---|
| 0.25 | 1.2–2.0 | 9–11 | 0.62–0.87 (negative) |
| 0.50 | 1.2 / 1.5 / **2.0** | 10 / 8 / **7** | 0.80 / 0.92 / **1.10** |
| 0.75 | 1.2 / **1.5** / **2.0** | 8 / **6** / **5** | 0.96 / **1.09** / **1.28** |

Only three cells are net-positive *within* the ramp window; c = 0.25 never
recovers inside it. If D23's lifetime-net-positive must hold by ramp end,
the viable corner is **c ≥ 0.5 with k ≥ 1.5–2.0** (post-cap steps then
compound the surplus). Probe flag: `counterfactualSeverEffect` (⊘), in
`assertProbeFlagsExclusive`; base-profile output verified pure-insertion vs
pre-change capture; sim wall-time 50.3 → ~65s (+28%).

## Methods (reusable)

- **Attribution before action** — counterfactual-probe the suspected cause
  first (inverted the Formless-lock assumption; found the real trap
  aspects).
- **Relational probes** — multi-variant × multi-actor grids; single-variant
  tests read "faster, good" and miss inversions.
- **Curves, not totals** — per-segment instrumentation (observation-only,
  bit-identity preserved on measured runs); first/last ratios and
  **single-breath counts** (climbs completing within one check-in) as the
  legibility metric, since clock-compression counterfactuals can show
  sub-check-in durations the real quantized mechanic never produces.
- **Counterfactual hygiene** — probe flags are mutually exclusive
  (`assertProbeFlagsExclusive`), clearly labeled COUNTERFACTUAL, sim-side
  only (engine untouched), and never asserted on (decision inputs, not
  regressions).
- **Determinism gate** — every sim change verified byte-identical across two
  runs (modulo wall-time lines) before commit.
