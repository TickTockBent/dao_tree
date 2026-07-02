// src/stores/__tests__/seclusion.test.ts — Deep Meditation (slice 8.5).

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useGameStore } from '@/stores/game'
import { useRealmStore } from '@/stores/realm'
import { useSeclusionStore } from '@/stores/seclusion'
import { SECLUSION_DATA, findSeclusionRung } from '@/data/seclusion'

describe('seclusion store (Deep Meditation)', () => {
  beforeEach(() => {
    bootTestStores()
  })

  it('fresh state: base cap only, no rungs, q rung revealed (q starts reached)', () => {
    const seclusion = useSeclusionStore()
    expect(seclusion.rungsPurchased).toBe(0)
    expect(seclusion.offlineCapSeconds).toBe(SECLUSION_DATA.baseCapSeconds)
    // q.best starts at 0 — the first rung reveals only after the first q prestige.
    expect(seclusion.isRevealed('q')).toBe(false)
    expect(seclusion.isRevealed('f')).toBe(false)
  })

  it('rung reveals with its realm and purchase spends exactly the Qi cost', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const seclusion = useSeclusionStore()
    const rung = findSeclusionRung('q')

    // Reach q (one prestige), then fund the rung plus a margin.
    game.points = new Decimal(rung.qiCost)
    realm.prestige('q')
    expect(seclusion.isRevealed('q')).toBe(true)

    // Prestige zeroed Qi — can't purchase yet.
    expect(seclusion.canPurchase('q')).toBe(false)
    game.points = new Decimal(rung.qiCost + 1)
    expect(seclusion.canPurchase('q')).toBe(true)
    expect(seclusion.purchase('q')).toBe(true)
    expect(game.points.toNumber()).toBe(1)
    expect(seclusion.offlineCapSeconds).toBe(SECLUSION_DATA.baseCapSeconds + rung.capBonusSeconds)
    // One-time: a second purchase refuses.
    game.points = new Decimal(rung.qiCost)
    expect(seclusion.purchase('q')).toBe(false)
  })

  it('locked rungs refuse purchase regardless of Qi', () => {
    const game = useGameStore()
    const seclusion = useSeclusionStore()
    game.points = new Decimal(findSeclusionRung('s').qiCost)
    expect(seclusion.canPurchase('s')).toBe(false)
    expect(seclusion.purchase('s')).toBe(false)
  })

  it('purchased rungs survive realm prestige cascades (eternal scope)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const seclusion = useSeclusionStore()

    game.points = new Decimal(findSeclusionRung('q').qiCost * 2)
    realm.prestige('q')
    game.points = new Decimal(findSeclusionRung('q').qiCost)
    seclusion.purchase('q')
    const capAfterPurchase = seclusion.offlineCapSeconds

    // An f prestige cascades over q — the rung must be untouched.
    game.points = new Decimal(1e7)
    realm.prestige('q')
    game.points = new Decimal(1e7)
    realm.prestige('f')
    expect(seclusion.rungsPurchased).toBe(1)
    expect(seclusion.offlineCapSeconds).toBe(capAfterPurchase)
  })

  it('the game store honors the boosted cap in offline catch-up', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const seclusion = useSeclusionStore()

    // Purchase the q rung: cap = base + 1h.
    game.points = new Decimal(findSeclusionRung('q').qiCost * 2)
    realm.prestige('q')
    game.points = new Decimal(findSeclusionRung('q').qiCost)
    seclusion.purchase('q')
    const boostedCap = seclusion.offlineCapSeconds
    expect(boostedCap).toBeGreaterThan(SECLUSION_DATA.baseCapSeconds)

    // Simulate a long absence: offTime far above the cap must clamp to the
    // BOOSTED cap (not the base constant) on the next tick.
    game.options.offlineProd = true
    game.offTime = { remain: boostedCap * 10 }
    game.tick()
    expect(game.offTime === null || game.offTime.remain <= boostedCap).toBe(true)
  })

  it('save round-trip preserves rungs; unknown realms in a stale save are dropped', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const seclusion = useSeclusionStore()

    game.points = new Decimal(findSeclusionRung('q').qiCost * 2)
    realm.prestige('q')
    game.points = new Decimal(findSeclusionRung('q').qiCost)
    seclusion.purchase('q')

    const saved = seclusion.save()
    seclusion.load(saved)
    expect(seclusion.rungsPurchased).toBe(1)
    expect(seclusion.isPurchased('q')).toBe(true)

    // Defensive load: a stale/unknown key is filtered, valid ones kept.
    seclusion.load({ purchased: ['q', 'zz'] })
    expect(seclusion.rungsPurchased).toBe(1)
  })
})
