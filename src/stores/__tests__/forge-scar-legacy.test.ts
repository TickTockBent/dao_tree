import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { useForgeStore } from '@/stores/forge'
import { useRealmStore } from '@/stores/realm'
import { useBodyStore } from '@/stores/body'
import { useScarStore } from '@/stores/scar'
import { useTribulationStore } from '@/stores/tribulation'
import { useLegacyStore } from '@/stores/legacy'
import { SETPIECE_DATA } from '@/data/setpieces'

// ---- Forge -----------------------------------------------------------------

describe('forge store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no core forged', () => {
    const forge = useForgeStore()
    expect(forge.coreIsForged).toBe(false)
    expect(forge.coreGradeMult.toNumber()).toBe(1)
  })

  it('forge is not available without Foundation fuel', () => {
    const forge = useForgeStore()
    const realm = useRealmStore()
    // Even if c is unlocked, need f.points >= forgeReq (25).
    realm.slice.c = { ...realm.slice.c, unlocked: true }
    expect(forge.forgeIsAvailable).toBe(false)
  })

  it('performForge spends fuel and produces a core grade', () => {
    const forge = useForgeStore()
    const realm = useRealmStore()
    const body = useBodyStore()

    // Set up: c unlocked, f.points >= forgeReq, foundation grade set so baseCore/ceiling resolve.
    realm.slice.c = { ...realm.slice.c, unlocked: true }
    realm.slice.f = { ...realm.slice.f, points: '100', unlocked: true }
    body.foundationGrade = 0 // Flawed band: baseCore=cracked, ceiling=lower

    const result = forge.performForge('steady')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(body.coreGrade).toBeGreaterThanOrEqual(0)
    // Fuel spent: fuelBase × fuelMult(1) = 25. 100 - 25 = 75.
    expect(new Decimal(realm.stateOf('f').points).toNumber()).toBe(75)
  })

  it('cannot forge twice (one-time event)', () => {
    const forge = useForgeStore()
    const realm = useRealmStore()
    const body = useBodyStore()

    realm.slice.c = { ...realm.slice.c, unlocked: true }
    realm.slice.f = { ...realm.slice.f, points: '1000', unlocked: true }
    body.foundationGrade = 0

    forge.performForge('steady')
    expect(forge.coreIsForged).toBe(true)
    expect(forge.forgeIsAvailable).toBe(false)
  })

  it('coreGradeMult reflects the forged grade', () => {
    const forge = useForgeStore()
    const body = useBodyStore()
    // Manually set a core grade.
    body.coreGrade = 2 // middle = ×4
    expect(forge.coreGradeMult.toNumber()).toBe(4)
  })

  it('refinement raises the core grade one tier per full bar', () => {
    const forge = useForgeStore()
    const body = useBodyStore()
    body.coreGrade = 0 // cracked
    body.foundationGrade = 2 // Solid band: ceiling = upper (index 3)
    forge.warming = true
    // goal=100, ratePerSecond=1 → 100 seconds = 1 tier.
    forge.refinementTick(100)
    expect(body.coreGrade).toBe(1) // cracked → lower
  })

  it('refinement stops at the ceiling', () => {
    const forge = useForgeStore()
    const body = useBodyStore()
    body.coreGrade = 2 // middle
    body.foundationGrade = 0 // Flawed: ceiling = lower (index 1)
    // Wait — ceiling < current? That shouldn't happen in practice (forge clamps).
    // Set ceiling above current.
    body.foundationGrade = 2 // Solid: ceiling = upper (index 3)
    forge.warming = true
    forge.refinementTick(100)
    expect(body.coreGrade).toBe(3) // middle → upper
    // Next tick should NOT raise beyond ceiling.
    forge.refinementTick(100)
    expect(body.coreGrade).toBe(3)
    expect(forge.refinementCanProgress).toBe(false)
  })
})

// ---- Scar ------------------------------------------------------------------

describe('scar store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts inactive with identity multipliers', () => {
    const scar = useScarStore()
    expect(scar.scarIsActive).toBe(false)
    expect(scar.scarQiMult.toNumber()).toBe(1)
    expect(scar.temperedQiMult.toNumber()).toBe(1)
  })

  it('deepenScar increases depth and resets heal progress', () => {
    const scar = useScarStore()
    const body = useBodyStore()
    body.scarHealProgress = 50
    scar.deepenScar()
    expect(body.scarDepth).toBe(1)
    expect(body.scarHealProgress).toBe(0)
  })

  it('deepenScar caps at maxDepth', () => {
    const scar = useScarStore()
    const body = useBodyStore()
    const maxDepth = SETPIECE_DATA.scar.maxDepth
    for (let i = 0; i < maxDepth + 5; i++) scar.deepenScar()
    expect(body.scarDepth).toBe(maxDepth)
  })

  it('scarQiMult is < 1 while active (debuff)', () => {
    const scar = useScarStore()
    scar.deepenScar()
    expect(scar.scarQiMult.toNumber()).toBeLessThan(1)
    expect(scar.scarQiMult.toNumber()).toBeGreaterThan(0)
  })

  it('scarHealTick converts depth to healedDepth over time', () => {
    const scar = useScarStore()
    const body = useBodyStore()
    scar.deepenScar() // depth=1
    // healGoal = healGoalPerDepth × (healedDepth + 1) = 240 × 1 = 240.
    // healRate = 1/sec → 240 seconds = 1 depth healed.
    scar.scarHealTick(240)
    expect(body.scarHealedDepth).toBe(1)
    expect(scar.scarIsActive).toBe(false) // fully healed
    // temperedQiMult should now be > 1 (permanent buff).
    expect(scar.temperedQiMult.toNumber()).toBeGreaterThan(1)
  })

  it('scarQiMult returns to 1 after full heal', () => {
    const scar = useScarStore()
    scar.deepenScar()
    scar.scarHealTick(240)
    expect(scar.scarQiMult.toNumber()).toBe(1)
  })
})

// ---- Legacy ----------------------------------------------------------------

describe('legacy store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no grade (qiMult = 1)', () => {
    const legacy = useLegacyStore()
    expect(legacy.actOneGrade).toBe(-1)
    expect(legacy.legacyQiMult.toNumber()).toBe(1)
  })

  it('actOneLegacyScore is 0 with no progress', () => {
    const legacy = useLegacyStore()
    expect(legacy.actOneLegacyScore().toNumber()).toBe(0)
  })

  it('computeAndStoreActOneLegacy stores the band and never downgrades', () => {
    const legacy = useLegacyStore()
    const body = useBodyStore()
    const trib = useTribulationStore()

    // Give some inputs: core grade + tribulation grade.
    body.coreGrade = 4 // perfect
    trib.tribGrade = 3 // flawless
    body.soulAspect = 'formless'

    legacy.computeAndStoreActOneLegacy()
    expect(legacy.actOneGrade).toBeGreaterThanOrEqual(0)
    const firstGrade = legacy.actOneGrade

    // A weaker re-compute should NOT downgrade.
    body.coreGrade = 0
    trib.tribGrade = 1
    legacy.computeAndStoreActOneLegacy()
    expect(legacy.actOneGrade).toBe(firstGrade)
  })

  it('legacyQiMult reflects the stored band', () => {
    const legacy = useLegacyStore()
    const body = useBodyStore()
    const trib = useTribulationStore()

    body.coreGrade = 4
    trib.tribGrade = 3
    body.soulAspect = 'formless'

    legacy.computeAndStoreActOneLegacy()
    expect(legacy.legacyQiMult.toNumber()).toBeGreaterThanOrEqual(1)
  })
})
