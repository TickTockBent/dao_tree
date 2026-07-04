import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useSoulStore, freshSoulSlice } from '@/stores/soul'
import { useGameStore } from '@/stores/game'
import { useRealmStore } from '@/stores/realm'
import { ACCUMULATOR_DATA } from '@/data/accumulators'

// r/f are read from data — the tests must never hardcode 0.70/0.05 as bare
// literals divorced from the source (they are pinned in data-port.test.ts).
const ASCENT_RATIO = ACCUMULATOR_DATA.ascentCounter.ratio! // r = 0.70 (D21)
const ASCENT_FLOOR = ACCUMULATOR_DATA.ascentCounter.floor! // f = 0.05 (D21)
const GAIN_CAP = 1 / ASCENT_FLOOR // 1/f = 20× — the mastered ceiling / optimizer bound

describe('soul store: fresh slice shape', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with zero ascents, zero rituals, empty history', () => {
    const soul = useSoulStore()
    expect(soul.ascents).toBe(0)
    expect(soul.severanceRituals).toBe(0)
    expect(soul.severanceHistory).toEqual([])
  })

  it('freshSoulSlice matches the initial store state', () => {
    expect(freshSoulSlice()).toEqual({
      ascents: 0,
      severanceRituals: 0,
      severanceHistory: [],
      // Slice 10 / D36+D37 soul-side additions.
      rebirths: 0,
      trialsEndured: {},
      walkedManifestations: 0,
    })
  })

  it('exposes the slice-10 soul-side fields, all zero on a fresh soul', () => {
    const soul = useSoulStore()
    expect(soul.rebirths).toBe(0)
    expect(soul.trialsEndured).toEqual({})
    expect(soul.walkedManifestations).toBe(0)
  })
})

describe('soul store: slice-10 soul-side recorders (D36/D37)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('recordRebirth latches the rebirth counter upward', () => {
    const soul = useSoulStore()
    soul.recordRebirth()
    soul.recordRebirth()
    expect(soul.rebirths).toBe(2)
  })

  it('recordTrialEndured accumulates per-trial-key endurance counts', () => {
    const soul = useSoulStore()
    soul.recordTrialEndured('whisperingDoubt')
    soul.recordTrialEndured('whisperingDoubt')
    soul.recordTrialEndured('hollowCrown')
    expect(soul.trialsEndured).toEqual({ whisperingDoubt: 2, hollowCrown: 1 })
  })

  it('recordWalkedManifestations adds to the walked-path accumulator (ignores non-positive)', () => {
    const soul = useSoulStore()
    soul.recordWalkedManifestations(3)
    soul.recordWalkedManifestations(2)
    soul.recordWalkedManifestations(0)
    soul.recordWalkedManifestations(-5)
    expect(soul.walkedManifestations).toBe(5)
  })

  it('round-trips the slice-10 fields through save/load', () => {
    const soul = useSoulStore()
    soul.recordRebirth()
    soul.recordTrialEndured('hungryShadow')
    soul.recordWalkedManifestations(4)
    const saved = soul.save()

    setActivePinia(createPinia())
    const reloaded = useSoulStore()
    reloaded.load(saved)
    expect(reloaded.rebirths).toBe(1)
    expect(reloaded.trialsEndured).toEqual({ hungryShadow: 1 })
    expect(reloaded.walkedManifestations).toBe(4)
  })

  it('load(undefined) defaults the slice-10 fields (older saves have none)', () => {
    const soul = useSoulStore()
    soul.load(undefined)
    expect(soul.rebirths).toBe(0)
    expect(soul.trialsEndured).toEqual({})
    expect(soul.walkedManifestations).toBe(0)
  })

  it('load of an OLD soul slice (pre-slice-10) fills the new fields cleanly', () => {
    const soul = useSoulStore()
    soul.load({ ascents: 3, severanceRituals: 1, severanceHistory: [{ severable: 'soulAspect', life: 1 }] })
    expect(soul.ascents).toBe(3)
    expect(soul.rebirths).toBe(0)
    expect(soul.trialsEndured).toEqual({})
    expect(soul.walkedManifestations).toBe(0)
  })
})

describe('soul store: recorders', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('recordAscent increments the ascent counter', () => {
    const soul = useSoulStore()
    soul.recordAscent()
    soul.recordAscent()
    expect(soul.ascents).toBe(2)
  })

  it('recordSeveranceRitual increments the ritual counter', () => {
    const soul = useSoulStore()
    soul.recordSeveranceRitual()
    expect(soul.severanceRituals).toBe(1)
  })

  it('recordSeverance appends an eternal history row (severable + life)', () => {
    const soul = useSoulStore()
    soul.recordSeverance('soulAspect', 1)
    soul.recordSeverance('profession', 1)
    expect(soul.severanceHistory).toEqual([
      { severable: 'soulAspect', life: 1 },
      { severable: 'profession', life: 1 },
    ])
  })
})

describe('soul store: reclimbGainMult ("the core remembers")', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is identity for every realm at 0 ascents (c has never been re-climbed)', () => {
    const soul = useSoulStore()
    for (const realmId of ['q', 'f', 'c', 'n', 's', 'x'] as const) {
      expect(soul.reclimbGainMult(realmId).toNumber()).toBe(1)
    }
  })

  it('is identity for non-c realms even after ascents accrue', () => {
    const soul = useSoulStore()
    for (let i = 0; i < 5; i++) soul.recordAscent()
    for (const realmId of ['q', 'f', 'n', 's', 'x'] as const) {
      expect(soul.reclimbGainMult(realmId).toNumber()).toBe(1)
    }
  })

  it('is identity for c on the FIRST re-climb (ascents === 1, k=1 → (1/r)^0)', () => {
    // The deliberate off-by-one: `ascents` increments at wipe time, so the first
    // re-climb runs at ascents === 1 and must be unscaled — never (1/r)^(−1).
    const soul = useSoulStore()
    soul.recordAscent()
    expect(soul.reclimbGainMult('c').toNumber()).toBe(1)
  })

  it('grows as (1/r)^(ascents−1) at k=2 and k=3 (hand-computed)', () => {
    const soul = useSoulStore()
    const oneOverRatio = 1 / ASCENT_RATIO // ≈ 1.4285714 for r = 0.70

    soul.recordAscent() // ascents = 1 (k=1, identity)
    soul.recordAscent() // ascents = 2 (k=2 → (1/r)^1)
    expect(soul.reclimbGainMult('c').toNumber()).toBeCloseTo(oneOverRatio, 10)

    soul.recordAscent() // ascents = 3 (k=3 → (1/r)^2)
    expect(soul.reclimbGainMult('c').toNumber()).toBeCloseTo(oneOverRatio * oneOverRatio, 10)
  })

  it('caps at 1/f (= 20×) at high k', () => {
    const soul = useSoulStore()
    // ascents = 20 → (1/0.7)^19 ≫ 20, so the floor f clamps the gain to exactly 1/f.
    for (let i = 0; i < 20; i++) soul.recordAscent()
    expect(soul.reclimbGainMult('c').toNumber()).toBe(GAIN_CAP)
    expect(soul.reclimbGainMult('c').eq(new Decimal(GAIN_CAP))).toBe(true)
  })

  it('reaches the cap exactly at the first k where (1/r)^(k−1) ≥ 1/f, not before', () => {
    const soul = useSoulStore()
    const oneOverRatio = 1 / ASCENT_RATIO
    // For r=0.70, f=0.05: (1/r)^8 ≈ 17.34 < 20 (uncapped at ascents=9);
    // (1/r)^9 ≈ 24.8 > 20 (capped at ascents=10). Proves the min() boundary.
    for (let i = 0; i < 9; i++) soul.recordAscent() // ascents = 9 → (1/r)^8
    expect(soul.reclimbGainMult('c').toNumber()).toBeCloseTo(Math.pow(oneOverRatio, 8), 8)
    expect(soul.reclimbGainMult('c').toNumber()).toBeLessThan(GAIN_CAP)
    soul.recordAscent() // ascents = 10 → (1/r)^9 clamps to the cap
    expect(soul.reclimbGainMult('c').toNumber()).toBe(GAIN_CAP)
  })
})

describe('soul store: save/load round-trip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('round-trips ascents, rituals, and history', () => {
    const soul = useSoulStore()
    soul.recordAscent()
    soul.recordAscent()
    soul.recordSeveranceRitual()
    soul.recordSeverance('extraordinaryMeridians', 1)
    const saved = soul.save()

    setActivePinia(createPinia())
    const reloaded = useSoulStore()
    reloaded.load(saved)
    expect(reloaded.ascents).toBe(2)
    expect(reloaded.severanceRituals).toBe(1)
    expect(reloaded.severanceHistory).toEqual([{ severable: 'extraordinaryMeridians', life: 1 }])
  })

  it('load(undefined) yields the fresh slice (old saves have no soul slice)', () => {
    const soul = useSoulStore()
    soul.load(undefined)
    expect(soul.ascents).toBe(0)
    expect(soul.severanceRituals).toBe(0)
    expect(soul.severanceHistory).toEqual([])
  })
})

describe('soul store: ascent counting from the n/s prestige cascade', () => {
  beforeEach(() => {
    bootTestStores()
  })

  // Give c live progress (unlocked + points) and make n resettable, then prestige
  // n so its doReset cascade wipes c. realm.ts records the ascent only when the
  // cascade wipes LIVE c progress (mirrors the sim's re-climb-segment definition).
  const N_REQ_BASE_HEADROOM = 2_000_000 // > n.reqBase (1e6) so canReset('n') holds

  function makeNResettable(): void {
    const realm = useRealmStore()
    const game = useGameStore()
    realm.slice['n'] = { ...realm.stateOf('n'), unlocked: true }
    game.points = new Decimal(N_REQ_BASE_HEADROOM)
    expect(realm.canReset('n')).toBe(true)
  }

  it('increments ascents when an n cascade wipes live c progress', () => {
    const realm = useRealmStore()
    const soul = useSoulStore()
    realm.slice['c'] = { ...realm.stateOf('c'), unlocked: true, points: new Decimal(500).toString(), best: '5' }
    makeNResettable()

    realm.prestige('n')

    expect(realm.realmBest('c').toNumber()).toBe(0) // c was wiped by the cascade
    expect(soul.ascents).toBe(1)
  })

  it('does NOT increment ascents when c was already empty at cascade time', () => {
    const realm = useRealmStore()
    const soul = useSoulStore()
    realm.slice['c'] = { ...realm.stateOf('c'), unlocked: true, points: '0', best: '0' }
    makeNResettable()

    realm.prestige('n')

    expect(soul.ascents).toBe(0)
  })
})
