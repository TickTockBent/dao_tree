// src/stores/__tests__/severing.test.ts — Spirit Severing goes real (slice 9,
// D11/D23/D25). Drives the real stores to make severables live, then exercises
// availability, sever guards, nullification round-trips, and the ramp math.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useSeveringStore } from '@/stores/severing'
import { useBodyStore } from '@/stores/body'
import { useAlchemyStore } from '@/stores/alchemy'
import { useRealmStore } from '@/stores/realm'
import { useSoulStore } from '@/stores/soul'
import { useGameStore } from '@/stores/game'
import { useDaoStore } from '@/stores/dao'
import { usePipelinesStore } from '@/stores/pipelines'
import { SETPIECE_DATA } from '@/data/setpieces'
import { ACCUMULATOR_DATA } from '@/data/accumulators'
import { OFFERING_DATA } from '@/data/severing'
import { findBodyBuyable } from '@/data/body'
import { findRecipe } from '@/data/alchemy'

const CFG = SETPIECE_DATA.severance
const EXT_LIMIT = findBodyBuyable('extraordinaryMeridian').limit
const EXT_BASE = findBodyBuyable('extraordinaryMeridian').effectBase
const GATHER_PILL_MULT = (() => {
  const effect = findRecipe('gatheringPill').effect
  return effect.type === 'timedQiMult' ? effect.mult : 1
})()

/** Ramp ratio at a raw step, mirroring the store's data-derived formula. */
function expectedRatio(steps: number): number {
  const growth = Math.pow(CFG.capRatio / CFG.startFraction, 1 / (CFG.rampSteps - 1))
  return Math.min(CFG.startFraction * Math.pow(growth, steps), CFG.capRatio)
}

function unlockRealmX(): void {
  useRealmStore().stateOf('x').unlocked = true
}

/** Choose the Formless aspect (both axes 1.2) — the easiest live severable. */
function chooseAspect(): void {
  useBodyStore().setSoulAspect('formless', {})
}

describe('severing store (Spirit Severing goes real)', () => {
  beforeEach(() => {
    bootTestStores()
  })

  // ---- liveSeverables availability ----------------------------------------

  it('fresh: nothing acquired, so no live severables', () => {
    const severing = useSeveringStore()
    expect(severing.liveSeverables).toEqual([])
    expect(severing.nextCorpse).toBe('past')
  })

  it('a chosen aspect becomes live; profession and full ext track too', () => {
    const severing = useSeveringStore()
    const body = useBodyStore()
    const alchemy = useAlchemyStore()

    chooseAspect()
    expect(severing.liveSeverables).toContain('soulAspect')

    alchemy.chooseProfession('alchemy')
    expect(severing.liveSeverables).toContain('profession')

    // Ext meridians go live ONLY at the full purchase limit (read from data).
    body.extraordinaryMeridians = EXT_LIMIT - 1
    expect(severing.liveSeverables).not.toContain('extraordinaryMeridians')
    body.extraordinaryMeridians = EXT_LIMIT
    expect(severing.liveSeverables).toContain('extraordinaryMeridians')

    // Manifestation stays absent until the lattice ring lands (no tier-3 nodes).
    expect(severing.liveSeverables).not.toContain('manifestation')
  })

  // ---- sever guards --------------------------------------------------------

  it('refuses to sever while realm x is locked', () => {
    const severing = useSeveringStore()
    chooseAspect()
    expect(severing.sever('soulAspect')).toBe(false)
    expect(severing.isSevered('soulAspect')).toBe(false)
  })

  it('refuses a severable that is not acquired (dead severable)', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    expect(severing.sever('profession')).toBe(false)
    expect(severing.isSevered('profession')).toBe(false)
  })

  it('severs a live piece once realm x is unlocked, and refuses a double-sever', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    chooseAspect()

    expect(severing.sever('soulAspect')).toBe(true)
    expect(severing.isSevered('soulAspect')).toBe(true)
    expect(severing.severances.length).toBe(1)
    expect(severing.nextCorpse).toBe('present')

    // Already severed → no longer live → second attempt refuses.
    expect(severing.liveSeverables).not.toContain('soulAspect')
    expect(severing.sever('soulAspect')).toBe(false)
    expect(severing.severances.length).toBe(1)
  })

  it('gates the next corpse on the previous cut crossing breakeven (sequential)', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    const alchemy = useAlchemyStore()
    unlockRealmX()
    chooseAspect()
    alchemy.chooseProfession('alchemy')

    expect(severing.sever('soulAspect')).toBe(true)

    // The second corpse is closed until the first severance is lived with.
    expect(severing.previousLivedWith).toBe(false)
    expect(severing.sever('profession')).toBe(false)
    expect(severing.severances.length).toBe(1)

    // Advance the ritual clock to just below breakeven — still closed.
    for (let step = 0; step < 5; step++) soul.recordSeveranceRitual()
    expect(severing.previousLivedWith).toBe(false)
    expect(severing.sever('profession')).toBe(false)

    // One more crosses breakeven (raw step 6) — the corpse opens.
    soul.recordSeveranceRitual()
    expect(severing.previousLivedWith).toBe(true)
    expect(severing.sever('profession')).toBe(true)
    expect(severing.severances.length).toBe(2)
    expect(severing.nextCorpse).toBe('future')
  })

  // ---- nullification round-trips ------------------------------------------

  it('severing the ext-meridian track drops its meridian factor to identity', () => {
    const severing = useSeveringStore()
    const body = useBodyStore()
    unlockRealmX()
    body.extraordinaryMeridians = EXT_LIMIT

    const before = body.meridianMult.toNumber()
    expect(before).toBeCloseTo(Math.pow(EXT_BASE, EXT_LIMIT), 4)

    expect(severing.sever('extraordinaryMeridians')).toBe(true)
    // No primary meridians bought → the whole factor collapses to 1.
    expect(body.meridianMult.toNumber()).toBeCloseTo(1, 6)
  })

  it('severing the profession voids the active pill multiplier', () => {
    const severing = useSeveringStore()
    const alchemy = useAlchemyStore()
    unlockRealmX()
    alchemy.chooseProfession('alchemy')
    alchemy.activePill = { key: 'gatheringPill', remaining: 600 }

    expect(alchemy.activePillQiMult.toNumber()).toBeCloseTo(GATHER_PILL_MULT, 6)
    expect(severing.sever('profession')).toBe(true)
    expect(alchemy.activePillQiMult.toNumber()).toBeCloseTo(1, 6)
  })

  it('severing the aspect nullifies its pipeline factor (isolated via qi ratio)', () => {
    const severing = useSeveringStore()
    const pipelines = usePipelinesStore()
    unlockRealmX()
    chooseAspect()

    const qiBefore = pipelines.qiPerSecond.toNumber()
    expect(qiBefore).toBeGreaterThan(0)

    expect(severing.sever('soulAspect')).toBe(true)
    const qiAfter = pipelines.qiPerSecond.toNumber()

    // Before: ×aspect(1.2) ×transcendent(1). After: ×aspect(1) ×transcendent(c·1.2).
    // ratio = (1 · 0.5·1.2)/(1.2 · 1) = startFraction. If the aspect factor had
    // NOT dropped to 1, the ratio would be 0.5·1.2 = 0.6 — distinguishable.
    expect(qiAfter / qiBefore).toBeCloseTo(CFG.startFraction, 5)
  })

  // ---- ramp math (D25, hand-computed) -------------------------------------

  it('ramps c→k geometrically, breakeven at step 7, cap at step 12 (c=0.5,k=2,steps=12)', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    chooseAspect() // qi & insight contribution both 1.2
    expect(severing.sever('soulAspect')).toBe(true)
    const record = severing.severances[0]!

    // Step 0 (raw): ratio = startFraction, a felt weakness window.
    let readout = severing.readoutFor(record)
    expect(readout.ratio).toBeCloseTo(CFG.startFraction, 6)
    expect(readout.breakevenCrossed).toBe(false)
    expect(readout.breakevenStep).toBe(7)
    expect(readout.capStep).toBe(CFG.rampSteps)
    // qi axis: 1.2 × 0.5 = 0.6 (below 1 — the honest malus).
    expect(readout.qiMult.toNumber()).toBeCloseTo(1.2 * CFG.startFraction, 6)

    // Raw step 5: still below breakeven.
    for (let step = 0; step < 5; step++) soul.recordSeveranceRitual()
    readout = severing.readoutFor(record)
    expect(readout.steps).toBe(5)
    expect(readout.ratio).toBeCloseTo(expectedRatio(5), 6)
    expect(readout.breakevenCrossed).toBe(false)
    expect(readout.ratio).toBeLessThan(1)

    // Raw step 6 = display step 7: breakeven crosses.
    soul.recordSeveranceRitual()
    readout = severing.readoutFor(record)
    expect(readout.steps).toBe(6)
    expect(readout.displayStep).toBe(7)
    expect(readout.breakevenCrossed).toBe(true)
    expect(readout.ratio).toBeGreaterThanOrEqual(1)

    // Raw step 11 = display step 12: the cap.
    for (let step = 6; step < 11; step++) soul.recordSeveranceRitual()
    readout = severing.readoutFor(record)
    expect(readout.displayStep).toBe(CFG.rampSteps)
    expect(readout.ratio).toBeCloseTo(CFG.capRatio, 6)
    expect(readout.qiMult.toNumber()).toBeCloseTo(1.2 * CFG.capRatio, 6)

    // Beyond the cap: ratio clamps, display step stays at the cap.
    soul.recordSeveranceRitual()
    readout = severing.readoutFor(record)
    expect(readout.ratio).toBeCloseTo(CFG.capRatio, 6)
    expect(readout.displayStep).toBe(CFG.rampSteps)
  })

  it('a qi-only piece never drags the insight axis below 1 (both-axes rule)', () => {
    const severing = useSeveringStore()
    const body = useBodyStore()
    unlockRealmX()
    body.extraordinaryMeridians = EXT_LIMIT // qi = base^limit, insight = 1

    expect(severing.sever('extraordinaryMeridians')).toBe(true)

    // At step 0 the ratio is 0.5: qi is scaled down (a real malus), but the
    // unoccupied insight axis (m === 1) is floored at 1, never 0.5.
    expect(severing.transcendentInsightMult.toNumber()).toBeCloseTo(1, 6)
    expect(severing.transcendentQiMult.toNumber()).toBeCloseTo(
      Math.pow(EXT_BASE, EXT_LIMIT) * CFG.startFraction,
      4,
    )
  })

  it('an occupied axis IS dragged below 1 in the weakness window (aspect, both axes)', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    chooseAspect() // insight m = 1.2 (occupied) → 1.2·0.5 = 0.6, a real malus
    expect(severing.sever('soulAspect')).toBe(true)
    expect(severing.transcendentInsightMult.toNumber()).toBeCloseTo(1.2 * CFG.startFraction, 6)
  })

  // ---- persistence + history ----------------------------------------------

  it('save/load round-trips the severances and their captured contribution', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    chooseAspect()
    severing.sever('soulAspect')

    const qiBefore = severing.transcendentQiMult.toNumber()
    const saved = severing.save()
    severing.load(JSON.parse(JSON.stringify(saved)))

    expect(severing.severances.length).toBe(1)
    expect(severing.isSevered('soulAspect')).toBe(true)
    expect(severing.transcendentQiMult.toNumber()).toBeCloseTo(qiBefore, 6)
  })

  it('records the cut in the eternal soul history (D24)', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    chooseAspect()
    severing.sever('soulAspect')

    expect(soul.severanceHistory.length).toBe(1)
    expect(soul.severanceHistory[0]).toMatchObject({ severable: 'soulAspect', life: 1 })
  })

  it('captured contribution matches the aspect data (qi & insight)', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    chooseAspect()
    severing.sever('soulAspect')
    const record = severing.severances[0]!
    expect(new Decimal(record.severedQiMult).toNumber()).toBeCloseTo(1.2, 6)
    expect(new Decimal(record.severedInsightMult).toNumber()).toBeCloseTo(1.2, 6)
  })
})

// ---- D28: The Offering (prestige('x') is a sacrifice) ----------------------

describe('the offering (D28)', () => {
  beforeEach(() => {
    bootTestStores()
  })

  const OFFER_ACC = ACCUMULATOR_DATA.severanceRitual
  function basket(corpse: 'past' | 'present' | 'future') {
    return OFFERING_DATA.baskets.find((b) => b.corpse === corpse)!
  }
  /** Mirrors the store's cost SCALE: growth^stepsInto × max(r^rituals,f) × pill. */
  function expectedScale(stepsInto: number, rituals: number, pill: boolean): number {
    const growth = Math.pow(OFFERING_DATA.growth, stepsInto)
    const mastery = Math.max(Math.pow(OFFER_ACC.ratio!, rituals), OFFER_ACC.floor!)
    return growth * mastery * (pill ? OFFERING_DATA.pillDiscount : 1)
  }

  it('fresh offering is the past corpse at basket base (scale = 1)', () => {
    const severing = useSeveringStore()
    unlockRealmX()
    expect(severing.offeringCorpse).toBe('past')
    const cost = severing.offeringCost()
    expect(cost.qi.div(basket('past').qiBase).toNumber()).toBeCloseTo(1, 9)
    expect(cost.insight.div(basket('past').insightBase).toNumber()).toBeCloseTo(1, 9)
  })

  it('the offering corpse follows nextCorpse, and holds at the last corpse once all cut', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    const body = useBodyStore()
    const alchemy = useAlchemyStore()
    unlockRealmX()
    chooseAspect()
    alchemy.chooseProfession('alchemy')
    body.extraordinaryMeridians = EXT_LIMIT

    expect(severing.sever('soulAspect')).toBe(true) // cut PAST
    expect(severing.offeringCorpse).toBe('present') // rite now serves present
    // Cost basket switched to present (stepsInto reset to 0 at the cut).
    expect(severing.offeringCost().insight.div(basket('present').insightBase).toNumber())
      .toBeCloseTo(1, 9)

    for (let step = 0; step < 6; step++) soul.recordSeveranceRitual() // cross breakeven
    expect(severing.sever('profession')).toBe(true) // cut PRESENT
    expect(severing.offeringCorpse).toBe('future')

    for (let step = 0; step < 6; step++) soul.recordSeveranceRitual()
    expect(severing.sever('extraordinaryMeridians')).toBe(true) // cut FUTURE
    expect(severing.nextCorpse).toBeNull()
    // All three cut: the rite continues to cap, priced by the LAST corpse.
    expect(severing.offeringCorpse).toBe('future')
  })

  it('cost = basket × growth^stepsInto × max(r^rituals,f) × pill — exact composition', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    const past = basket('past')
    // Pre-first-severance practice steps: stepsInto === rituals (no record yet).
    for (let ritualCount = 0; ritualCount < 4; ritualCount++) {
      const cost = severing.offeringCost()
      const scale = expectedScale(ritualCount, ritualCount, false)
      expect(cost.qi.div(past.qiBase).toNumber()).toBeCloseTo(scale, 9)
      expect(cost.insight.div(past.insightBase).toNumber()).toBeCloseTo(scale, 9)
      soul.recordSeveranceRitual()
    }
  })

  it('growth makes each successive offering more expensive (net of mastery)', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    const first = severing.offeringCost().qi
    soul.recordSeveranceRitual()
    const second = severing.offeringCost().qi
    // growth 1.5 outpaces mastery 0.9 → net ×1.35 per practice step.
    expect(second.gt(first)).toBe(true)
    expect(second.div(first).toNumber()).toBeCloseTo(
      OFFERING_DATA.growth * OFFER_ACC.ratio!,
      9,
    )
  })

  it('the mastery discount floors at ACCUMULATOR_DATA.severanceRitual.floor', () => {
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    chooseAspect()
    // Drive rituals deep enough that r^rituals < floor, then cut so stepsInto=0.
    const deepRituals = 20
    for (let step = 0; step < deepRituals; step++) soul.recordSeveranceRitual()
    expect(severing.sever('soulAspect')).toBe(true) // ritualStepsAtSever=20 → stepsInto=0
    expect(Math.pow(OFFER_ACC.ratio!, deepRituals)).toBeLessThan(OFFER_ACC.floor!)
    const present = basket('present')
    const cost = severing.offeringCost()
    // stepsInto=0 → growth^0=1; mastery floored at f; no pill → scale = floor.
    expect(cost.insight.div(present.insightBase).toNumber()).toBeCloseTo(OFFER_ACC.floor!, 9)
  })

  it('an active pill discounts every offering by pillDiscount', () => {
    const severing = useSeveringStore()
    const alchemy = useAlchemyStore()
    unlockRealmX()
    const before = severing.offeringCost().qi
    alchemy.activePill = { key: 'gatheringPill', remaining: 600 }
    const after = severing.offeringCost().qi
    expect(after.div(before).toNumber()).toBeCloseTo(OFFERING_DATA.pillDiscount, 9)
  })

  it('performOffering subtracts BOTH qi and insight (consumption round-trip)', () => {
    const severing = useSeveringStore()
    const game = useGameStore()
    const dao = useDaoStore()
    unlockRealmX()
    game.points = new Decimal('1e14')
    dao.insight = new Decimal('1e8')
    const cost = severing.offeringCost()
    const qiBefore = game.points
    const insightBefore = dao.insight

    expect(severing.performOffering()).toBe(true)
    expect(game.points.toString()).toBe(qiBefore.sub(cost.qi).toString())
    expect(dao.insight.toString()).toBe(insightBefore.sub(cost.insight).toString())
    expect(game.points.lt(qiBefore)).toBe(true)
    expect(dao.insight.lt(insightBefore)).toBe(true)
  })

  it('performOffering refuses (and consumes nothing) when either resource is short', () => {
    const severing = useSeveringStore()
    const game = useGameStore()
    const dao = useDaoStore()
    unlockRealmX()
    game.points = new Decimal('1e14')
    dao.insight = new Decimal('0') // insight short
    const qiBefore = game.points

    expect(severing.canAffordOffering()).toBe(false)
    expect(severing.performOffering()).toBe(false)
    expect(game.points.toString()).toBe(qiBefore.toString()) // qi untouched
  })

  it("canReset('x') is false when insight is short even with abundant qi", () => {
    const realm = useRealmStore()
    const game = useGameStore()
    const dao = useDaoStore()
    unlockRealmX()
    game.points = new Decimal('1e20') // qi abundant
    dao.insight = new Decimal('0')
    expect(realm.canReset('x')).toBe(false)
    dao.insight = new Decimal('1e8')
    expect(realm.canReset('x')).toBe(true)
  })

  it('realm-x substage label advances on the CUT (severance count), not on an offering', () => {
    const realm = useRealmStore()
    const severing = useSeveringStore()
    const soul = useSoulStore()
    unlockRealmX()
    chooseAspect()

    // Zero cuts → no substage, regardless of ritual/offering count.
    expect(realm.realmSubstageLabel('x')).toBeNull()
    for (let step = 0; step < 5; step++) soul.recordSeveranceRitual()
    expect(realm.realmSubstageLabel('x')).toBeNull()

    // The first cut advances the substage to the first corpse's label.
    expect(severing.sever('soulAspect')).toBe(true)
    expect(realm.realmSubstageLabel('x')).toBe('The Past Lies Severed')
    // The milestone (qiMult reward) latches off the cut count too.
    realm.latchMilestones('x')
    expect(realm.stateOf('x').milestones).toContain(0)
  })
})
