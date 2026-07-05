// src/stores/__tests__/karma.test.ts — the karma accumulator (slice 10).
//
// The receipt math (headline once, echo at VARIANT_SHARE, base × rⁿ decay,
// floor f = 0) is table-driven against a synthetic history; settleLife's
// pay-and-fold is exercised end-to-end. Every expectation is DERIVED from the
// KARMA_DATA constants, never a copied literal.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKarmaStore, freshKarmaSlice } from '@/stores/karma'
import {
  KARMA_DATA,
  KARMA_DECAY_RATIO,
  VARIANT_SHARE,
} from '@/data/karma'

const MILESTONE_BASE = KARMA_DATA.find((r) => r.key === 'reachRealm:f')!.base // milestone weight
const GRADE_BASE = KARMA_DATA.find((r) => r.key === 'foundationGradeDelta')!.base
const DEED_BASE = KARMA_DATA.find((r) => r.key === 'endureTrial:whisperingDoubt')!.base

describe('karma store: fresh slice', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts empty', () => {
    const karma = useKarmaStore()
    expect(karma.balance).toBe(0)
    expect(karma.ledger).toEqual([])
    expect(freshKarmaSlice()).toEqual({ balance: 0, lifeLedger: [], firstsHistory: {}, gradeBests: {} })
  })
})

describe('karma store: recordGradeDelta (personal-best latch, D40)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('records a grade first only on a STRICT improvement over the carried best', () => {
    const karma = useKarmaStore()
    // First landing at grade index 2 → improves over the empty best (-1).
    karma.recordGradeDelta('foundationGradeDelta', 2)
    expect(karma.ledger).toHaveLength(1)
    expect(karma.gradeBests['foundationGradeDelta']).toBe(2)
    // Re-landing at the SAME grade this life pays nothing (ledger dedup) and does
    // not move the best.
    karma.recordGradeDelta('foundationGradeDelta', 2)
    expect(karma.ledger).toHaveLength(1)
    // A strict improvement later this life re-latches the best but records no
    // SECOND payment (one grade-delta payment per row per life — matches the sim).
    karma.recordGradeDelta('foundationGradeDelta', 3)
    expect(karma.gradeBests['foundationGradeDelta']).toBe(3)
    expect(karma.ledger).toHaveLength(1)
  })

  it('a negative grade index (never reached) records nothing', () => {
    const karma = useKarmaStore()
    karma.recordGradeDelta('coreGradeDelta', -1)
    expect(karma.ledger).toEqual([])
    expect(karma.gradeBests['coreGradeDelta']).toBeUndefined()
  })

  it('gradeBests is soul-scoped: a settled best gates the NEXT life to strict improvement', () => {
    const karma = useKarmaStore()
    karma.recordGradeDelta('coreGradeDelta', 2)
    karma.settleLife() // best 2 carries (gradeBests is not cleared by settle)
    expect(karma.gradeBests['coreGradeDelta']).toBe(2)
    // Next life re-lands at grade 2 → not an improvement → pays nothing.
    karma.recordGradeDelta('coreGradeDelta', 2)
    expect(karma.ledger).toEqual([])
    // …but grade 3 is a fresh personal best → records (and decays by prior earns).
    karma.recordGradeDelta('coreGradeDelta', 3)
    expect(karma.ledger).toHaveLength(1)
  })
})

describe('karma store: recordFirst', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('appends a ledger entry with the row class and resolved qualifiers', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    expect(karma.ledger).toEqual([
      {
        eventKey: 'reachRealm:f',
        class: 'milestone',
        resolvedQualifiers: { rootShape: 'rootless', buildMark: 'meridian' },
      },
    ])
  })

  it('is idempotent within a life (the same first is not a first twice)', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    expect(karma.ledger).toHaveLength(1)
  })

  it('throws on an unknown event key (a code bug)', () => {
    const karma = useKarmaStore()
    expect(() => karma.recordFirst('notAnEvent')).toThrow(/unknown karma event key/)
  })
})

describe('karma store: previewReceipt math', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('headline pays full base once ever; each variant pays VARIANT_SHARE × base (n = 0)', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    const receipt = karma.previewReceipt()
    expect(receipt.milestoneHeadline).toBeCloseTo(MILESTONE_BASE, 10)
    expect(receipt.milestoneEcho).toBeCloseTo(VARIANT_SHARE * MILESTONE_BASE, 10)
    expect(receipt.total).toBeCloseTo(MILESTONE_BASE + VARIANT_SHARE * MILESTONE_BASE, 10)
  })

  it('a headline is paid ONCE even when several variants share the event key', () => {
    const karma = useKarmaStore()
    // The repeat-ladder trial fires in two different eras → two variants, one headline.
    karma.recordFirst('endureTrial:hollowCrown', { realmEra: 'f' })
    karma.recordFirst('endureTrial:hollowCrown', { realmEra: 's' })
    const deedBase = KARMA_DATA.find((r) => r.key === 'endureTrial:hollowCrown')!.base
    const receipt = karma.previewReceipt()
    // deed+encounter bucket: one headline + two echoes.
    expect(receipt.deedEncounter).toBeCloseTo(deedBase + 2 * VARIANT_SHARE * deedBase, 10)
  })

  it('grade-delta rows are headline-only and land in the gradeDelta bucket', () => {
    const karma = useKarmaStore()
    karma.recordFirst('foundationGradeDelta')
    const receipt = karma.previewReceipt()
    expect(receipt.gradeDelta).toBeCloseTo(GRADE_BASE, 10)
    expect(receipt.milestoneEcho).toBe(0)
    expect(receipt.total).toBeCloseTo(GRADE_BASE, 10)
  })

  it('applies base × rⁿ decay against the synthetic history (headline and variant independently)', () => {
    const karma = useKarmaStore()
    // Synthetic prior-life history: this headline earned twice, this variant once.
    karma.firstsHistory = {
      'reachRealm:f': 2,
      'reachRealm:f#buildMark=meridian|rootShape=rootless': 1,
    }
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    const receipt = karma.previewReceipt()
    expect(receipt.milestoneHeadline).toBeCloseTo(MILESTONE_BASE * KARMA_DECAY_RATIO ** 2, 10)
    expect(receipt.milestoneEcho).toBeCloseTo(
      VARIANT_SHARE * MILESTONE_BASE * KARMA_DECAY_RATIO ** 1,
      10,
    )
  })

  it('floor f = 0: a deeply-repeated first decays toward zero but never negative', () => {
    const karma = useKarmaStore()
    karma.firstsHistory = { 'foundationGradeDelta': 40 }
    karma.recordFirst('foundationGradeDelta')
    const receipt = karma.previewReceipt()
    expect(receipt.total).toBeGreaterThanOrEqual(0)
    expect(receipt.total).toBeLessThan(1e-6) // 4 × 0.5^40 ≈ 0
  })
})

describe('karma store: settleLife (pay + fold + clear)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('pays the receipt into balance, folds the ledger into history, and clears it', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    const expected = MILESTONE_BASE + VARIANT_SHARE * MILESTONE_BASE
    const receipt = karma.settleLife()
    expect(receipt.total).toBeCloseTo(expected, 10)
    expect(karma.balance).toBeCloseTo(expected, 10)
    expect(karma.ledger).toEqual([]) // cleared
    // History folded: headline + variant each recorded once.
    expect(karma.firstsHistory['reachRealm:f']).toBe(1)
  })

  it('the SAME first earned again next life pays base × r¹ (the fold made it a repeat)', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    karma.settleLife() // life 1

    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    const receipt = karma.previewReceipt() // life 2, before settling
    expect(receipt.milestoneHeadline).toBeCloseTo(MILESTONE_BASE * KARMA_DECAY_RATIO, 10)
    expect(receipt.milestoneEcho).toBeCloseTo(VARIANT_SHARE * MILESTONE_BASE * KARMA_DECAY_RATIO, 10)
  })

  it('a breadth sequence out-earns an equal-length repeat sequence (D36 shape)', () => {
    // Two DIFFERENT firsts (breadth) vs the same first twice (repeat), each 2 lives.
    const breadth = useKarmaStore()
    breadth.recordFirst('severed:soulAspect')
    breadth.settleLife()
    breadth.recordFirst('severed:profession')
    const breadthSecond = breadth.settleLife().total

    setActivePinia(createPinia())
    const repeat = useKarmaStore()
    repeat.recordFirst('severed:soulAspect')
    repeat.settleLife()
    repeat.recordFirst('severed:soulAspect')
    const repeatSecond = repeat.settleLife().total

    expect(breadthSecond).toBe(DEED_BASE) // a fresh first pays full base
    expect(repeatSecond).toBeCloseTo(DEED_BASE * KARMA_DECAY_RATIO, 10) // a repeat decays
    expect(breadthSecond).toBeGreaterThan(repeatSecond)
  })
})

describe('karma store: save/load round-trip', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('round-trips balance, ledger, and history', () => {
    const karma = useKarmaStore()
    karma.recordFirst('reachRealm:c', { rootShape: 'rootless', buildMark: 'lattice' })
    karma.settleLife()
    karma.recordFirst('joinSect', { rootShape: 'rootless', buildMark: 'sect' })
    const saved = karma.save()

    setActivePinia(createPinia())
    const reloaded = useKarmaStore()
    reloaded.load(saved)
    expect(reloaded.save()).toEqual(saved)
    expect(reloaded.balance).toBe(karma.balance)
    expect(reloaded.ledger).toHaveLength(1)
  })

  it('load(undefined) yields the fresh slice (old saves have no karma slice)', () => {
    const karma = useKarmaStore()
    karma.load(undefined)
    expect(karma.balance).toBe(0)
    expect(karma.ledger).toEqual([])
    expect(karma.firstsHistory).toEqual({})
  })
})
