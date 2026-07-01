// src/stores/__tests__/secretRealm.test.ts — Secret Realm expeditions (slice 7).
//
// Deterministic-by-design: no RNG, so every reward number is derived FROM
// SECRET_REALM_DATA fields (never copied literals). The exact-number happy path
// uses the 'fixed' essence model (build-independent) so the total is pinned by
// data alone; the 'qiRate' model is checked against its own formula.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { useAlchemyStore } from '@/stores/alchemy'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { SECRET_REALM_DATA, findSecretRealmSite } from '@/data/secret-realm'
import type { RealmId } from '@/engine/types'

// ---- Fixtures --------------------------------------------------------------

/** Reveal the system (reveal gate = coreForged, i.e. coreGrade >= 0). */
function forgeCore(): void {
  useBodyStore().coreGrade = 0
}

/** Set realm `n` best (unlocks the gated sites: site2 at 1, site3 at 75). */
function setNascentBest(best: number): void {
  const realm = useRealmStore()
  const id: RealmId = 'n'
  realm.slice[id] = {
    ...realm.slice[id],
    unlocked: true,
    best: String(best),
    points: String(best),
    total: String(best),
    resetTime: 0,
    milestones: [],
  }
}

const PERIOD = SECRET_REALM_DATA.rotation.periodSeconds

describe('secretRealm: reveal latch', () => {
  beforeEach(() => { bootTestStores() })

  it('is hidden until the core is forged, then latches on', () => {
    const secretRealm = useSecretRealmStore()
    const body = useBodyStore()
    expect(secretRealm.isRevealed()).toBe(false)

    forgeCore()
    secretRealm.update(0.1) // latch reveal
    expect(secretRealm.isRevealed()).toBe(true)

    // Regress the gate: reveal must NOT flicker back off.
    body.coreGrade = -1
    expect(secretRealm.isRevealGateMet()).toBe(false)
    expect(secretRealm.isRevealed()).toBe(true)
  })
})

describe('secretRealm: rotation + unlock gating', () => {
  beforeEach(() => { bootTestStores() })

  it('only verdantHollow is unlocked at reveal; the others gate on realm n', () => {
    const secretRealm = useSecretRealmStore()
    forgeCore()
    expect(secretRealm.siteIsUnlocked('verdantHollow')).toBe(true)
    expect(secretRealm.siteIsUnlocked('invertedSpiritLand')).toBe(false)
    expect(secretRealm.siteIsUnlocked('shatteredStarVault')).toBe(false)

    setNascentBest(1) // Early Nascent Soul (at:1)
    expect(secretRealm.siteIsUnlocked('invertedSpiritLand')).toBe(true)
    expect(secretRealm.siteIsUnlocked('shatteredStarVault')).toBe(false)

    setNascentBest(75) // Great Circle (at:75)
    expect(secretRealm.siteIsUnlocked('shatteredStarVault')).toBe(true)
  })

  it('activeSiteKey cycles through unlocked sites by timePlayed window', () => {
    const game = useGameStore()
    const secretRealm = useSecretRealmStore()
    forgeCore()
    setNascentBest(75) // all three unlocked, in data order

    const ring = secretRealm.unlockedSites.map((s) => s.key)
    expect(ring.length).toBe(SECRET_REALM_DATA.sites.length)

    game.timePlayed = 0
    expect(secretRealm.activeSiteKey).toBe(ring[0])
    game.timePlayed = PERIOD
    expect(secretRealm.activeSiteKey).toBe(ring[1])
    game.timePlayed = PERIOD * 2
    expect(secretRealm.activeSiteKey).toBe(ring[2])
    game.timePlayed = PERIOD * ring.length // wraps back to index 0
    expect(secretRealm.activeSiteKey).toBe(ring[0])
  })

  it('secondsUntilRotation counts down within the window', () => {
    const game = useGameStore()
    const secretRealm = useSecretRealmStore()
    game.timePlayed = PERIOD - 10
    expect(secretRealm.secondsUntilRotation).toBe(10)
  })

  it('activeSiteKey is null before reveal', () => {
    const secretRealm = useSecretRealmStore()
    expect(secretRealm.activeSiteKey).toBe(null)
  })
})

describe('secretRealm: enter → accrue → resolve (exact rewards, fixed model)', () => {
  beforeEach(() => { bootTestStores() })

  it('resolves into materials, an Insight surge, and a first-clear glimpse', () => {
    const game = useGameStore()
    const dao = useDaoStore()
    const alchemy = useAlchemyStore()
    const secretRealm = useSecretRealmStore()

    forgeCore()
    setNascentBest(75)
    // Point the rotation at the fixed-model vault (index 2 in the ring).
    const ring = secretRealm.unlockedSites.map((s) => s.key)
    const vaultIndex = ring.indexOf('shatteredStarVault')
    game.timePlayed = PERIOD * vaultIndex
    expect(secretRealm.activeSiteKey).toBe('shatteredStarVault')

    const site = findSecretRealmSite('shatteredStarVault')
    // Expected totals derived purely from data (fixed model: base × rateMult).
    const ratePerSec = SECRET_REALM_DATA.essenceBase * site.modifier.rateMult
    const totalEssence = ratePerSec * site.durationSeconds
    const expectedMaterial = totalEssence * site.rewards.materialPerEssence
    const expectedInsight = totalEssence * site.rewards.insightPerEssence

    // Spy on the material deposit (alchemy economy owned by the other system).
    const addMaterialSpy = vi.spyOn(alchemy, 'addMaterial')
    const insightBefore = dao.insight.toNumber()

    expect(secretRealm.canEnter('shatteredStarVault')).toBe(true)
    expect(secretRealm.enter('shatteredStarVault')).toBe(true)
    expect(secretRealm.essenceRate()).toBeCloseTo(ratePerSec)

    // One oversized tick: essence accrual caps at exactly durationSeconds worth.
    secretRealm.update(site.durationSeconds + 100)

    expect(secretRealm.expedition.active).toBe(false)
    expect(addMaterialSpy).toHaveBeenCalledWith(site.rewards.material, expectedMaterial)
    expect(dao.insight.toNumber()).toBeCloseTo(insightBefore + expectedInsight)
    // First-clear glimpse of the buried node.
    expect(site.rewards.firstClearGlimpseNode).toBeDefined()
    expect(dao.nodeTierOwned(site.rewards.firstClearGlimpseNode!)).toBe(1)
    expect(secretRealm.clearsOf('shatteredStarVault')).toBe(1)
  })

  it('caps the resolved essence total identically regardless of tick granularity', () => {
    const game = useGameStore()
    const alchemy = useAlchemyStore()
    const secretRealm = useSecretRealmStore()
    forgeCore()
    setNascentBest(75)
    const ring = secretRealm.unlockedSites.map((s) => s.key)
    game.timePlayed = PERIOD * ring.indexOf('shatteredStarVault')

    const site = findSecretRealmSite('shatteredStarVault')
    const expectedTotal = SECRET_REALM_DATA.essenceBase * site.modifier.rateMult * site.durationSeconds
    const expectedMaterial = expectedTotal * site.rewards.materialPerEssence

    const addMaterialSpy = vi.spyOn(alchemy, 'addMaterial')
    secretRealm.enter('shatteredStarVault')
    // Accrue in fine slices whose sum overshoots the boundary; the resolved
    // total must still be exactly durationSeconds worth of essence.
    const step = 7 // arbitrary non-divisor of durationSeconds
    while (secretRealm.expedition.active) secretRealm.update(step)

    const [, materialAmount] = addMaterialSpy.mock.calls[0]!
    expect(materialAmount).toBeCloseTo(expectedMaterial)
  })
})

describe('secretRealm: cooldown + repeat clears', () => {
  beforeEach(() => { bootTestStores() })

  it('blocks re-entry until cooldown elapses; second clear grants no new glimpse', () => {
    const game = useGameStore()
    const dao = useDaoStore()
    const secretRealm = useSecretRealmStore()
    forgeCore()
    setNascentBest(75)
    const ring = secretRealm.unlockedSites.map((s) => s.key)
    const vaultWindow = ring.indexOf('shatteredStarVault')
    game.timePlayed = PERIOD * vaultWindow
    const site = findSecretRealmSite('shatteredStarVault')

    // First clear.
    secretRealm.enter('shatteredStarVault')
    secretRealm.update(site.durationSeconds)
    expect(secretRealm.clearsOf('shatteredStarVault')).toBe(1)

    // Cooldown active → cannot re-enter immediately.
    expect(secretRealm.cooldownRemaining('shatteredStarVault')).toBeCloseTo(site.cooldownSeconds)
    expect(secretRealm.canEnter('shatteredStarVault')).toBe(false)
    expect(secretRealm.enter('shatteredStarVault')).toBe(false)

    // Jump to a later window where the vault is active again AND the cooldown
    // (recorded at the first-clear timePlayed) has fully elapsed.
    game.timePlayed = PERIOD * (vaultWindow + ring.length)
    expect(game.timePlayed).toBeGreaterThan(PERIOD * vaultWindow + site.cooldownSeconds)
    expect(secretRealm.activeSiteKey).toBe('shatteredStarVault')
    expect(secretRealm.cooldownRemaining('shatteredStarVault')).toBe(0)
    expect(secretRealm.canEnter('shatteredStarVault')).toBe(true)

    // Second clear: glimpse already owned → no-op, tier stays 1, clears → 2.
    const glimpseNode = site.rewards.firstClearGlimpseNode!
    expect(dao.nodeTierOwned(glimpseNode)).toBe(1)
    secretRealm.enter('shatteredStarVault')
    secretRealm.update(site.durationSeconds)
    expect(dao.nodeTierOwned(glimpseNode)).toBe(1)
    expect(secretRealm.clearsOf('shatteredStarVault')).toBe(2)
  })
})

describe('secretRealm: entry isolation + save round-trip', () => {
  beforeEach(() => { bootTestStores() })

  it('enter() resets ONLY expedition state, touching no other store', () => {
    const game = useGameStore()
    const body = useBodyStore()
    const dao = useDaoStore()
    const realm = useRealmStore()
    const secretRealm = useSecretRealmStore()

    forgeCore()
    setNascentBest(75)
    game.points = new Decimal(12345)
    dao.insight = new Decimal(500)
    const ring = secretRealm.unlockedSites.map((s) => s.key)
    game.timePlayed = PERIOD * ring.indexOf('verdantHollow')

    const qiBefore = game.points.toString()
    const insightBefore = dao.insight.toString()
    const coreBefore = body.coreGrade
    const nBestBefore = realm.realmBest('n').toString()

    expect(secretRealm.enter('verdantHollow')).toBe(true)
    expect(secretRealm.expedition.active).toBe(true)
    expect(secretRealm.expedition.siteKey).toBe('verdantHollow')
    expect(secretRealm.expedition.elapsed).toBe(0)
    expect(secretRealm.expedition.essence).toBe(0)

    // Nothing outside the expedition moved.
    expect(game.points.toString()).toBe(qiBefore)
    expect(dao.insight.toString()).toBe(insightBefore)
    expect(body.coreGrade).toBe(coreBefore)
    expect(realm.realmBest('n').toString()).toBe(nBestBefore)
  })

  it('save → load preserves a mid-run expedition', () => {
    const game = useGameStore()
    const secretRealm = useSecretRealmStore()
    forgeCore()
    setNascentBest(75)
    const ring = secretRealm.unlockedSites.map((s) => s.key)
    game.timePlayed = PERIOD * ring.indexOf('shatteredStarVault')

    const site = findSecretRealmSite('shatteredStarVault')
    secretRealm.enter('shatteredStarVault')
    secretRealm.update(site.durationSeconds / 2) // partial — not resolved
    expect(secretRealm.expedition.active).toBe(true)

    const snapshot = secretRealm.save()
    const savedRun = (snapshot.expedition as { elapsed: number; essence: number })
    expect(savedRun.essence).toBeGreaterThan(0)

    // Clobber, then restore.
    secretRealm.load({ expedition: { active: false, siteKey: null, elapsed: 0, essence: 0 }, clears: {}, cooldownUntil: {} })
    expect(secretRealm.expedition.active).toBe(false)
    secretRealm.load(snapshot)

    expect(secretRealm.expedition.active).toBe(true)
    expect(secretRealm.expedition.siteKey).toBe('shatteredStarVault')
    expect(secretRealm.expedition.elapsed).toBeCloseTo(site.durationSeconds / 2)
    expect(secretRealm.expedition.essence).toBeCloseTo(savedRun.essence)
  })
})
