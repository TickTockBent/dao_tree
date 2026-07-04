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
  return { ascents: 0, severanceRituals: 0, severanceHistory: [] }
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

export { SECONDS_PER_HOUR }
