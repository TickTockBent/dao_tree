// src/stores/__tests__/rebirth-menu.test.ts — the rebirth menu (slice 10 step 5).
//
// Memory fragments (Seeds) + spiritual roots at the D41 #2 SIGNED prices. Covers:
//   - the escalating Seed pricing math + the flat-track constants;
//   - the root discount grid (SPEED, NEVER ACCESS) — matching regions only, no gate;
//   - spend validation (can't overspend the post-crossing balance);
//   - the graded lattice carry (Glimpses free / Seeds if paid / Manifestations die);
//   - the rootless crossing = byte-identical baseline (no purchase → plain reincarnate);
//   - the chronicle rootConfig fills from the dying life's roots.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useRebirthStore } from '@/stores/rebirth'
import { useKarmaStore } from '@/stores/karma'
import { useChronicleStore } from '@/stores/chronicle'
import { useDaoStore } from '@/stores/dao'
import { useRootsStore } from '@/stores/roots'
import { useTribulationStore } from '@/stores/tribulation'
import { useGameStore } from '@/stores/game'
import {
  SEED_FRAGMENT_BASE,
  SEED_FRAGMENT_GROWTH,
  TECHNIQUE_FRAGMENT_COST,
  ROOT_CONFIG_COST,
  ROOT_PURITY_COST,
  seedFragmentCost,
  seedFragmentTotal,
  rootDiscountFraction,
} from '@/data/rebirth'
import { findLatticeNode } from '@/data/lattice'

const PASSING_TRIB_GRADE = 3

// ---- Pricing math (D41 #2 SIGNED) ------------------------------------------

describe('fragment pricing (D41 #2)', () => {
  it('the signed Seed constants + a doubling escalation curve (15/30/60/120…)', () => {
    expect(SEED_FRAGMENT_BASE).toBe(15)
    expect(SEED_FRAGMENT_GROWTH).toBe(2)
    expect(TECHNIQUE_FRAGMENT_COST).toBe(8)
    expect(seedFragmentCost(0)).toBe(15)
    expect(seedFragmentCost(1)).toBe(30)
    expect(seedFragmentCost(2)).toBe(60)
    expect(seedFragmentCost(3)).toBe(120)
  })

  it('the running total is the geometric sum (15/45/105/225)', () => {
    expect(seedFragmentTotal(0)).toBe(0)
    expect(seedFragmentTotal(1)).toBe(15)
    expect(seedFragmentTotal(2)).toBe(45)
    expect(seedFragmentTotal(3)).toBe(105)
    expect(seedFragmentTotal(4)).toBe(225)
  })
})

// ---- Root discount grid (⟨tune⟩ conservative envelope; SPEED, NEVER ACCESS) -

describe('root discount grid (D38 read #3)', () => {
  it('deep-narrow vs wide-shallow at Heaven; purity scales the magnitude', () => {
    // Single-element Heaven is the cap (≤ 35%); five-element Heaven is shallow.
    expect(rootDiscountFraction(1, 'heaven')).toBeCloseTo(0.35, 10)
    expect(rootDiscountFraction(5, 'heaven')).toBeCloseTo(0.12, 10)
    expect(rootDiscountFraction(5, 'heaven')).toBeLessThan(rootDiscountFraction(1, 'heaven'))
    // Earth is half of Heaven; Mortal is a no-op (identity without power).
    expect(rootDiscountFraction(1, 'earth')).toBeCloseTo(0.175, 10)
    expect(rootDiscountFraction(1, 'mortal')).toBe(0)
    expect(rootDiscountFraction(5, 'mortal')).toBe(0)
    // Rootless (0 elements) is always 0.
    expect(rootDiscountFraction(0, 'heaven')).toBe(0)
  })
})

describe('roots store: the lattice-cost multiplier', () => {
  beforeEach(() => bootTestStores())

  it('rootless returns exactly 1 for every element (the baseline invariant)', () => {
    const roots = useRootsStore()
    expect(roots.isRooted).toBe(false)
    for (const element of ['metal', 'wood', 'water', 'fire', 'earth'] as const) {
      expect(roots.latticeDiscountMultiplier(element).eq(1)).toBe(true)
    }
  })

  it('a rooted life discounts ONLY the held elements, scaled by purity', () => {
    const roots = useRootsStore()
    roots.configure(['metal'], 'heaven')
    // metal is held → 1 − 0.35 = 0.65; wood is not held → 1 (untouched).
    expect(roots.latticeDiscountMultiplier('metal').toNumber()).toBeCloseTo(0.65, 10)
    expect(roots.latticeDiscountMultiplier('wood').eq(1)).toBe(true)
  })
})

describe('the discount is SPEED, NEVER ACCESS (D38 read #3)', () => {
  beforeEach(() => bootTestStores())

  it('lowers cost on matching regions but unlocks nothing a rootless cultivator cannot reach', () => {
    const dao = useDaoStore()
    const roots = useRootsStore()

    const metalBase = findLatticeNode('metal').costs[0]! // 100 (glimpse)
    // Rootless: full price.
    expect(dao.nodeCost('metal').toNumber()).toBe(metalBase)

    roots.configure(['metal'], 'heaven')
    // Cost path discounted on the matching element…
    expect(dao.nodeCost('metal').toNumber()).toBe(Math.floor(metalBase * 0.65))
    // …but a non-matching element is byte-identical to rootless.
    const woodBase = findLatticeNode('wood').costs[0]!
    expect(dao.nodeCost('wood').toNumber()).toBe(woodBase)

    // GATES are untouched: 'sword' is a metal node, so it is discounted — yet it
    // stays unbuyable without its 'metal' prerequisite Glimpse, no matter how much
    // Insight the root's discount saves. Discount ≠ access.
    dao.addInsight(new Decimal(1_000_000))
    expect(dao.nodeRequirementsMet('sword')).toBe(false)
    expect(dao.canAffordNode('sword')).toBe(false)
  })
})

// ---- The menu: spend + validation ------------------------------------------

describe('the menu: spend accounting + overspend guard', () => {
  beforeEach(() => bootTestStores())

  it('escalating Seed spend + nominal-config + purity-sink roots sum to the total', () => {
    const rebirth = useRebirthStore()
    const dao = useDaoStore()
    // Two owned Seeds available to carry.
    dao.nodeTiers = { metal: 2, wood: 2 }

    rebirth.toggleSeed('metal')
    expect(rebirth.nextSeedPrice).toBe(30) // the SECOND seed's price
    rebirth.toggleSeed('wood')
    expect(rebirth.seedSpend).toBe(45) // 15 + 30

    rebirth.toggleRootElement('metal')
    rebirth.setRootPurity('earth')
    expect(rebirth.rootSpend).toBe(ROOT_CONFIG_COST + ROOT_PURITY_COST.earth) // 3 + 200
    expect(rebirth.spendTotal).toBe(45 + ROOT_CONFIG_COST + ROOT_PURITY_COST.earth)
  })

  it('cannot overspend: an unaffordable draft neither carries the Seed nor deducts karma', () => {
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    const dao = useDaoStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    karma.balance = 10 // less than the first Seed's 15
    dao.nodeTiers = { metal: 2 } // metal at Seed tier
    rebirth.toggleSeed('metal')
    expect(rebirth.spendAffordable).toBe(false)

    rebirth.cross()
    // The seed was NOT purchased (karma untouched)…
    expect(karma.balance).toBe(10)
    // …but its Glimpse still carried free (Seed dropped to tier 1).
    expect(dao.nodeTierOwned('metal')).toBe(1)
  })
})

// ---- The graded lattice carry (D37) ----------------------------------------

describe('the graded lattice carry: Glimpses free / Seeds if paid / Manifestations die', () => {
  beforeEach(() => bootTestStores())

  it('re-applies the right tiers to the fresh life', () => {
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    const dao = useDaoStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    karma.balance = 100
    // metal Glimpse, wood Seed, water Manifestation.
    dao.nodeTiers = { metal: 1, wood: 2, water: 3 }
    rebirth.toggleSeed('wood') // pay to carry the wood Seed

    rebirth.cross()

    // Glimpse carries free; the paid Seed carries at Seed tier; the Manifestation
    // dies but its Glimpse carries free; nothing else appears.
    expect(dao.nodeTierOwned('metal')).toBe(1)
    expect(dao.nodeTierOwned('wood')).toBe(2)
    expect(dao.nodeTierOwned('water')).toBe(1)
    expect(dao.nodeTierOwned('fire')).toBe(0)
    // The wood Seed cost 15 karma.
    expect(karma.balance).toBe(85)
  })
})

// ---- The rootless baseline invariant (D38) ---------------------------------

describe('a rootless crossing is byte-identical to a no-menu crossing', () => {
  beforeEach(() => bootTestStores())

  it('zero purchases → the fresh life matches a plain reincarnate (empty lattice, rootless)', () => {
    const rebirth = useRebirthStore()
    const dao = useDaoStore()
    const roots = useRootsStore()
    const game = useGameStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    game.points = new Decimal(500)
    // No lattice progress, no seed selection, no root draft.
    rebirth.cross()

    expect(dao.nodeTiers).toEqual({})
    expect(roots.isRooted).toBe(false)
    expect(roots.config).toBeNull()
    expect(game.points.toNumber()).toBe(0)
  })
})

// ---- Purchased root applies to the next life + the chronicle records ---------

describe('purchased roots apply to the next life; the chronicle records the dying life', () => {
  beforeEach(() => bootTestStores())

  it('the fresh life starts with the drafted root config', () => {
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    const roots = useRootsStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    karma.balance = 300
    rebirth.toggleRootElement('fire')
    rebirth.setRootPurity('earth')
    expect(rebirth.spendAffordable).toBe(true)

    rebirth.cross()

    expect(roots.isRooted).toBe(true)
    expect(roots.config).toEqual({ elements: ['fire'], purity: 'earth' })
    expect(karma.balance).toBe(300 - (ROOT_CONFIG_COST + ROOT_PURITY_COST.earth))
  })

  it('the chronicle entry records the DYING life’s root config (null when rootless)', () => {
    const rebirth = useRebirthStore()
    const roots = useRootsStore()
    const chronicle = useChronicleStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    // This life was already rooted (metal/water, Heaven) — set directly.
    roots.configure(['metal', 'water'], 'heaven')
    rebirth.cross()

    expect(chronicle.lives[0]!.rootConfig).toEqual({ elements: ['metal', 'water'], purity: 'heaven' })
  })
})
