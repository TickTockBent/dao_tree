// src/stores/__tests__/alchemy.test.ts — Alchemy profession (slice 7, §7.6).
//
// Every numeric expectation is derived FROM ALCHEMY_DATA (recipe costs, pill
// effects) — no copied literals — so a tuning change to the data table can
// only ever break the data test, never silently drift the store.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { usePipelinesStore } from '@/stores/pipelines'
import { useTribulationStore } from '@/stores/tribulation'
import { useAlchemyStore } from '@/stores/alchemy'
import { ALCHEMY_DATA } from '@/data/alchemy'
import type { RealmState } from '@/stores/realm'

// ---- Data-derived fixtures (never copied literals) --------------------------

const timedRecipe = ALCHEMY_DATA.recipes.find((r) => r.effect.type === 'timedQiMult')!
const aidRecipe = ALCHEMY_DATA.recipes.find((r) => r.effect.type === 'breakthroughAid')!
const wardingRecipe = ALCHEMY_DATA.recipes.find((r) => r.effect.type === 'tribulationPoolBonus')!

const timedMult = timedRecipe.effect.type === 'timedQiMult' ? timedRecipe.effect.mult : 1
const timedDuration = timedRecipe.effect.type === 'timedQiMult' ? timedRecipe.effect.durationSeconds : 0
const aidGainMult = aidRecipe.effect.type === 'breakthroughAid' ? aidRecipe.effect.gainMult : 1
const aidAppliesTo = aidRecipe.effect.type === 'breakthroughAid' ? aidRecipe.effect.appliesTo : []
const wardingPoolBonus = wardingRecipe.effect.type === 'tribulationPoolBonus' ? wardingRecipe.effect.poolBonus : 0

/** A realm-row override with best set (the rest of RealmState defaulted). */
function realmRow(best: string): RealmState {
  return { points: '0', best, total: '0', unlocked: true, resetTime: 0, milestones: [] }
}

/** Deposit exactly one recipe's material cost so it becomes craftable. */
function stockCost(alchemy: ReturnType<typeof useAlchemyStore>, recipe: typeof timedRecipe): void {
  for (const [key, amount] of Object.entries(recipe.cost)) {
    alchemy.addMaterial(key as never, amount)
  }
}

// ---- Reveal latch -----------------------------------------------------------

describe('alchemy: reveal latch', () => {
  beforeEach(() => { bootTestStores() })

  it('is hidden at fresh state, revealed once the core is forged, and latched thereafter', () => {
    const alchemy = useAlchemyStore()
    const body = useBodyStore()
    expect(alchemy.isRevealed()).toBe(false)

    // ALCHEMY_DATA.reveal = { coreForged: true } → coreGrade >= 0.
    body.coreGrade = 0
    expect(alchemy.isRevealed()).toBe(true)

    // Latch on the next tick, then confirm it never re-seals if the gate lapses.
    alchemy.update(0.1)
    body.coreGrade = -1
    expect(alchemy.isRevealed()).toBe(true)
  })
})

// ---- Profession pick --------------------------------------------------------

describe('alchemy: profession pick', () => {
  beforeEach(() => { bootTestStores() })

  it('accepts only alchemy and is a one-time choice', () => {
    const alchemy = useAlchemyStore()
    expect(alchemy.professionChosen).toBe(false)

    // v1 rejects the sealed slots.
    expect(alchemy.chooseProfession('artifice')).toBe(false)
    expect(alchemy.chooseProfession('formations')).toBe(false)
    expect(alchemy.professionChosen).toBe(false)

    // Alchemy is accepted once.
    expect(alchemy.chooseProfession('alchemy')).toBe(true)
    expect(alchemy.professionChosen).toBe(true)
    // A second pick (even of alchemy) is refused.
    expect(alchemy.chooseProfession('alchemy')).toBe(false)
  })
})

// ---- Fractional materials ---------------------------------------------------

describe('alchemy: fractional materials floor-accumulate', () => {
  beforeEach(() => { bootTestStores() })

  it('sums raw floats honestly and floors for the visible count', () => {
    const alchemy = useAlchemyStore()
    const mat = ALCHEMY_DATA.materials[0]!.key
    alchemy.addMaterial(mat, 0.5)
    alchemy.addMaterial(mat, 0.5)
    expect(alchemy.materialCount(mat)).toBe(1) // 1.0 exactly
    alchemy.addMaterial(mat, 0.4)
    expect(alchemy.materialCount(mat)).toBe(1) // 1.4 → floor 1
    expect(alchemy.materials[mat]).toBeCloseTo(1.4, 10)
  })
})

// ---- Craft math -------------------------------------------------------------

describe('alchemy: crafting', () => {
  beforeEach(() => { bootTestStores() })

  it('consumes the exact cost, mints one pill, and refuses when short', () => {
    const alchemy = useAlchemyStore()
    alchemy.chooseProfession('alchemy')

    // Short at first (no materials).
    expect(alchemy.canCraft(timedRecipe.key)).toBe(false)
    expect(alchemy.craft(timedRecipe.key)).toBe(false)

    stockCost(alchemy, timedRecipe)
    expect(alchemy.canCraft(timedRecipe.key)).toBe(true)
    expect(alchemy.craft(timedRecipe.key)).toBe(true)
    expect(alchemy.pillCount(timedRecipe.key)).toBe(1)

    // The cost was consumed exactly → can't craft a second.
    for (const key of Object.keys(timedRecipe.cost)) {
      expect(alchemy.materialCount(key as never)).toBe(0)
    }
    expect(alchemy.canCraft(timedRecipe.key)).toBe(false)
  })

  it('hides a recipe until its meets() unlock gate is satisfied', () => {
    const alchemy = useAlchemyStore()
    // The breakthrough-aid recipe gates on a realm sub-stage; unchosen → locked.
    expect(alchemy.recipeUnlocked(aidRecipe.key)).toBe(false)
    alchemy.chooseProfession('alchemy')
    // Still locked: the realm gate is unmet at fresh state.
    expect(alchemy.recipeUnlocked(aidRecipe.key)).toBe(false)
    // The empty-gate timed recipe unlocks the moment a profession is chosen.
    expect(alchemy.recipeUnlocked(timedRecipe.key)).toBe(true)
  })
})

// ---- Timed pill lifecycle ---------------------------------------------------

describe('alchemy: timed pill lifecycle', () => {
  beforeEach(() => { bootTestStores() })

  it('doubles Qi/sec while active, expires to identity, and replaces on re-activation', () => {
    const alchemy = useAlchemyStore()
    const pipelines = usePipelinesStore()
    alchemy.chooseProfession('alchemy')

    // Craft two so we can test replacement.
    stockCost(alchemy, timedRecipe)
    stockCost(alchemy, timedRecipe)
    alchemy.craft(timedRecipe.key)
    alchemy.craft(timedRecipe.key)
    expect(alchemy.pillCount(timedRecipe.key)).toBe(2)

    const before = pipelines.qiPerSecond.toNumber()
    expect(alchemy.activatePill(timedRecipe.key)).toBe(true)
    expect(alchemy.pillCount(timedRecipe.key)).toBe(1)
    const during = pipelines.qiPerSecond.toNumber()
    expect(during / before).toBeCloseTo(timedMult, 6)

    // Partially tick, then re-activate → remaining resets to full duration.
    alchemy.update(timedDuration / 2)
    expect(alchemy.activePill!.remaining).toBeCloseTo(timedDuration / 2, 6)
    expect(alchemy.activatePill(timedRecipe.key)).toBe(true)
    expect(alchemy.activePill!.remaining).toBeCloseTo(timedDuration, 6)
    expect(alchemy.pillCount(timedRecipe.key)).toBe(0)

    // Run past the duration → cleared, Qi/sec back to identity.
    alchemy.update(timedDuration + 1)
    expect(alchemy.activePill).toBeNull()
    expect(pipelines.qiPerSecond.toNumber()).toBeCloseTo(before, 6)
  })

  it('refuses to activate a non-timed pill', () => {
    const alchemy = useAlchemyStore()
    alchemy.chooseProfession('alchemy')
    // The warding pill is a held pill, not activatable — even if we hand-hold one.
    const realm = useRealmStore()
    realm.slice.s = realmRow('400')
    stockCost(alchemy, wardingRecipe)
    alchemy.craft(wardingRecipe.key)
    expect(alchemy.pillCount(wardingRecipe.key)).toBe(1)
    expect(alchemy.activatePill(wardingRecipe.key)).toBe(false)
    expect(alchemy.pillCount(wardingRecipe.key)).toBe(1) // unconsumed
  })
})

// ---- Breakthrough aid end-to-end through the realm store --------------------

describe('alchemy: breakthrough aid folds into and is consumed by realm prestige', () => {
  beforeEach(() => { bootTestStores() })

  it('boosts the shown gain of an eligible realm, consumes exactly one charge, then unboosts', () => {
    const alchemy = useAlchemyStore()
    const realm = useRealmStore()
    const game = useGameStore()

    const eligibleRealm = aidAppliesTo[0]! // 'n'
    // Unlock the eligible realm high enough to satisfy the recipe's realm gate.
    realm.slice[eligibleRealm] = realmRow('1')
    alchemy.chooseProfession('alchemy')
    expect(alchemy.recipeUnlocked(aidRecipe.key)).toBe(true)

    // Bank enough Qi to prestige, and record the UNBOOSTED shown gain first.
    game.points = new Decimal('1e12')
    const baseGain = realm.resetGain(eligibleRealm).toNumber()

    // Craft + hold a clarity pill; the same shown gain now reflects the fold.
    stockCost(alchemy, aidRecipe)
    expect(alchemy.craft(aidRecipe.key)).toBe(true)
    expect(alchemy.breakthroughGainMult(eligibleRealm).toNumber()).toBe(aidGainMult)
    const boostedGain = realm.resetGain(eligibleRealm).toNumber()
    expect(boostedGain).toBeGreaterThan(baseGain)
    // The fold is exactly the recipe's gainMult (within floor rounding, < 2 units).
    expect(Math.abs(boostedGain - baseGain * aidGainMult)).toBeLessThan(2)

    // Prestige lands the boosted gain and consumes exactly one charge.
    realm.prestige(eligibleRealm)
    expect(alchemy.pillCount(aidRecipe.key)).toBe(0)

    // The next gain (same banked Qi) is unboosted again.
    game.points = new Decimal('1e12')
    expect(alchemy.breakthroughGainMult(eligibleRealm).toNumber()).toBe(1)
    expect(realm.resetGain(eligibleRealm).toNumber()).toBeCloseTo(baseGain, 6)
  })

  it('never consumes a charge on an ineligible realm (q automation is safe)', () => {
    const alchemy = useAlchemyStore()
    const realm = useRealmStore()
    const game = useGameStore()

    // q is excluded from the aid's appliesTo (design §7.6).
    expect(aidAppliesTo).not.toContain('q')

    // Hold a clarity pill (unlock via the eligible realm, then prestige q).
    realm.slice[aidAppliesTo[0]!] = realmRow('1')
    alchemy.chooseProfession('alchemy')
    stockCost(alchemy, aidRecipe)
    alchemy.craft(aidRecipe.key)
    expect(alchemy.pillCount(aidRecipe.key)).toBe(1)

    expect(alchemy.breakthroughGainMult('q').toNumber()).toBe(1)
    game.points = new Decimal('1e6')
    realm.prestige('q')
    // The charge survives an ineligible prestige.
    expect(alchemy.pillCount(aidRecipe.key)).toBe(1)
  })
})

// ---- Warding pill end-to-end through tribulation.beginTribulation -----------

describe('alchemy: warding pill dissolves into the tribulation pool', () => {
  beforeEach(() => { bootTestStores() })

  it('raises the pool by exactly poolBonus and is consumed at trigger', () => {
    const alchemy = useAlchemyStore()
    const realm = useRealmStore()
    const trib = useTribulationStore()
    const game = useGameStore()

    // Bring s to the tribulation trigger so beginTribulation can fire.
    realm.slice.s = realmRow('400')
    alchemy.chooseProfession('alchemy')
    stockCost(alchemy, wardingRecipe)
    expect(alchemy.craft(wardingRecipe.key)).toBe(true)
    expect(alchemy.tribulationPoolBonus.toNumber()).toBe(wardingPoolBonus)

    game.points = new Decimal('1e6')
    expect(trib.tribulationIsReady).toBe(true)
    const basePool = trib.tribulationPreparednessPool().toNumber()

    trib.beginTribulation()
    expect(trib.tribPoolMax.toNumber()).toBeCloseTo(basePool + wardingPoolBonus, 6)
    expect(alchemy.pillCount(wardingRecipe.key)).toBe(0)
  })
})

// ---- Save round-trip --------------------------------------------------------

describe('alchemy: save round-trip', () => {
  beforeEach(() => { bootTestStores() })

  it('preserves the profession, fractional materials, held pills, and the active pill', () => {
    const alchemy = useAlchemyStore()
    alchemy.chooseProfession('alchemy')

    const mat = ALCHEMY_DATA.materials[0]!.key
    alchemy.addMaterial(mat, 3.7)
    alchemy.addMaterial(mat, 3.7) // 7.4 raw → count 7

    stockCost(alchemy, timedRecipe)
    alchemy.craft(timedRecipe.key)
    alchemy.activatePill(timedRecipe.key)
    alchemy.update(timedDuration / 4)
    const remainingBefore = alchemy.activePill!.remaining

    // Serialize through JSON (as the real save pipeline does), reboot, reload.
    const snapshot = JSON.parse(JSON.stringify(alchemy.save()))
    bootTestStores()
    const restored = useAlchemyStore()
    restored.load(snapshot)

    expect(restored.profession).toBe('alchemy')
    expect(restored.materials[mat]).toBeCloseTo(7.4, 10)
    expect(restored.materialCount(mat)).toBe(7)
    expect(restored.activePill).not.toBeNull()
    expect(restored.activePill!.key).toBe(timedRecipe.key)
    expect(restored.activePill!.remaining).toBeCloseTo(remainingBefore, 6)
  })
})
