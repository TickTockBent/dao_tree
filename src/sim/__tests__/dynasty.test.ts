// src/sim/__tests__/dynasty.test.ts — the multi-life (dynasty) harness.
//
// Two layers of coverage:
//  - HARNESS logic (runDynasty / carryForward) with a fast deterministic fake
//    single-life run — determinism + history accumulation + no-mutation.
//  - REAL sim carry: runLifeToTribulation (a full Act I → tribulation → Act II
//    run) imported from pacing.ts. Importing pacing.ts is SAFE — the main-module
//    guard at its EOF means the import does not re-run the whole sim.

import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  runDynasty,
  carryForward,
  emptyBridge,
  emptyKarmaCarry,
  type SoulBridge,
  type LifeResult,
  type KarmaLifeMeasurement,
} from '../dynasty'
import {
  runLifeToTribulation,
  DYNASTY_COMPETENT_POLICY,
  settleLifeKarma,
  type LifeKarmaFirsts,
} from '../pacing'
import { KARMA_DECAY_RATIO, VARIANT_SHARE } from '@/data/karma'

// A full real-sim boot per life; give the integration tests generous headroom.
const REAL_SIM_TIMEOUT_MS = 120000

// ---- Fast deterministic fake single-life run (harness-logic tests) ----------
interface FakePolicy {
  readonly name: string
  readonly severs: readonly string[]
}
// Pure + deterministic: carried ascents make the re-climb strictly faster (the
// carry direction), and every life adds a fixed ascent/offering contribution.
const FAKE_ASCENTS_PER_LIFE = 5
const FAKE_OFFERINGS_PER_LIFE = 12
const FAKE_BASE_RECLIMB_SECONDS = 5000
const FAKE_RECLIMB_SPEEDUP_PER_ASCENT = 10
// A fixed fake karma measurement + carry (the harness-logic tests exercise the
// bridge threading, not the income math — the real math is covered separately).
const FAKE_KARMA_MEASUREMENT: KarmaLifeMeasurement = {
  total: 0,
  milestoneHeadline: 0,
  milestoneEcho: 0,
  deedEncounter: 0,
  gradeDelta: 0,
  cumulativeBalance: 0,
  firedEventKeys: [],
}
function fakeRunLife(policy: FakePolicy, incoming: SoulBridge): LifeResult {
  return {
    name: policy.name,
    hoursToTribulation: 10,
    actISeconds: 36000,
    actIISeconds: 1000,
    reclimbSeconds: Math.max(
      0,
      FAKE_BASE_RECLIMB_SECONDS - incoming.ascents * FAKE_RECLIMB_SPEEDUP_PER_ASCENT,
    ),
    reclimbCount: 3,
    offerings: FAKE_OFFERINGS_PER_LIFE,
    severedKeys: [...policy.severs],
    finalAscents: incoming.ascents + FAKE_ASCENTS_PER_LIFE,
    karma: FAKE_KARMA_MEASUREMENT,
    settledKarma: emptyKarmaCarry(),
  }
}

const FAKE_A: FakePolicy = { name: 'A', severs: ['soulAspect', 'manifestation'] }
const FAKE_B: FakePolicy = { name: 'B', severs: ['soulAspect', 'profession'] }

describe('runDynasty (harness logic, fake single-life run)', () => {
  it('is deterministic — two dynasty runs produce identical results', () => {
    const sequence = [FAKE_A, FAKE_B, FAKE_A]
    const firstRun = runDynasty(sequence, fakeRunLife)
    const secondRun = runDynasty(sequence, fakeRunLife)
    expect(secondRun).toEqual(firstRun)
  })

  it('threads the carried ascent counter into each subsequent life', () => {
    const lives = runDynasty([FAKE_A, FAKE_A, FAKE_A], fakeRunLife)
    expect(lives[0]!.incoming.ascents).toBe(0)
    expect(lives[1]!.incoming.ascents).toBe(FAKE_ASCENTS_PER_LIFE)
    expect(lives[2]!.incoming.ascents).toBe(FAKE_ASCENTS_PER_LIFE * 2)
    // The ritual accumulator compounds too.
    expect(lives[2]!.incoming.severanceRituals).toBe(FAKE_OFFERINGS_PER_LIFE * 2)
  })

  it('accumulates severance history across lives without mutating earlier entries', () => {
    const lives = runDynasty([FAKE_A, FAKE_B, FAKE_A], fakeRunLife)

    // Length grows by each life's cut count; life numbers are tagged in order.
    expect(lives[0]!.outgoing.severanceHistory).toHaveLength(2)
    expect(lives[1]!.outgoing.severanceHistory).toHaveLength(4)
    expect(lives[2]!.outgoing.severanceHistory).toHaveLength(6)
    expect(lives[2]!.outgoing.severanceHistory.map((row) => row.life)).toEqual([1, 1, 2, 2, 3, 3])
    expect(lives[2]!.outgoing.severanceHistory.map((row) => row.severable)).toEqual([
      'soulAspect',
      'manifestation',
      'soulAspect',
      'profession',
      'soulAspect',
      'manifestation',
    ])

    // Earlier lives' recorded history is a stable prefix — never rewritten by a
    // later life (the first two rows are identical across every snapshot).
    expect(lives[1]!.outgoing.severanceHistory.slice(0, 2)).toEqual(
      lives[0]!.outgoing.severanceHistory,
    )
    expect(lives[2]!.outgoing.severanceHistory.slice(0, 4)).toEqual(
      lives[1]!.outgoing.severanceHistory,
    )
  })

  it('carryForward is pure — it never mutates the incoming bridge', () => {
    const incoming = emptyBridge()
    const result = fakeRunLife(FAKE_A, incoming)
    const frozenHistoryRef = incoming.severanceHistory
    const outgoing = carryForward(incoming, result, 1)
    expect(incoming.ascents).toBe(0)
    expect(incoming.severanceRituals).toBe(0)
    expect(incoming.severanceHistory).toBe(frozenHistoryRef)
    expect(incoming.severanceHistory).toHaveLength(0)
    expect(outgoing.severanceHistory).toHaveLength(2)
  })
})

describe('dynasty carry (real single-life sim)', () => {
  it(
    'cold-start identity — a 1-life dynasty with an empty bridge matches the single-life run',
    () => {
      const directRun = runLifeToTribulation(DYNASTY_COMPETENT_POLICY, emptyBridge())
      const dynastyLives = runDynasty([DYNASTY_COMPETENT_POLICY], runLifeToTribulation)
      expect(dynastyLives).toHaveLength(1)
      expect(dynastyLives[0]!.result).toEqual(directRun)
    },
    REAL_SIM_TIMEOUT_MS,
  )

  it(
    'carry effect — life 2 (carried ascents) re-climbs the core no slower than life 1',
    () => {
      const lives = runDynasty(
        [DYNASTY_COMPETENT_POLICY, DYNASTY_COMPETENT_POLICY],
        runLifeToTribulation,
      )
      const lifeOne = lives[0]!
      const lifeTwo = lives[1]!

      // The carry actually happened: life 2 starts with life 1's ascents.
      expect(lifeOne.incoming.ascents).toBe(0)
      expect(lifeTwo.incoming.ascents).toBeGreaterThan(0)
      expect(lifeTwo.incoming.ascents).toBe(lifeOne.result.finalAscents)

      // Acceleration DIRECTION (not magnitude): carried ascents can only make the
      // c re-climb faster (reclimbGainMult multiplies gain by >= 1), never slower.
      expect(lifeTwo.result.reclimbSeconds).toBeLessThanOrEqual(lifeOne.result.reclimbSeconds)
      expect(lifeTwo.result.hoursToTribulation).toBeLessThanOrEqual(
        lifeOne.result.hoursToTribulation,
      )
    },
    REAL_SIM_TIMEOUT_MS,
  )
})

// ---- Karma income settlement (real karma store; the shipped receipt math) ----
//
// settleLifeKarma seeds the REAL karma store from the carried soul-scoped karma
// and calls the shipped recordFirst/settleLife — so these assert the measured
// math IS the shipped math. Fast (no sim boot); each test owns a fresh pinia.

/** A one-milestone firsts profile (headline + one buildMark echo), no grades. */
function milestoneFirsts(): LifeKarmaFirsts {
  return {
    nonGrade: [{ key: 'reachRealm:q', qualifiers: { rootShape: 'rootless', buildMark: 'meridian' } }],
    gradeValues: [],
    buildMark: 'meridian',
  }
}

/** A mixed profile: a milestone (headline+echo), a deed (headline-only), a grade. */
function mixedFirsts(foundationGrade: number): LifeKarmaFirsts {
  return {
    nonGrade: [
      { key: 'reachRealm:q', qualifiers: { rootShape: 'rootless', buildMark: 'meridian' } },
      { key: 'severed:soulAspect', qualifiers: {} },
    ],
    gradeValues: [['foundationGradeDelta', foundationGrade]],
    buildMark: 'meridian',
  }
}

describe('karma income settlement (real karma store)', () => {
  it('is deterministic — identical inputs settle to identical measurement + carry', () => {
    setActivePinia(createPinia())
    const runA = settleLifeKarma(emptyKarmaCarry(), mixedFirsts(2))
    setActivePinia(createPinia())
    const runB = settleLifeKarma(emptyKarmaCarry(), mixedFirsts(2))
    expect(runB.measurement).toEqual(runA.measurement)
    expect(runB.carry).toEqual(runA.carry)
  })

  it('decomposition sums to total (the four classes reconstruct the income)', () => {
    setActivePinia(createPinia())
    const { measurement } = settleLifeKarma(emptyKarmaCarry(), mixedFirsts(2))
    const sum =
      measurement.milestoneHeadline +
      measurement.milestoneEcho +
      measurement.deedEncounter +
      measurement.gradeDelta
    expect(sum).toBeCloseTo(measurement.total, 10)
    expect(measurement.total).toBeGreaterThan(0)
  })

  it('a repeat life pays a re-earned first × KARMA_DECAY_RATIO (headline AND echo decay)', () => {
    setActivePinia(createPinia())
    const lifeOne = settleLifeKarma(emptyKarmaCarry(), milestoneFirsts())
    // Carry life 1's settled history into life 2, re-earning the SAME first.
    const lifeTwo = settleLifeKarma(lifeOne.carry, milestoneFirsts())
    // Both the headline (base·r) and its echo (VARIANT_SHARE·base·r) decay by r,
    // so the whole re-earned income scales by exactly KARMA_DECAY_RATIO.
    expect(lifeTwo.measurement.total).toBeCloseTo(lifeOne.measurement.total * KARMA_DECAY_RATIO, 10)
    expect(KARMA_DECAY_RATIO).toBeLessThan(1)
    // Sanity: the echo is a real fraction of the headline (VARIANT_SHARE), i.e.
    // the milestone genuinely rang both a headline and an echo.
    expect(lifeOne.measurement.milestoneEcho).toBeCloseTo(
      lifeOne.measurement.milestoneHeadline * VARIANT_SHARE,
      10,
    )
  })

  it('grade deltas pay only on a personal-best improvement across lives', () => {
    setActivePinia(createPinia())
    // Life 1: first-ever foundation grade 2 → the delta fires.
    const lifeOne = settleLifeKarma(emptyKarmaCarry(), mixedFirsts(2))
    expect(lifeOne.measurement.gradeDelta).toBeGreaterThan(0)
    expect(lifeOne.carry.gradeBests['foundationGradeDelta']).toBe(2)

    // Life 2: SAME grade 2 (no improvement) → the delta dries up (pays nothing).
    const lifeTwo = settleLifeKarma(lifeOne.carry, mixedFirsts(2))
    expect(lifeTwo.measurement.gradeDelta).toBe(0)
    expect(lifeTwo.carry.gradeBests['foundationGradeDelta']).toBe(2)

    // Life 3: a NEW personal best (grade 4) → the delta fires again + best latches.
    const lifeThree = settleLifeKarma(lifeTwo.carry, mixedFirsts(4))
    expect(lifeThree.measurement.gradeDelta).toBeGreaterThan(0)
    expect(lifeThree.carry.gradeBests['foundationGradeDelta']).toBe(4)
  })
})
