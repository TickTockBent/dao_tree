// src/sim/dynasty.ts — the multi-life (dynasty) harness (architecture.md,
// "The multi-life (dynasty) harness").
//
// A SECOND harness wrapping the single-life sim in src/sim/pacing.ts: a loop of
// single-life runs with a persistence bridge carrying SOUL-scoped accumulator
// state between lives. Single-life state (Qi, realms, banks) resets every life;
// soul-scoped state (the ascent counter, the severance-ritual accumulator, the
// severance history) CARRIES — exactly what stores/soul.ts (the eternal-scoped
// pre-Samsara soul encoding) would carry across a reincarnation.
//
// SCOPE (v1 — soul-side carry ONLY). Out of scope, design not yet ruled: karma,
// world-scoped state, roots, memory fragments, any rebirth mechanic beyond
// "life-scoped state resets, soul-scoped state carries" (see the module comment
// in pacing.ts's dynasty adapter). This harness is DESIGN-INDEPENDENT: it must
// not prejudge any slice-10 ruling, so it models the conservative reading and
// leaves anything ambiguous flagged rather than decided.
//
// DECOUPLING: this module imports NOTHING at runtime from pacing.ts. The
// single-life run is supplied by dependency injection (the `runLife` callback),
// so importing this file never triggers pacing.ts's `runPacingSim()` and the
// harness stays unit-testable in isolation. pacing.ts imports FROM here (one
// direction only) and passes its real single-life adapter in.

// The shipped karma decay ratio (r in base × rⁿ). Imported as DATA only (no
// store, no side effect, no pacing.ts dependency — the module stays unit-testable
// in isolation): the farm-income convergence assertion (D36, step-8 hardening)
// bounds the repeat sequence's cumulative income by the geometric ceiling
// life-1 / (1 − r), which is only legible against the real r.
import { KARMA_DECAY_RATIO } from '@/data/karma'

/** Whole-hours conversion for the observation lines. */
const SECONDS_PER_HOUR = 3600

/**
 * One recorded severance in the eternal history (D24 — mirrors
 * stores/soul.ts SeveranceHistoryRow). `severable` is an Act II piece key
 * (a superset of the store's SeverableKey — includes 'manifestation' /
 * 'flowingForm'); kept as `string` so this harness stays decoupled from the
 * engine type. Carried as DATA for the future three-lives-transcendence
 * assertions; it has no mechanical effect yet.
 */
export interface SeveranceRecord {
  readonly severable: string
  /** Life number at sever time (1-based, in dynasty order). */
  readonly life: number
}

/**
 * The soul-scoped karma carry (slice 10 / D36 + D40). Karma is SOUL-scoped, so
 * it threads across rebirth alongside the ascent counter. This mirrors exactly
 * what the real karma store (stores/karma.ts) persists between lives:
 *   - `firstsHistory` — canonical first-key → times earned in PRIOR lives (the
 *     n in `base × rⁿ`); both headlines and qualified variants get a key here.
 *   - `balance` — the accumulated karma (signed by type; all v1 income positive).
 *   - `gradeBests` — grade-row → best index earned so far (the personal-best
 *     latch). NOT in the store's own slice: grade-delta rows pay only on
 *     improvement (D40), which the harness resolves against these carried bests
 *     BEFORE calling recordFirst (the store then pays the shipped decay math).
 * The settlement itself always runs through the REAL store (recordFirst /
 * settleLife) — this struct is the carried snapshot, never a re-implementation.
 */
export interface KarmaCarry {
  readonly firstsHistory: Readonly<Record<string, number>>
  readonly balance: number
  readonly gradeBests: Readonly<Record<string, number>>
}

/** The cold-start karma carry: a soul that has earned no firsts. */
export function emptyKarmaCarry(): KarmaCarry {
  return { firstsHistory: {}, balance: 0, gradeBests: {} }
}

/**
 * One life's measured karma income, decomposed by the four D40 classes plus the
 * cumulative balance. Filled by the runLife adapter from the REAL store's
 * receipt (stores/karma.ts previewReceipt/settleLife) — the measured math IS the
 * shipped math. `firedEventKeys` is the distinct KARMA_DATA event keys this life
 * earned (for the roster's unreachable-rows report).
 */
export interface KarmaLifeMeasurement {
  readonly total: number
  readonly milestoneHeadline: number
  readonly milestoneEcho: number
  readonly deedEncounter: number
  readonly gradeDelta: number
  readonly cumulativeBalance: number
  readonly firedEventKeys: readonly string[]
}

/**
 * The persistence bridge: exactly what the soul store carries across a
 * reincarnation. Everything NOT in here is life-scoped and resets.
 */
export interface SoulBridge {
  /** The ascent counter — feeds reclimbGainMult (r=0.70, f=0.05). */
  readonly ascents: number
  /** Severance-ritual (offering) completions — feeds the offering mastery discount (r=0.9, f=0.25). */
  readonly severanceRituals: number
  /** Which severables were cut, per life (data only; no mechanical effect yet). */
  readonly severanceHistory: readonly SeveranceRecord[]
  /** Soul-scoped karma carry (D36 + D40): firsts history + balance + grade bests. */
  readonly karma: KarmaCarry
}

/**
 * What one single-life run reports back to the harness. The `runLife` adapter
 * (pacing.ts) fills this from a real Act I → first-tribulation → Act II run;
 * the harness reads it to advance the bridge and to print observation lines.
 */
export interface LifeResult {
  readonly name: string
  /** Act I duration to the First Tribulation trigger (the per-life headline). */
  readonly hoursToTribulation: number
  readonly actISeconds: number
  readonly actIISeconds: number
  /** Sum of this life's c re-climb segment durations (the carry-acceleration probe). */
  readonly reclimbSeconds: number
  readonly reclimbCount: number
  /** Severance-ritual offerings this life (the delta added to the carried count). */
  readonly offerings: number
  /** Severable piece keys cut this life, in cut order (appended to the history). */
  readonly severedKeys: readonly string[]
  /** soul.ascents after the life (carry-in + this life's n/s cascades). */
  readonly finalAscents: number
  /**
   * This life's measured karma income (D36 + D40). Computed by the adapter from
   * the life's ACTUAL outcomes via the REAL karma store, seeded from the
   * incoming bridge's karma carry — additive, never read by the observation-only
   * printer, so the existing DYNASTY section stays byte-identical.
   */
  readonly karma: KarmaLifeMeasurement
  /**
   * The karma carry AFTER this life settled (firsts history folded, balance
   * paid, grade bests latched). carryForward folds this into the outgoing
   * bridge — the settled history IS what the next life carries.
   */
  readonly settledKarma: KarmaCarry
}

/** One life's slot in a dynasty: what went in, what happened, what carries out. */
export interface DynastyLife {
  readonly lifeNumber: number
  readonly incoming: SoulBridge
  readonly result: LifeResult
  readonly outgoing: SoulBridge
}

/** The cold-start bridge: a soul that has never lived (identity for life 1). */
export function emptyBridge(): SoulBridge {
  return { ascents: 0, severanceRituals: 0, severanceHistory: [], karma: emptyKarmaCarry() }
}

/**
 * Advance the bridge across one life. PURE — never mutates `incoming` (the
 * severance history is copied, so earlier entries can never be rewritten by a
 * later life). The ascent counter is read from the life's final soul state
 * (it grows inside the life via realm.prestige → soul.recordAscent); the
 * ritual count and history accumulate the life's own contribution.
 */
export function carryForward(incoming: SoulBridge, result: LifeResult, lifeNumber: number): SoulBridge {
  const newHistoryRows: SeveranceRecord[] = result.severedKeys.map((severable) => ({
    severable,
    life: lifeNumber,
  }))
  return {
    ascents: result.finalAscents,
    severanceRituals: incoming.severanceRituals + result.offerings,
    severanceHistory: [...incoming.severanceHistory, ...newHistoryRows],
    // Fold the settled karma history: the adapter already ran the REAL store's
    // recordFirst/settleLife against `incoming.karma`, so the outgoing carry is
    // simply this life's settled snapshot (firsts folded, balance paid, bests
    // latched). carryForward stays PURE — no store call here.
    karma: result.settledKarma,
  }
}

/**
 * The dynasty harness: run a sequence of single-life policies, threading the
 * soul bridge from each life into the next. Returns one DynastyLife per policy,
 * in order. Deterministic — no wall-clock or randomness of its own; determinism
 * of the underlying run is the `runLife` adapter's responsibility.
 *
 * @param sequence per-life policies (opaque to the harness — the adapter's type).
 * @param runLife  the single-life run: (policy, incoming bridge) → LifeResult.
 * @param seed     the initial bridge (defaults to a cold-start soul).
 */
export function runDynasty<Policy>(
  sequence: readonly Policy[],
  runLife: (policy: Policy, incoming: SoulBridge) => LifeResult,
  seed: SoulBridge = emptyBridge(),
): DynastyLife[] {
  const lives: DynastyLife[] = []
  let carriedBridge = seed
  for (let sequenceIndex = 0; sequenceIndex < sequence.length; sequenceIndex++) {
    const lifeNumber = sequenceIndex + 1
    const incoming = carriedBridge
    const result = runLife(sequence[sequenceIndex]!, incoming)
    const outgoing = carryForward(incoming, result, lifeNumber)
    lives.push({ lifeNumber, incoming, result, outgoing })
    carriedBridge = outgoing
  }
  return lives
}

/** A named dynasty sequence for the observation-only demo roster. */
export interface DynastySequenceSpec<Policy> {
  readonly label: string
  readonly sequence: readonly Policy[]
}

/**
 * Append the "DYNASTY (observation-only)" section to the sim output. PREVIEW
 * style, mirroring the Act II roster's discipline: observation lines ONLY, no
 * assertions (dynasty assertions await a Gate-D sign-off), and the error token
 * is NEVER emitted (CI greps for it). Pure insertion — prints after every
 * existing section.
 */
export function printDynastySection<Policy>(
  specs: readonly DynastySequenceSpec<Policy>[],
  runLife: (policy: Policy, incoming: SoulBridge) => LifeResult,
): void {
  console.log('\n=== DYNASTY (observation-only; soul-side carry, v1; no assertions — Gate-D gates the assertable form) ===')
  console.log(
    '  A second harness wrapping the single-life sim: a loop of lives with a persistence bridge carrying SOUL-',
  )
  console.log(
    '  scoped state (ascent counter + severance-ritual accumulator + severance history). Life-scoped state resets;',
  )
  console.log(
    '  soul-scoped state carries. v1 scope: soul-side ONLY — karma / world-state / roots / rebirth are design-',
  )
  console.log('  deferred (slice 10) and out of scope. All numbers PREVIEW; nothing asserted.')

  for (const spec of specs) {
    console.log(`\n  -- ${spec.label} (${spec.sequence.length} lives) --`)
    const lives = runDynasty(spec.sequence, runLife)
    for (const life of lives) {
      console.log(
        `  life ${life.lifeNumber} [${life.result.name}]: ` +
          `${life.result.hoursToTribulation.toFixed(2)}h to tribulation ` +
          `(Act I ${life.result.actISeconds.toFixed(0)}s; Act II ${life.result.actIISeconds.toFixed(0)}s; ` +
          `${life.result.reclimbCount} c re-climbs in ${life.result.reclimbSeconds.toFixed(0)}s; ` +
          `${life.result.offerings} offerings)`,
      )
      console.log(
        `    → carried soul: ascents ${life.outgoing.ascents} ` +
          `(in ${life.incoming.ascents}), ritual count ${life.outgoing.severanceRituals} ` +
          `(in ${life.incoming.severanceRituals}), history ${life.outgoing.severanceHistory.length} rows ` +
          `[+${life.result.severedKeys.length}: ${life.result.severedKeys.join(', ') || 'none'}]`,
      )
    }
  }
  console.log(
    '\n  (DYNASTY section end — observation-only. Carry is soul-side: the ascent counter accelerates c re-climbs',
  )
  console.log(
    '   via reclimbGainMult and the ritual count discounts Act II offerings, both compounding across lives.)',
  )
}

// ---- DYNASTY KARMA (measurement) --------------------------------------------
//
// The measure-first deliverable (spec §6.1 / §7 step 2, D40's income-shape
// directive): per-actor karma income across the dynasty sequences, DECOMPOSED by
// the four classes — milestone headlines / milestone echoes / deed+encounter
// firsts / grade deltas — alongside totals + cumulative balance. The SHAPE
// (percent of dynasty income by class) is the D40 check: is karma a
// novelty-incentive (headlines + fresh echoes/deeds dominate) or has it
// collapsed into a performance-incentive (grade deltas dominate)?
//
// PREVIEW discipline (slice-9): observation ONLY, no assertion, and the error
// token is NEVER emitted. Pure insertion — printed AFTER every existing section.
// The income here uses the D41 #1-ruled class bases (src/data/karma.ts:
// milestone 8 / deed 8 / encounter 7 / grade-delta 4, variantShare 0.4, decay
// 0.5) — the Gate-D re-run; ⟨tune⟩ pending the re-run sign-off.

/** Per-class dynasty totals (the shape summary's accumulator). */
interface KarmaShapeTotals {
  milestoneHeadline: number
  milestoneEcho: number
  deedEncounter: number
  gradeDelta: number
  total: number
}

function freshShapeTotals(): KarmaShapeTotals {
  return { milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0, total: 0 }
}

/** Run a sequence and accumulate its per-class dynasty shape + total. */
function measureSequenceKarma<Policy>(
  sequence: readonly Policy[],
  runLife: (policy: Policy, incoming: SoulBridge) => LifeResult,
): { lives: DynastyLife[]; shape: KarmaShapeTotals } {
  const lives = runDynasty(sequence, runLife)
  const shape = freshShapeTotals()
  for (const life of lives) {
    const k = life.result.karma
    shape.milestoneHeadline += k.milestoneHeadline
    shape.milestoneEcho += k.milestoneEcho
    shape.deedEncounter += k.deedEncounter
    shape.gradeDelta += k.gradeDelta
    shape.total += k.total
  }
  return { lives, shape }
}

/** Percent of a dynasty total (0 when the total is 0 — never NaN). */
function pctOf(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

/**
 * Append the "DYNASTY KARMA (measurement)" section. Runs each spec, prints the
 * per-life income + four-class decomposition + cumulative balance, then a
 * per-actor SHAPE summary (percent of dynasty income by class). Finally the
 * breadth-vs-repeat comparison (D36 repeat<breadth, MEASURED not asserted): the
 * repeat sequence's headlines decay ×r per re-earn and its grade deltas dry up
 * once bests latch, so a breadth sequence of equal length + competence out-earns
 * it. `comparison` names the repeat + breadth specs (must be labels in `specs`).
 */
export function printDynastyKarmaSection<Policy>(
  specs: readonly DynastySequenceSpec<Policy>[],
  runLife: (policy: Policy, incoming: SoulBridge) => LifeResult,
  comparison: { readonly repeatLabel: string; readonly breadthLabel: string },
): void {
  console.log(
    '\n=== DYNASTY KARMA (D41-ruled bases 8/8/7/4, variantShare 0.4; D36 breadth>repeat + farm convergence PINNED step-8; class shape is measurement) ===',
  )
  console.log(
    '  Per-actor karma income across the dynasty sequences, decomposed by the four D40 classes (milestone',
  )
  console.log(
    '  headlines / milestone echoes / deed+encounter firsts / grade deltas) + cumulative balance. Income runs',
  )
  console.log(
    '  through the REAL karma store (recordFirst/settleLife, seeded per-life from the soul-scoped karma carry),',
  )
  console.log(
    '  so the measured math IS the shipped math. Bases are the D41 #1 starting points (milestone 8 / deed 8 /',
  )
  console.log('  encounter 7 / grade-delta 4, variantShare 0.4, decay 0.5) — ⟨tune⟩ pending the Gate-D re-run sign-off.')

  const shapeByLabel = new Map<string, KarmaShapeTotals>()
  const livesByLabel = new Map<string, DynastyLife[]>()
  for (const spec of specs) {
    const { lives, shape } = measureSequenceKarma(spec.sequence, runLife)
    shapeByLabel.set(spec.label, shape)
    livesByLabel.set(spec.label, lives)

    console.log(`\n  -- ${spec.label} (${spec.sequence.length} lives) --`)
    for (const life of lives) {
      const k = life.result.karma
      console.log(
        `  life ${life.lifeNumber} [${life.result.name}]: income ${k.total.toFixed(2)} ` +
          `(milestone headline ${k.milestoneHeadline.toFixed(2)}, echo ${k.milestoneEcho.toFixed(2)}, ` +
          `deed+encounter ${k.deedEncounter.toFixed(2)}, grade delta ${k.gradeDelta.toFixed(2)}) ` +
          `→ balance ${k.cumulativeBalance.toFixed(2)}`,
      )
    }
    console.log(
      `    SHAPE: dynasty income ${shape.total.toFixed(2)} = ` +
        `milestone headline ${pctOf(shape.milestoneHeadline, shape.total)}, ` +
        `milestone echo ${pctOf(shape.milestoneEcho, shape.total)}, ` +
        `deed+encounter ${pctOf(shape.deedEncounter, shape.total)}, ` +
        `grade delta ${pctOf(shape.gradeDelta, shape.total)}`,
    )
    const noveltyShare =
      shape.milestoneHeadline + shape.milestoneEcho + shape.deedEncounter
    console.log(
      `    D40 read: novelty classes (headline+echo+deed+encounter) ${pctOf(noveltyShare, shape.total)} ` +
        `vs grade deltas ${pctOf(shape.gradeDelta, shape.total)} ` +
        `(${noveltyShare >= shape.gradeDelta ? 'novelty-weighted' : 'performance-weighted'}).`,
    )
  }

  // Breadth-vs-repeat (D36 repeat<breadth at equal length + competence).
  // PREVIEW→PINNED (Gate-D step-8, D43 #5): the direction is now ASSERTED —
  // breadth strictly out-earns an equal-length, equal-competence repeat. The
  // exact ratio stays measured (D41 signed 1.14× as the honest structural
  // ceiling; only the DIRECTION is the invariant). FAIL prints to STDOUT so CI
  // gates (the sim's stdout-only grep; see pacing.ts's step-8 FINDING).
  const repeat = shapeByLabel.get(comparison.repeatLabel)
  const breadth = shapeByLabel.get(comparison.breadthLabel)
  if (repeat && breadth) {
    console.log('\n  -- breadth vs repeat (D36 repeat<breadth; equal length + competence; PINNED — direction asserted) --')
    console.log(
      `  repeat  [${comparison.repeatLabel}]: dynasty income ${repeat.total.toFixed(2)} ` +
        `(headlines decay ×KARMA_DECAY_RATIO per re-earn; grade deltas dry up once bests latch).`,
    )
    console.log(
      `  breadth [${comparison.breadthLabel}]: dynasty income ${breadth.total.toFixed(2)} ` +
        `(distinct builds ring distinct headlines/deeds — fresh firsts pay full base).`,
    )
    const delta = breadth.total - repeat.total
    const ratio = repeat.total > 0 ? breadth.total / repeat.total : 0
    // ASSERT (D36): breadth > repeat. PIN: delta > 0 (measured +27.60, ratio 1.14×).
    console.log(
      `  ASSERT breadth > repeat: breadth − repeat = ${delta.toFixed(2)} ` +
        `(breadth/repeat = ${ratio.toFixed(2)}×) → ${delta > 0 ? 'PASS' : 'FAIL'} ` +
        `(${delta > 0 ? 'breadth out-earns repeat, the D36 direction — exact ratio measured, only the sign is pinned' : 'repeat ≥ breadth — the D36 direction inverted; report before retuning'}).`,
    )
  }

  // Farm-income convergence (D36 "farm income converges"; PREVIEW→PINNED step-8).
  // A repeat dynasty's per-life income is bounded: headlines decay ×r per re-earn
  // and grade deltas dry up once bests latch, so income is non-increasing life to
  // life and the cumulative is bounded by the geometric ceiling life-1 / (1 − r)
  // (each post-first life ≤ life-1 × rⁿ). Two invariants, both asserted.
  const repeatLives = livesByLabel.get(comparison.repeatLabel)
  if (repeatLives && repeatLives.length >= 2) {
    const incomes = repeatLives.map((life) => life.result.karma.total)
    const cumulative = incomes.reduce((sum, income) => sum + income, 0)
    const EPSILON = 1e-9
    let nonIncreasing = true
    for (let index = 1; index < incomes.length; index++) {
      if (incomes[index]! > incomes[index - 1]! + EPSILON) nonIncreasing = false
    }
    const geometricCeiling = incomes[0]! / (1 - KARMA_DECAY_RATIO)
    const bounded = cumulative <= geometricCeiling + EPSILON
    const converges = nonIncreasing && bounded
    console.log('\n  -- farm-income convergence (D36; repeat income bounded; PINNED — asserted) --')
    console.log(
      `  repeat per-life income [${comparison.repeatLabel}]: ${incomes.map((income) => income.toFixed(2)).join(' → ')} ` +
        `(non-increasing: ${nonIncreasing ? 'yes' : 'NO'}); cumulative ${cumulative.toFixed(2)} vs geometric ceiling ` +
        `life-1/(1−r) = ${geometricCeiling.toFixed(2)} (r = ${KARMA_DECAY_RATIO}).`,
    )
    // ASSERT (D36): income non-increasing AND cumulative ≤ life-1/(1−r) — a finite
    // farm ceiling even over an unbounded repeat. PIN: 113.60→52.80→26.40, Σ 192.80 ≤ 227.20.
    console.log(
      `  ASSERT farm income converges: ${converges ? 'PASS' : 'FAIL'} ` +
        `(${converges ? 'per-life income decays and the cumulative stays under the geometric ceiling — the farm has a finite karma horizon' : 'repeat income is NOT bounded by the decay ceiling; report before retuning'}).`,
    )
  }

  console.log(
    '\n  (DYNASTY KARMA section end — D36 breadth>repeat + farm convergence now PINNED (D43 #5); the class shape stays measurement (D40). A breach prints the CI-fatal token on stdout.)',
  )
}

export { SECONDS_PER_HOUR }
