// src/sim/__tests__/dynasty.test.ts — the multi-life (dynasty) harness.
//
// Two layers of coverage:
//  - HARNESS logic (runDynasty / carryForward) with a fast deterministic fake
//    single-life run — determinism + history accumulation + no-mutation.
//  - REAL sim carry: runLifeToTribulation (a full Act I → tribulation → Act II
//    run) imported from pacing.ts. Importing pacing.ts is SAFE — the main-module
//    guard at its EOF means the import does not re-run the whole sim.

import { describe, it, expect } from 'vitest'
import {
  runDynasty,
  carryForward,
  emptyBridge,
  type SoulBridge,
  type LifeResult,
} from '../dynasty'
import { runLifeToTribulation, DYNASTY_COMPETENT_POLICY } from '../pacing'

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
