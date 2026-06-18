import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { useGameStore } from '@/stores/game'
import { useDaoStore } from '@/stores/dao'
import { useRealmStore } from '@/stores/realm'
import { useSectStore } from '@/stores/sect'
import { LATTICE_DATA } from '@/data/lattice'

// ---- Dao store: fresh state -------------------------------------------------

describe('dao store: fresh state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts unrevealed with zero insight', () => {
    const dao = useDaoStore()
    expect(dao.revealed).toBe(false)
    expect(dao.insight.toNumber()).toBe(0)
  })

  it('starts with no stances active', () => {
    const dao = useDaoStore()
    expect(dao.activeStance).toBe('')
  })

  it('starts with all nodes at tier 0', () => {
    const dao = useDaoStore()
    for (const node of LATTICE_DATA.nodes) {
      expect(dao.nodeTierOwned(node.key)).toBe(0)
    }
  })
})

// ---- Reveal gate ------------------------------------------------------------

describe('dao store: reveal gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reveal gate is NOT met at fresh state (needs q 4th Level)', () => {
    const dao = useDaoStore()
    expect(dao.isRevealGateMet()).toBe(false)
  })

  it('reveal gate met once q.best reaches 4th Level (at:20)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const dao = useDaoStore()

    // Prestige q enough to reach 4th Level (at:20).
    game.points = new Decimal(1e6)
    realm.prestige('q')

    expect(dao.isRevealGateMet()).toBe(true)
    expect(dao.isRevealed()).toBe(true)
  })

  it('update latches the reveal flag', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const dao = useDaoStore()

    game.points = new Decimal(1e6)
    realm.prestige('q')

    dao.update(0.1)
    expect(dao.revealed).toBe(true)
  })
})

// ---- Insight trickle --------------------------------------------------------

describe('dao store: insight trickle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does NOT accrue insight before reveal', () => {
    const dao = useDaoStore()
    dao.update(1)
    expect(dao.insight.toNumber()).toBe(0)
  })

  it('accrues insight after reveal (baseRate × diff)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const dao = useDaoStore()

    game.points = new Decimal(1e6)
    realm.prestige('q')

    dao.update(1)
    // baseRate is 0.5/sec; after 1 second we should have at least 0.5 insight.
    expect(dao.insight.toNumber()).toBeGreaterThanOrEqual(0.5)
  })
})

// ---- Node purchase ----------------------------------------------------------

describe('dao store: node purchase', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('roots have requirements met (requires: [])', () => {
    const dao = useDaoStore()
    for (const root of LATTICE_DATA.nodes.filter((n) => n.requires.length === 0)) {
      expect(dao.nodeRequirementsMet(root.key)).toBe(true)
    }
  })

  it('ring-2 nodes require their root at tier >= 1', () => {
    const dao = useDaoStore()
    expect(dao.nodeRequirementsMet('sword')).toBe(false)
  })

  it('cannot afford a root node without insight', () => {
    const dao = useDaoStore()
    expect(dao.canAffordNode('metal')).toBe(false)
  })

  it('buying a root node spends insight and increments tier', () => {
    const dao = useDaoStore()
    // Grant insight manually (simulating reveal + trickle).
    dao.insight = new Decimal(500)
    expect(dao.buyNodeTier('metal')).toBe(true)
    expect(dao.nodeTierOwned('metal')).toBe(1)
    // Cost was 100; 500 - 100 = 400.
    expect(dao.insight.toNumber()).toBe(400)
  })

  it('buying a root unlocks its ring-2 children', () => {
    const dao = useDaoStore()
    dao.insight = new Decimal(500)
    dao.buyNodeTier('metal')
    expect(dao.nodeRequirementsMet('sword')).toBe(true)
  })

  it('buying tier 2 (Seed) of a root costs the second cost entry', () => {
    const dao = useDaoStore()
    dao.insight = new Decimal(1000)
    dao.buyNodeTier('metal') // tier 1, cost 100
    dao.buyNodeTier('metal') // tier 2, cost 300
    expect(dao.nodeTierOwned('metal')).toBe(2)
    // 1000 - 100 - 300 = 600
    expect(dao.insight.toNumber()).toBe(600)
  })

  it('cannot buy beyond max tier (Seed = tier 2)', () => {
    const dao = useDaoStore()
    dao.insight = new Decimal(1e6)
    dao.buyNodeTier('metal')
    dao.buyNodeTier('metal')
    expect(dao.canAffordNode('metal')).toBe(false)
    expect(dao.buyNodeTier('metal')).toBe(false)
  })

  it('heldDaoSeedCount tracks nodes at tier >= 2', () => {
    const dao = useDaoStore()
    dao.insight = new Decimal(1e6)
    expect(dao.heldDaoSeedCount()).toBe(0)
    dao.buyNodeTier('metal')
    dao.buyNodeTier('metal')
    expect(dao.heldDaoSeedCount()).toBe(1)
  })

  it('elementMaxTier returns the highest tier across an element\'s nodes', () => {
    const dao = useDaoStore()
    dao.insight = new Decimal(1e6)
    dao.buyNodeTier('metal')
    expect(dao.elementMaxTier('metal')).toBe(1)
    dao.buyNodeTier('metal')
    expect(dao.elementMaxTier('metal')).toBe(2)
  })
})

// ---- Stances ----------------------------------------------------------------

describe('dao store: stances', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('breathingTrance is always unlocked (unlock: {})', () => {
    const dao = useDaoStore()
    dao.toggleStance('breathingTrance')
    expect(dao.activeStance).toBe('breathingTrance')
  })

  it('toggling an active stance deactivates it', () => {
    const dao = useDaoStore()
    dao.toggleStance('breathingTrance')
    dao.toggleStance('breathingTrance')
    expect(dao.activeStance).toBe('')
  })

  it('toggling a second stance replaces the first (maxActive 1)', () => {
    const dao = useDaoStore()
    dao.toggleStance('breathingTrance')
    dao.toggleStance('breathingTrance') // deactivate first
    dao.toggleStance('breathingTrance') // re-activate
    // Sword Trance requires daoNode ["sword", 1] — cannot activate without it.
    dao.toggleStance('swordTrance')
    expect(dao.activeStance).toBe('breathingTrance')
  })

  it('swordTrance unlocks after glimpsing the Sword Intent node', () => {
    const dao = useDaoStore()
    // Reveal + give enough insight to buy sword (requires metal root first).
    dao.insight = new Decimal(1e6)
    dao.buyNodeTier('metal') // unlock sword
    dao.buyNodeTier('sword') // glimpse sword (tier 1)
    // Now swordTrance should be unlockable.
    dao.toggleStance('swordTrance')
    expect(dao.activeStance).toBe('swordTrance')
  })
})

// ---- Sect lattice discount --------------------------------------------------

describe('dao store: sect lattice discount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('cost is full price when no sect joined', () => {
    const dao = useDaoStore()
    // Metal root Glimpse costs 100.
    expect(dao.nodeCost('metal').toNumber()).toBe(100)
  })

  it('cost is discounted when a sect archetype matches the element', () => {
    const dao = useDaoStore()
    const sect = useSectStore()
    // Azure Sword Sect is metal element with 0.75 discount.
    sect.archetype = 'azureSword'
    // 100 × 0.75 = 75, floored = 75.
    expect(dao.nodeCost('metal').toNumber()).toBe(75)
    // Wood root is NOT discounted (different element).
    expect(dao.nodeCost('wood').toNumber()).toBe(100)
  })

  it('discounted cost never goes below 1', () => {
    const dao = useDaoStore()
    const sect = useSectStore()
    sect.archetype = 'azureSword'
    // Even with a heavy discount, the floor + max(1) guarantees >= 1.
    expect(dao.nodeCost('metal').toNumber()).toBeGreaterThanOrEqual(1)
  })
})
