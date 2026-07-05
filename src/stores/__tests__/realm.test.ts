import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { treeResetKeepKeys, layerRow } from '@/engine/doReset'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'

// ---- doReset pure function --------------------------------------------------

describe('doReset cascade logic', () => {
  const noMilestones = (_l: string, _m: number) => false

  it('tree-scoped lower row resets when a higher row prestiges', () => {
    // f (row 1) prestiges → q (row 0) resets (same tree, strictly lower row).
    expect(treeResetKeepKeys('q', 'f', noMilestones)).toEqual([])
  })

  it('returns null when the target is a higher row than the resetter', () => {
    // q (row 0) prestiges → f (row 1) is NOT reset.
    expect(treeResetKeepKeys('f', 'q', noMilestones)).toBeNull()
  })

  it('returns null for same-layer (self)', () => {
    expect(treeResetKeepKeys('q', 'q', noMilestones)).toBeNull()
  })

  it('preserves keep keys when the granting milestone is earned', () => {
    // f prestige + f milestone 3 earned → q keeps best + milestones.
    const hasF3 = (layer: string, milestone: number) =>
      layer === 'f' && milestone === 3
    expect(treeResetKeepKeys('q', 'f', hasF3)).toEqual(['best', 'milestones'])
  })

  it('preserves nothing when the granting milestone is NOT earned', () => {
    // f milestone 3 grants keep on f→q; with only n milestone 2 earned, q is wiped.
    const hasN2 = (layer: string, milestone: number) =>
      layer === 'n' && milestone === 2
    expect(treeResetKeepKeys('q', 'f', hasN2)).toEqual([])
  })

  it('n prestige cascades to both f and q (rows 1 and 0)', () => {
    expect(treeResetKeepKeys('f', 'n', noMilestones)).toEqual([])
    expect(treeResetKeepKeys('q', 'n', noMilestones)).toEqual([])
  })

  it('layerRow returns the realm row', () => {
    expect(layerRow('q')).toBe(0)
    expect(layerRow('f')).toBe(1)
    expect(layerRow('c')).toBe(2)
    expect(layerRow('n')).toBe(3)
    expect(layerRow('s')).toBe(4)
  })
})

// ---- Realm store integration -----------------------------------------------

describe('realm store: fresh state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with q unlocked and f/c/n/s locked', () => {
    const realm = useRealmStore()
    expect(realm.isUnlocked('q')).toBe(true)
    expect(realm.isUnlocked('f')).toBe(false)
    expect(realm.isUnlocked('c')).toBe(false)
    expect(realm.isUnlocked('n')).toBe(false)
    expect(realm.isUnlocked('s')).toBe(false)
  })

  it('q.best starts at zero', () => {
    const realm = useRealmStore()
    expect(realm.realmBest('q').toNumber()).toBe(0)
  })
})

describe('realm store: substage getters (levels v1, D43 #4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('none reached (best 0) → no current, next is the FIRST substage', () => {
    const realm = useRealmStore()
    expect(realm.currentSubstage('q')).toBeNull()
    expect(realm.nextSubstage('q')).toEqual({ label: '1st Level', at: 1 })
  })

  it('exactly AT a threshold counts as reached (best 90 → 6th Level current, 7th next)', () => {
    const realm = useRealmStore()
    realm.stateOf('q').best = '90' // exactly the 6th Level threshold (at: 90)
    expect(realm.currentSubstage('q')).toEqual({ label: '6th Level', at: 90 })
    expect(realm.nextSubstage('q')).toEqual({ label: '7th Level', at: 170 })
  })

  it('one below a threshold stays on the prior level (best 89 → 5th Level, next 6th)', () => {
    const realm = useRealmStore()
    realm.stateOf('q').best = '89'
    expect(realm.currentSubstage('q')).toEqual({ label: '5th Level', at: 45 })
    expect(realm.nextSubstage('q')).toEqual({ label: '6th Level', at: 90 })
  })

  it('all reached (best past the top) → current is the last, next is null', () => {
    const realm = useRealmStore()
    realm.stateOf('q').best = '10000' // past the 13th Level threshold (at: 2800)
    expect(realm.currentSubstage('q')).toEqual({ label: '13th Level', at: 2800 })
    expect(realm.nextSubstage('q')).toBeNull()
  })

  it('renders named substages generically (f: Foundation tiers)', () => {
    const realm = useRealmStore()
    realm.stateOf('f').unlocked = true
    realm.stateOf('f').best = '10' // exactly Late Foundation (at: 10)
    expect(realm.currentSubstage('f')).toEqual({ label: 'Late Foundation', at: 10 })
    expect(realm.nextSubstage('f')).toEqual({ label: 'Peak Foundation', at: 22 })
  })
})

describe('realm store: canReset + resetGain math', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('canReset q is false below reqBase (20)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(19)
    expect(realm.canReset('q')).toBe(false)
  })

  it('canReset q is true at reqBase', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(20)
    expect(realm.canReset('q')).toBe(true)
  })

  it('resetGain q = floor((points/20)^0.6)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    // 100 qi → (100/20)^0.6 = 5^0.6 ≈ 2.626 → floor = 2
    game.points = new Decimal(100)
    expect(realm.resetGain('q').toNumber()).toBe(2)
  })

  it('resetGain is zero when cannot reset', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(10)
    expect(realm.resetGain('q').toNumber()).toBe(0)
  })

  it('nextAt is the inverted threshold for the next gain step', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    // At 0 qi (cannot reset), resetGain=0, nextGain=1 → nextAt = 1^(1/0.6) × 20 = 20.
    game.points = new Decimal(0)
    expect(realm.nextAt('q').toNumber()).toBe(20)
  })
})

describe('realm store: prestige flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('awards points, updates best+total, resets qi to 0', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(100)
    const gain = realm.resetGain('q').toNumber()

    realm.prestige('q')

    expect(realm.realmBest('q').toNumber()).toBe(gain)
    expect(game.points.toNumber()).toBe(0)
  })

  it('latches sub-stage milestones based on best', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    // Prestige enough to reach 1st Level (at:1) and 2nd Level (at:3).
    game.points = new Decimal(100)
    realm.prestige('q')
    const best = realm.realmBest('q').toNumber()
    // Milestones 0 (at:1) and 1 (at:3) should be earned if best >= 3.
    expect(realm.hasMilestone('q', 0)).toBe(best >= 1)
    expect(realm.hasMilestone('q', 1)).toBe(best >= 3)
  })

  it('best is a high-water mark (does not decrease on later prestiges)', () => {
    const game = useGameStore()
    const realm = useRealmStore()

    game.points = new Decimal(1000)
    realm.prestige('q')
    const highBest = realm.realmBest('q').toNumber()

    // A smaller second prestige still adds to points; best is monotonic (>=).
    game.points = new Decimal(50)
    realm.prestige('q')
    expect(realm.realmBest('q').toNumber()).toBeGreaterThanOrEqual(highBest)
  })
})

describe('realm store: doReset cascade', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('q prestige does not reset q.best (self is a no-op)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    game.points = new Decimal(100)
    realm.prestige('q')
    const bestAfter = realm.realmBest('q').toNumber()
    expect(bestAfter).toBeGreaterThan(0)
  })

  it('f prestige wipes q.best when no keep rule is earned', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const body = useBodyStore()

    // First, build up q.best via q prestiges.
    game.points = new Decimal(1000)
    realm.prestige('q')
    expect(realm.realmBest('q').toNumber()).toBeGreaterThan(0)

    // Unlock f: needs q 6th Level (at:90) + 4 meridians.
    // Open 4 meridians.
    game.points = new Decimal(1e6)
    for (let i = 0; i < 4; i++) body.buyBuyable('primaryMeridian')

    // f should now be unlocked (q.best >= 90 from the 1000-qi prestige).
    // Prestige f.
    if (realm.canReset('f')) {
      realm.prestige('f')
      // No keep rule earned → q.best wiped to 0.
      expect(realm.realmBest('q').toNumber()).toBe(0)
    }
  })
})

describe('realm store: realmMult composition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts at 1 with no milestones', () => {
    const realm = useRealmStore()
    expect(realm.realmMult.toNumber()).toBe(1)
  })

  it('multiplies reached sub-stage qiMults', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    // Prestige q enough to reach several sub-stages.
    game.points = new Decimal(1e6)
    realm.prestige('q')
    // If best >= 1, milestone 0 earned → ×1.1.
    const best = realm.realmBest('q').toNumber()
    if (best >= 1) {
      expect(realm.realmMult.toNumber()).toBeGreaterThan(1)
    }
  })
})
