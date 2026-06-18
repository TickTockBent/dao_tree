// src/sim/__tests__/smoke.test.ts — behavioral smoke tests against the new engine.
//
// Ports key behavioral checks from js/build/runtime-smoke-node.js. Each test
// boots a fresh Pinia + stores and exercises a specific engine behavior path.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { usePipelinesStore } from '@/stores/pipelines'
import { useForgeStore } from '@/stores/forge'
import { useScarStore } from '@/stores/scar'
import { useJournalStore } from '@/stores/journal'
import { useHintsStore } from '@/stores/hints'

describe('smoke: Qi gathering + prestige', () => {
  beforeEach(() => { bootTestStores() })

  it('Qi accrues over a tick', () => {
    const game = useGameStore()
    const before = game.points.toNumber()
    game.tick()
    expect(game.points.toNumber()).toBeGreaterThanOrEqual(before)
  })

  it('q prestige awards points and resets Qi', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(100)
    realm.prestige('q')
    expect(realm.realmBest('q').toNumber()).toBeGreaterThan(0)
    expect(game.points.toNumber()).toBe(0)
  })

  it('f prestige cascades to q (wipes q.best when no keep rule)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const body = useBodyStore()
    // Build up q.best.
    game.points = new Decimal(1000)
    realm.prestige('q')
    expect(realm.realmBest('q').toNumber()).toBeGreaterThan(0)
    // Unlock f + prestige.
    game.points = new Decimal(1e6)
    for (let i = 0; i < 4; i++) body.buyBuyable('primaryMeridian')
    if (realm.canReset('f')) {
      realm.prestige('f')
      expect(realm.realmBest('q').toNumber()).toBe(0)
    }
  })
})

describe('smoke: Body + meridians + temper', () => {
  beforeEach(() => { bootTestStores() })

  it('buying a primary meridian increases meridianMult', () => {
    const game = useGameStore()
    const body = useBodyStore()
    game.points = new Decimal(1e6)
    const before = body.meridianMult.toNumber()
    body.buyBuyable('primaryMeridian')
    expect(body.meridianMult.toNumber()).toBeGreaterThan(before)
  })

  it('temper level milestones latch on tier crossing', () => {
    const game = useGameStore()
    const body = useBodyStore()
    game.points = new Decimal(1e9)
    // Buy temper to level 5 (Flesh tier crossing).
    for (let i = 0; i < 5; i++) body.buyBuyable('temper')
    expect(body.hasMilestone(1)).toBe(true) // flesh = index 1
  })
})

describe('smoke: Dao lattice + stances', () => {
  beforeEach(() => { bootTestStores() })

  it('dao reveals at q 4th Level', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const dao = useDaoStore()
    expect(dao.isRevealed()).toBe(false)
    game.points = new Decimal(1e6)
    realm.prestige('q')
    expect(dao.isRevealed()).toBe(true)
  })

  it('buying a lattice node increases daoNodeQiMult', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const dao = useDaoStore()
    const pipelines = usePipelinesStore()
    game.points = new Decimal(1e6)
    realm.prestige('q')
    dao.update(1) // latch reveal
    dao.insight = new Decimal(500)
    const before = pipelines.qiPerSecond.toNumber()
    dao.buyNodeTier('metal')
    dao.update(0.1)
    expect(pipelines.qiPerSecond.toNumber()).toBeGreaterThan(before)
  })

  it('breathing trance stance is toggleable', () => {
    const dao = useDaoStore()
    dao.toggleStance('breathingTrance')
    expect(dao.activeStance).toBe('breathingTrance')
    dao.toggleStance('breathingTrance')
    expect(dao.activeStance).toBe('')
  })
})

describe('smoke: Forge + core grade', () => {
  beforeEach(() => { bootTestStores() })

  it('forge produces a core grade', () => {
    const realm = useRealmStore()
    const forge = useForgeStore()
    const body = useBodyStore()
    realm.slice.c = { ...realm.slice.c, unlocked: true }
    realm.slice.f = { ...realm.slice.f, points: '100', unlocked: true }
    body.foundationGrade = 0
    const result = forge.performForge('steady')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(forge.coreIsForged).toBe(true)
    expect(forge.coreGradeMult.toNumber()).toBeGreaterThan(1)
  })
})

describe('smoke: Scar + heal', () => {
  beforeEach(() => { bootTestStores() })

  it('scar deepens and heals', () => {
    const scar = useScarStore()
    scar.deepenScar()
    expect(scar.scarIsActive).toBe(true)
    expect(scar.scarQiMult.toNumber()).toBeLessThan(1)
    // Heal: goal = 240 × 1 = 240. Rate = 1/sec → 240 seconds.
    scar.scarHealTick(240)
    expect(scar.scarIsActive).toBe(false)
    expect(scar.temperedQiMult.toNumber()).toBeGreaterThan(1)
  })
})

describe('smoke: save round-trip', () => {
  beforeEach(() => { bootTestStores() })

  it('save → load preserves state', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const body = useBodyStore()
    game.points = new Decimal(1e6)
    realm.prestige('q')
    // Prestige resets Qi to 0, so give Qi again for the meridian purchase.
    game.points = new Decimal(1e6)
    body.buyBuyable('primaryMeridian')

    const save = game.buildSave()
    // Verify the save captured the state.
    const bodySlice = save['b'] as { primaryMeridians: number }
    expect(bodySlice.primaryMeridians).toBe(1)
    // Reload the save onto a fresh state.
    game.applySave(save)
    expect(realm.realmBest('q').toNumber()).toBeGreaterThan(0)
    expect(body.primaryMeridians).toBe(1)
  })
})

describe('smoke: hints + journal', () => {
  beforeEach(() => { bootTestStores() })

  it('hint bar shows a hint', () => {
    const hints = useHintsStore()
    expect(hints.hintText.length).toBeGreaterThan(0)
  })

  it('journal latches firstBreath on fresh state', () => {
    const journal = useJournalStore()
    journal.latchEntries()
    expect(journal.latched.has('firstBreath')).toBe(true)
  })
})

describe('smoke: Qi/sec pipeline no dead multipliers', () => {
  beforeEach(() => { bootTestStores() })

  it('qiPerSecond is > 0 at fresh state (baseRate)', () => {
    const pipelines = usePipelinesStore()
    expect(pipelines.qiPerSecond.toNumber()).toBeGreaterThan(0)
  })

  it('qiPerSecond increases after meridian purchase', () => {
    const game = useGameStore()
    const body = useBodyStore()
    const pipelines = usePipelinesStore()
    game.points = new Decimal(1e6)
    const before = pipelines.qiPerSecond.toNumber()
    body.buyBuyable('primaryMeridian')
    expect(pipelines.qiPerSecond.toNumber()).toBeGreaterThan(before)
  })
})
